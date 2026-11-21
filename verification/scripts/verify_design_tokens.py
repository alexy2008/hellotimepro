#!/usr/bin/env python3
"""设计令牌一致性（2.0）。由 verify-design-tokens.sh 调用，规则见 docs/02-design.md §15.4。

    python3 verification/scripts/verify_design_tokens.py              # 只查 spec 本身
    python3 verification/scripts/verify_design_tokens.py react vue    # 再查这些实现自己的样式

1. spec：调用 `spec/styles/build_tokens.py --check`——两套皮肤语义令牌同名同集合、skins.json 是最新的
2. 实现：必须引入 spec/styles 2.0（base.css、paper/tokens.css、amber/tokens.css）
3. 实现自己的样式（.css / .scss / .less 与 .vue / .svelte / .astro 的 <style> 块）：
   - var(--x) 只能引用 base.css 刻度、语义层、或实现内部以 `--_` 开头的局部变量
   - 声明值里不得出现色值字面量：#rgb[a] / #rrggbb[aa]、rgb()、rgba()、hsl()、hsla()、oklch()、oklab()、lab()、lch()
   与 spec/styles 某个文件内容完全相同的拷贝（全栈常把它复制进静态目录）不算实现自己的样式。
"""
from __future__ import annotations

import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STYLES = ROOT / "spec" / "styles"
sys.path.insert(0, str(STYLES))
import build_tokens  # noqa: E402  复用它的解析与 SEMANTIC 规则

SKIP_DIRS = {
    "node_modules", "dist", "build", ".next", ".nuxt", ".output", ".svelte-kit", ".angular",
    "target", "vendor", "coverage", ".turbo", ".cache", "tmp", "storage", "bin", "obj",
}
STYLE_EXT = {".css", ".scss", ".sass", ".less"}
SFC_EXT = {".vue", ".svelte", ".astro"}
SRC_EXT = STYLE_EXT | SFC_EXT | {".ts", ".tsx", ".js", ".jsx", ".mjs", ".html", ".erb", ".php", ".java", ".kt", ".rb", ".json"}

COLOR_RE = re.compile(r"#[0-9a-fA-F]{3,8}(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\s*\(", re.I)
VAR_RE = re.compile(r"var\(\s*(--[\w-]+)")
DECL_RE = re.compile(r"(?<![\w-])(--[\w-]+|[a-zA-Z-]+)\s*:\s*([^;{}]+)")


def allowed_vars() -> set[str]:
    names = {n for _, decls in build_tokens.blocks((STYLES / "base.css").read_text()) for n in decls}
    for skin in build_tokens.SKINS:
        for _, decls in build_tokens.blocks((STYLES / skin / "tokens.css").read_text()):
            names |= {n for n in decls if build_tokens.SEMANTIC.match(n)}
    return names


def spec_copies() -> set[str]:
    return {p.read_text(errors="replace") for p in STYLES.rglob("*.css")}


def resolve(target: str) -> Path | None:
    p = Path(target)
    if p.is_dir():
        return p.resolve()
    for group in ("frontends", "fullstacks"):
        base = ROOT / group
        exact = base / target
        if exact.is_dir():
            return exact
        hits = sorted(d for d in base.glob(f"{target}*") if d.is_dir())
        if len(hits) == 1:
            return hits[0]
    return None


def show(p: Path) -> str:
    try:
        return str(p.relative_to(ROOT))
    except ValueError:
        return str(p)


def walk(d: Path):
    for p in d.iterdir():
        if p.is_dir():
            if p.name in SKIP_DIRS or p.name.startswith("."):
                continue
            yield from walk(p)
        elif p.suffix in SRC_EXT:
            yield p


def style_text(p: Path, s: str) -> str | None:
    if p.suffix in STYLE_EXT:
        return s
    if p.suffix in SFC_EXT:
        s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
        blocks = re.findall(r"<style[^>]*>(.*?)</style>", s, flags=re.S)
        return "\n".join(blocks) if blocks else None
    return None


class StylesheetLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths: list[str] = []

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        if tag == "link" and "stylesheet" in (attr.get("rel") or "").lower().split():
            self.paths.append(attr.get("href") or "")


def stylesheet_imports(p: Path, raw: str, css: str | None):
    if css:
        body = build_tokens.strip_comments(css)
        yield from re.findall(r"""^\s*@import\s+(?:url\(\s*)?["']?([^\s"');]+)""", body, re.M)
    if p.suffix in {".html", ".erb", ".php", ".vue", ".svelte", ".astro"}:
        links = StylesheetLinks()
        links.feed(raw)
        yield from links.paths
    if p.suffix in {".js", ".jsx", ".ts", ".tsx", ".mjs"} | SFC_EXT:
        body = re.sub(r"/\*.*?\*/|<!--.*?-->", "", raw, flags=re.S)
        yield from re.findall(r"""^\s*import\s*["']([^"']+\.css)["']""", body, re.M)


def check_impl(name: str, d: Path, allowed: set[str], copies: set[str]) -> list[str]:
    errs: list[str] = []
    required = {"base.css", "paper/tokens.css", "amber/tokens.css"}
    imported: set[str] = set()
    scanned = 0
    for p in walk(d):
        raw = p.read_text(errors="replace")
        css = style_text(p, raw)
        for path in stylesheet_imports(p, raw, css):
            imported.update(name for name in required if path == name or path.endswith("/" + name))
        if css is None or raw in copies:
            continue
        scanned += 1
        rel = show(p)
        body = build_tokens.strip_comments(css)
        for m in VAR_RE.finditer(body):
            v = m.group(1)
            if v not in allowed and not v.startswith("--_"):
                line = body.count("\n", 0, m.start()) + 1
                errs.append(f"{rel}:{line}  引用了非公开令牌 {v}（只能用 base.css 刻度、语义层或 --_ 局部变量）")
        for m in DECL_RE.finditer(body):
            c = COLOR_RE.search(m.group(2))
            if c:
                line = body.count("\n", 0, m.start()) + 1
                errs.append(f"{rel}:{line}  {m.group(1)} 里写了色值字面量 {c.group(0).rstrip('(')}…（改用语义令牌）")
    missing = sorted(required - imported)
    if missing:
        errs.insert(0, f"{show(d)}  缺少样式导入：{', '.join(missing)}")
    print(f"  · {name}: 扫描 {scanned} 个样式文件")
    return errs


def main(argv: list[str]) -> int:
    print("🎨 设计令牌一致性（2.0）")
    r = subprocess.run([sys.executable, str(STYLES / "build_tokens.py"), "--check"], capture_output=True, text=True)
    sys.stdout.write("  · spec: " + (r.stdout or r.stderr).strip().replace("\n", "\n    ") + "\n")
    failed = r.returncode != 0

    allowed, copies = allowed_vars(), spec_copies()
    for t in argv:
        d = resolve(t)
        if not d:
            print(f"  ✗ 找不到实现：{t}（frontends/ 或 fullstacks/ 下的目录名，或一个路径）")
            failed = True
            continue
        errs = check_impl(t, d, allowed, copies)
        for e in errs:
            print(f"    ✗ {e}")
        failed |= bool(errs)

    print("✅ 通过" if not failed else "❌ 未通过")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
