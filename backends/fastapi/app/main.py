"""FastAPI 应用入口：挂路由、注册错误处理、暴露静态资源。"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from app.api.v1 import router as api_router
from app.core.config import settings
from app.core.errors import APIError, ErrorCode

BACKEND_ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = BACKEND_ROOT / "static"


def _configure_logging() -> None:
    """为 app.* 命名空间挂一个 INFO 处理器。

    uvicorn 只配置 uvicorn.* 自己的 logger，不给 root 挂 handler；我们的
    app.* 日志会冒泡到 root，被 last-resort 处理器以 WARNING 为门槛输出 ——
    导致 LLM request/response 这类 INFO 事件被吞，只剩 LLM error。这里给
    app logger 单独挂处理器并关闭向上传播，确保 INFO 可见且不与 uvicorn 重复。
    """

    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    app_logger = logging.getLogger("app")
    app_logger.setLevel(level)
    app_logger.propagate = False
    if not any(getattr(h, "_hellotime", False) for h in app_logger.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)-7s %(name)s %(message)s")
        )
        handler._hellotime = True  # type: ignore[attr-defined]  # 幂等标记，避免热重载重复挂
        app_logger.addHandler(handler)


def _sync_static_assets() -> None:
    """从 spec/ 拷贝头像与图标到本后端的 /static 下暴露。"""

    avatars_dst = STATIC_DIR / "avatars"
    icons_dst = STATIC_DIR / "icons"
    avatars_dst.mkdir(parents=True, exist_ok=True)
    icons_dst.mkdir(parents=True, exist_ok=True)

    # 头像
    src = settings.avatars_source_dir
    if src.exists():
        for svg in src.glob("*.svg"):
            dst = avatars_dst / svg.name
            if not dst.exists() or dst.stat().st_mtime < svg.stat().st_mtime:
                shutil.copy2(svg, dst)

    # 技术栈图标
    src = settings.icons_source_dir
    if src.exists():
        for svg in src.glob("*.svg"):
            dst = icons_dst / svg.name
            if not dst.exists() or dst.stat().st_mtime < svg.stat().st_mtime:
                shutil.copy2(svg, dst)


def create_app() -> FastAPI:
    _configure_logging()
    _sync_static_assets()

    app = FastAPI(
        title="HelloTime Pro · FastAPI",
        version=settings.service_version,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    # 开发期放行所有 origin；生产环境应收窄
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    # ---------- 错误处理：统一成 ErrorEnvelope ----------

    @app.exception_handler(APIError)
    async def handle_api_error(_: Request, exc: APIError) -> JSONResponse:
        payload: dict = {
            "success": False,
            "data": None,
            "message": exc.message,
            "errorCode": exc.code.value,
        }
        if exc.details:
            payload["details"] = exc.details
        return JSONResponse(status_code=exc.status_code, content=payload)

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = []
        for err in exc.errors():
            loc = [str(x) for x in err.get("loc", []) if x not in ("body", "query", "path")]
            field = ".".join(loc) if loc else "body"
            details.append({"field": field, "message": err.get("msg", "invalid")})
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "data": None,
                "message": "字段校验失败",
                "errorCode": ErrorCode.VALIDATION_ERROR.value,
                "details": details,
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:  # pragma: no cover
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "data": None,
                "message": f"服务器内部错误: {type(exc).__name__}",
                "errorCode": ErrorCode.INTERNAL_ERROR.value,
            },
        )

    # ---------- 204 响应不应包 envelope ----------
    @app.middleware("http")
    async def no_body_for_204(request: Request, call_next):
        response: Response = await call_next(request)
        if response.status_code == 204:
            # 保证无 body；FastAPI 的 Response(204) 本身就是空，这里做保险
            return Response(status_code=204)
        return response

    return app


app = create_app()
