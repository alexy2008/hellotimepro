package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.dto.Dtos.ErrorEnvelope;
import com.hellotimepro.springmvc.web.ErrorCode;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * 统一处理未匹配路由与容器级错误：
 * <ul>
 *   <li>{@code /api/*} 返回契约格式的 JSON {@link ErrorEnvelope}</li>
 *   <li>其余页面路由：404 返回双皮肤「查无此页」（含 {@code data-testid="not-found"}），
 *       其他状态（400 / 500 …）返回同模板里可重试的出错页</li>
 * </ul>
 */
@Controller
public class ViewErrorController implements ErrorController {
  private final GlobalModelAttributes globalModel;

  public ViewErrorController(GlobalModelAttributes globalModel) {
    this.globalModel = globalModel;
  }

  @RequestMapping("/error")
  public Object handleError(HttpServletRequest req, HttpServletResponse res, Model model) {
    Object rawUri = req.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
    String origUri = rawUri == null ? req.getRequestURI() : rawUri.toString();
    Object rawStatus = req.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
    int status = (rawStatus instanceof Integer s) ? s : 404;

    if (origUri != null && origUri.startsWith("/api/")) {
      HttpStatus httpStatus = HttpStatus.resolve(status);
      if (httpStatus == null) httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      ErrorCode code = switch (status) {
        case 401 -> ErrorCode.UNAUTHORIZED;
        case 403 -> ErrorCode.FORBIDDEN;
        case 404 -> ErrorCode.NOT_FOUND;
        case 409 -> ErrorCode.CONFLICT;
        case 422 -> ErrorCode.VALIDATION_ERROR;
        case 429 -> ErrorCode.RATE_LIMITED;
        default -> status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST;
      };
      return ResponseEntity.status(httpStatus)
          .contentType(MediaType.APPLICATION_JSON)
          .body(new ErrorEnvelope(false, null, httpStatus.getReasonPhrase(), code.name(), null));
    }

    int pageStatus = status == 200 ? 404 : status;
    res.setStatus(pageStatus);
    globalModel.populate(req, res, model, origUri);
    // 只有 404 才是「查无此页」；其余（400 参数错误、500 服务异常）显示可重试的出错页
    boolean notFound = pageStatus == 404;
    model.addAttribute("notFound", notFound);
    model.addAttribute("errorStatus", pageStatus);
    model.addAttribute("pageTitle", (notFound ? "查无此页" : "出了点问题") + " · HelloTime Pro");
    return "not-found";
  }
}
