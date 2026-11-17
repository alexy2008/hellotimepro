#!/usr/bin/env python3
"""由 spec/styles 生成 spec/tokens/skins.json（2.0 令牌的 JSON 投影）。

    python3 spec/styles/build_tokens.py           # 重新生成
    python3 spec/styles/build_tokens.py --check   # 只校验：语义层两套皮肤同名同集合、JSON 是最新的

JSON 里只放「语义层」与 base.css 的刻度，给 JS / 原生客户端用；私有令牌不导出。
语义值会把 var() 逐层展开成具体值；`color-mix(in srgb, X p%, transparent)` 换算成带透明度的颜色，
其余无法静态求值的写法（渐变、clamp）原样保留为 CSS 字符串。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / 'tokens' / 'skins.json'
SKINS = {'paper': '时笺', 'amber': '琥珀'}
THEMES = ('light', 'dark')
# 语义层的命名规则：符合它的令牌两套皮肤必须同名同集合，各实现也只能引用它们（外加 base.css）
SEMANTIC = re.compile(r'^--(color-[\w-]+|bg-primary|font-(display|body|mono|latin)|radius-(sm|md|lg|pill)|shadow-(card|pop)|header-h)$')


def strip_comments(s):
    return re.sub(r'/\*.*?\*/', '', s, flags=re.S)


def blocks(css):
    """[(selector, {name: value})]，只认顶层 `选择器 { --x: ...; }`"""
    out = []
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', strip_comments(css)):
        sel = ' '.join(m.group(1).split())
        decls, depth, cur = {}, 0, ''
        for ch in m.group(2) + ';':
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
            if ch == ';' and depth == 0:
                if ':' in cur and cur.strip().startswith('--'):
                    k, v = cur.split(':', 1)
                    decls[k.strip()] = ' '.join(v.split())
                cur = ''
            else:
                cur += ch
        out.append((sel, decls))
    return out


def skin_vars(skin):
    """{theme: {name: value}}：主题块覆盖皮肤基础块"""
    bl = blocks((ROOT / skin / 'tokens.css').read_text(encoding='utf-8'))
    base_sel = ':root[data-skin="%s"]' % skin
    res = {}
    for theme in THEMES:
        v = {}
        for sel, d in bl:
            if sel == base_sel:
                v.update(d)
        for sel, d in bl:
            if sel == '%s[data-theme="%s"]' % (base_sel, theme):
                v.update(d)
        res[theme] = v
    return res


def base_vars():
    for sel, d in blocks((ROOT / 'base.css').read_text(encoding='utf-8')):
        if sel == ':root':
            return d
    raise SystemExit('base.css 里没有 :root 块')


def resolve(val, env, depth=0):
    if depth > 20:
        raise ValueError('var() 循环引用：' + val)

    def sub(m):
        name, fallback = m.group(1), m.group(2)
        if name in env:
            return resolve(env[name], env, depth + 1)
        if fallback is not None:
            return fallback.strip()
        raise KeyError(name)
    prev = None
    while prev != val:
        prev = val
        val = re.sub(r'var\((--[\w-]+)(?:,([^()]*))?\)', sub, val)
    return mix(val)


def parse_color(c):
    c = c.strip()
    m = re.fullmatch(r'#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?', c)
    if m:
        h = m.group(1)
        a = int(m.group(2), 16) / 255 if m.group(2) else 1.0
        return [int(h[i:i + 2], 16) for i in (0, 2, 4)], a
    m = re.fullmatch(r'rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)', c)
    if m:
        return [int(float(m.group(i))) for i in (1, 2, 3)], float(m.group(4)) if m.group(4) else 1.0
    return None


def fmt_color(rgb, a):
    if a >= 0.999:
        return '#%02x%02x%02x' % tuple(rgb)
    return 'rgba(%d, %d, %d, %s)' % (*rgb, ('%.3f' % a).rstrip('0').rstrip('.'))


def mix(val):
    m = re.fullmatch(r'color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*transparent\)', val)
    if m:
        c = parse_color(m.group(1))
        if c:
            return fmt_color(c[0], c[1] * float(m.group(2)) / 100)
    c = parse_color(val)
    return fmt_color(*c) if c else val


def build():
    errors = []
    sem_sets = {}
    skins = {}
    for skin, label in SKINS.items():
        sv = skin_vars(skin)
        skins[skin] = {'name': label}
        for theme in THEMES:
            env = sv[theme]
            names = sorted(k for k in env if SEMANTIC.search(k))
            sem_sets[(skin, theme)] = set(names)
            vals = {}
            for k in names:
                try:
                    vals[k[2:]] = resolve(env[k], {**base_vars(), **env})
                except (KeyError, ValueError) as e:
                    errors.append('%s/%s %s：无法解析 %s' % (skin, theme, k, e))
            skins[skin][theme] = vals
    ref = sem_sets[('paper', 'light')]
    for key, s in sem_sets.items():
        if s != ref:
            errors.append('%s/%s 语义令牌与 paper/light 不一致：多 %s，少 %s' % (
                key[0], key[1], sorted(s - ref), sorted(ref - s)))
    data = {
        'meta': {
            'name': 'HelloTime Pro Design Tokens',
            'version': '2.0.0',
            'source': 'spec/styles/base.css + spec/styles/<skin>/tokens.css（语义层）',
            'note': '由 spec/styles/build_tokens.py 生成，请勿手改。CSS 是事实源；本文件给 JS / 原生客户端用。',
        },
        'base': {k[2:]: v for k, v in base_vars().items()},
        'skins': skins,
    }
    return data, errors


def main():
    data, errors = build()
    text = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if '--check' in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding='utf-8') != text:
            errors.append('spec/tokens/skins.json 不是最新的，请运行 python3 spec/styles/build_tokens.py')
        for e in errors:
            print('✗', e)
        print('✓ 令牌一致' if not errors else '✗ 共 %d 处问题' % len(errors))
        sys.exit(1 if errors else 0)
    if errors:
        for e in errors:
            print('✗', e)
        sys.exit(1)
    OUT.write_text(text, encoding='utf-8')
    n = len(next(iter(data['skins'].values()))['light'])
    print('✓ 已生成 %s：%d 个语义令牌 × 2 皮肤 × 2 主题' % (OUT.relative_to(ROOT.parent.parent), n))


if __name__ == '__main__':
    main()
