#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloTime Pro · 128×128 技术栈图标生成器（提案版，不替换 spec/icons）

设计语言：
  - 统一 128×128 画布，圆角"玻璃瓷砖"(squircle, rx=28) 作为家族框架
  - 瓷砖顶部统一柔光(sheen) + 1px 内描边，叠在每个图标上 → 一眼是一套
  - 内部图形为"原创几何重绘"：形态/配色贴近官方，但不复刻官方矢量文件
  - base = 品牌色瓷砖 或 深色玻璃瓷砖(dark)；少数用品牌渐变瓷砖
运行：python3 build.py  → 生成 *.svg + preview.html
"""
import os

OUT = os.path.dirname(os.path.abspath(__file__))

# 通用 defs：深色瓷砖渐变、顶部柔光、Kotlin/Ktor 品牌渐变
COMMON_DEFS = """
  <linearGradient id="d" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#20202e"/><stop offset="1" stop-color="#14141e"/>
  </linearGradient>
  <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity=".16"/>
    <stop offset=".5" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="kg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7f52ff"/><stop offset=".5" stop-color="#e44857"/>
    <stop offset="1" stop-color="#f88909"/>
  </linearGradient>
"""

FONT = 'font-family="system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"'

def text(s, y, size, fill, weight=800, extra=""):
    return ('<text x="64" y="%g" text-anchor="middle" %s font-weight="%s" '
            'font-size="%g" fill="%s" %s>%s</text>') % (y, FONT, weight, size, fill, extra, s)

# 每个图标：id -> (base, glyph)
#   base: 十六进制品牌色 / "dark" 深色瓷砖 / "kg" 品牌渐变
ICONS = {}

# ───────────────────────── 语言 ─────────────────────────
ICONS["python"] = ("dark", """
  <defs>
    <linearGradient id="pa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4584b6"/><stop offset="1" stop-color="#2d6093"/></linearGradient>
    <linearGradient id="pb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe873"/><stop offset="1" stop-color="#ffd43b"/></linearGradient>
  </defs>
  <g transform="translate(64,64) scale(4.55) translate(-12,-12)">
    <path d="M12 2 C 8 2 6 4 6 7 L 6 10 L 12 10 L 12 11 L 4 11 C 2 11 2 14 2 16 L 2 17 C 2 19 4 20 6 20 L 8 20 L 8 17 C 8 15 10 14 12 14 L 16 14 C 17 14 18 13 18 12 L 18 7 C 18 4 16 2 12 2 Z M 9 5 A 1.1 1.1 0 0 1 9 7 A 1.1 1.1 0 0 1 9 5 Z" fill="url(#pa)"/>
    <path d="M12 22 C 16 22 18 20 18 17 L 18 14 L 12 14 L 12 13 L 20 13 C 22 13 22 10 22 8 L 22 7 C 22 5 20 4 18 4 L 16 4 L 16 7 C 16 9 14 10 12 10 L 8 10 C 7 10 6 11 6 12 L 6 17 C 6 20 8 22 12 22 Z M 15 19 A 1.1 1.1 0 0 0 15 17 A 1.1 1.1 0 0 0 15 19 Z" fill="url(#pb)"/>
  </g>
""")

ICONS["typescript"] = ("#3178c6", text("TS", 90, 58, "#fff", 700, 'letter-spacing="-1"'))
ICONS["javascript"] = ("#f7df1e", text("JS", 96, 58, "#1a1a1a", 800, 'letter-spacing="-1"'))

ICONS["java"] = ("dark", """
  <g stroke="#e76f00" stroke-width="5" fill="none" stroke-linecap="round" opacity=".95">
    <path d="M56 20 C 64 28 50 34 58 44"/>
    <path d="M70 16 C 78 26 62 32 72 44"/>
  </g>
  <path d="M40 52 H88 V64 C88 76 78 84 64 84 C50 84 40 76 40 64 Z" fill="#5382a1"/>
  <path d="M88 56 C 98 56 100 68 90 72" fill="none" stroke="#5382a1" stroke-width="5"/>
  <ellipse cx="64" cy="96" rx="30" ry="7" fill="#5382a1"/>
""")

# Kotlin 官方标志：带右向缺口的渐变方块（非字母 K）
ICONS["kotlin"] = ("dark", """
  <path d="M100 100 H28 V28 H100 L64 64 Z" fill="url(#kg)"/>
""")

ICONS["go"] = ("#00add8", """
  <g fill="#fff">
    <circle cx="34" cy="56" r="3.4"/><circle cx="34" cy="68" r="3.4"/><circle cx="34" cy="80" r="3.4"/>
  </g>
  <text x="74" y="86" text-anchor="middle" %s font-weight="800" font-size="46" fill="#fff" font-style="italic" letter-spacing="-1">Go</text>
""" % FONT)

# Rust 官方标志：齿轮(cog) + 中心 R
_rust_teeth = "".join(
    '<g transform="rotate(%d 64 64)"><rect x="59" y="14" width="10" height="14" rx="2.5" fill="#e8e8ee"/></g>' % (i * 30)
    for i in range(12))
ICONS["rust"] = ("dark", """
  %s
  <circle cx="64" cy="64" r="40" fill="#e8e8ee"/>
  <circle cx="64" cy="64" r="27" fill="url(#d)"/>
  <g fill="url(#d)">
    <circle cx="64" cy="29" r="3.4"/><circle cx="89" cy="46" r="3.4"/><circle cx="89" cy="82" r="3.4"/>
    <circle cx="64" cy="99" r="3.4"/><circle cx="39" cy="82" r="3.4"/><circle cx="39" cy="46" r="3.4"/>
  </g>
  <text x="64" y="75" text-anchor="middle" %s font-weight="900" font-size="30" fill="#e8e8ee">R</text>
""" % (_rust_teeth, FONT))

ICONS["csharp"] = ("#512bd4", text("C#", 82, 46, "#fff", 800, 'letter-spacing="-1"'))
ICONS["cpp"]    = ("#00599c", text("C++", 80, 40, "#fff", 800, 'letter-spacing="-1"'))

ICONS["swift"] = ("#f05138", """
  <g transform="translate(64,64) scale(4.6) translate(-12,-12)">
    <path d="M16 5 C 19 8 20 12 19 16 C 17 14 15 13 12 13 C 10 13 8 14 6 15 C 8 13 11 12 14 13 C 12 11 9 9 6 8 C 10 8 13 10 16 12 C 14 9 11 7 8 6 C 12 6 15 7 17 9 Z" fill="#fff"/>
  </g>
""")

ICONS["ruby"] = ("dark", """
  <defs><linearGradient id="rb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2483a"/><stop offset="1" stop-color="#b31b12"/></linearGradient></defs>
  <path d="M40 40 H88 L104 60 L64 106 L24 60 Z" fill="url(#rb)"/>
  <g stroke="#ffffff" stroke-width="1.6" opacity=".5" fill="none">
    <path d="M40 40 L52 60 L24 60 M88 40 L76 60 L104 60 M52 60 H76 M52 60 L64 106 L76 60 M40 40 L64 60 L88 40 M64 40 V60"/>
  </g>
""")

ICONS["php"] = ("dark", """
  <ellipse cx="64" cy="64" rx="44" ry="27" fill="#777bb4"/>
  <ellipse cx="64" cy="64" rx="44" ry="27" fill="none" stroke="#9a9ed0" stroke-width="1.5" opacity=".6"/>
  <text x="64" y="74" text-anchor="middle" %s font-weight="800" font-style="italic" font-size="30" fill="#23252f">php</text>
""" % FONT)

# ───────────────────────── 后端框架 ─────────────────────────
ICONS["fastapi"] = ("#009688", """
  <circle cx="64" cy="64" r="40" fill="none" stroke="#fff" stroke-width="4" opacity=".55"/>
  <path d="M70 26 L40 70 L60 70 L58 102 L88 58 L66 58 Z" fill="#fff"/>
""")

# Spring 标志性绿叶：叶身 + 叶脉 + 卷茎
ICONS["springboot"] = ("dark", """
  <path d="M96 32 C 60 30 32 52 32 84 C 32 90 34 96 38 100 C 40 78 56 60 84 52 C 62 64 50 82 50 100 C 74 100 96 80 96 50 Z" fill="#6db33f"/>
  <path d="M50 100 C 40 96 34 88 34 78" fill="none" stroke="#6db33f" stroke-width="6" stroke-linecap="round"/>
  <path d="M84 52 C 66 60 56 74 52 92" fill="none" stroke="#bfe9a0" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
""")

# Gin：鸡尾酒杯（杯型 + 液面线 + 顶部点缀），沿用原版青底白杯
ICONS["gin"] = ("#00acd7", """
  <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M36 40 L92 40 L64 72 Z"/>
    <line x1="64" y1="72" x2="64" y2="94"/>
    <line x1="46" y1="96" x2="82" y2="96"/>
  </g>
  <line x1="48" y1="50" x2="80" y2="50" stroke="#fff" stroke-width="3.2" opacity=".7" stroke-linecap="round"/>
  <circle cx="64" cy="28" r="4.5" fill="#fff"/>
""")

# Elysia：干净的粉紫渐变叶片（呼应"叶羊"海蛞蝓）
ICONS["elysia"] = ("dark", """
  <defs><linearGradient id="el" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ec2"/><stop offset="1" stop-color="#a86bff"/></linearGradient></defs>
  <path d="M64 24 C 92 42 92 86 64 104 C 36 86 36 42 64 24 Z" fill="url(#el)"/>
  <g stroke="#fff" fill="none" stroke-linecap="round" opacity=".7">
    <path d="M64 32 V98" stroke-width="3"/>
    <path d="M64 52 L82 44 M64 68 L84 62 M64 84 L80 80 M64 52 L46 44 M64 68 L44 62 M64 84 L48 80" stroke-width="2.2"/>
  </g>
""")

ICONS["nestjs"] = ("#e0234e", """
  <g transform="translate(64,64) scale(4.6) translate(-12,-12)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">
    <path d="M7 14.5 C 5.8 13 5.5 11 6 9.2 C 6.6 7 8.3 5.3 10.5 4.5 L 14 3 C 16.5 2.3 19 3.5 20.5 5.5"/>
    <path d="M17 9.5 C 18.2 11 18.5 13 18 14.8 C 17.4 17 15.7 18.7 13.5 19.5 L 10 21 C 7.5 21.7 5 20.5 3.5 18.5"/>
  </g>
""")

ICONS["aspnet"] = ("#512bd4", text(".NET", 76, 30, "#fff", 800) + text("ASP.NET Core", 96, 11, "#c9bbff", 700))
ICONS["dotnet"] = ("#512bd4", text(".NET", 80, 34, "#fff", 800))

ICONS["vapor"] = ("dark", """
  <defs><linearGradient id="vp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5bb0ec"/><stop offset="1" stop-color="#2c74c2"/></linearGradient></defs>
  <path d="M64 24 C 64 24 92 58 92 80 A 28 28 0 0 1 36 80 C 36 58 64 24 64 24 Z" fill="url(#vp)"/>
  <path d="M54 64 C 50 72 52 82 60 86" stroke="#cfe8ff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
""")

# Axum：字母 "A" 标识（沿用原始设计，琥珀底 + 深色 A）
ICONS["axum"] = ("#f7b500", """
  <g transform="scale(5.333)">
    <path d="M6 20 L 12 4 L 18 20 L 15 20 L 13.5 16 L 10.5 16 L 9 20 Z M 11 13.5 L 13 13.5 L 12 10.5 Z" fill="#19151c"/>
  </g>
""")

# Drogon：盘绕龙身剪影（红底白龙 + 小眼），去卡通化
ICONS["drogon"] = ("#cc0000", """
  <g transform="scale(5.333)">
    <path d="M4 14 C 4 10 8 6 12 6 C 16 6 20 9 20 13 C 20 16 18 18 14 17 C 11 16 9 13 9 11 C 11 12 13 13 15 12 C 16 11 15 9 13 9 C 11 9 10 10 9 12 C 8 14 7 15 5 16 Z" fill="#fff"/>
    <circle cx="17" cy="11" r="1" fill="#cc0000"/>
  </g>
""")

# Ktor：渐变 "K"（竖杠 + 双箭臂）
ICONS["ktor"] = ("dark", """
  <g fill="url(#kg)">
    <rect x="32" y="30" width="13" height="68" rx="3"/>
    <path d="M51 64 L90 30 L90 50 L70 64 L90 78 L90 98 Z"/>
  </g>
""")

# ───────────────────────── 前端 ─────────────────────────
ICONS["react"] = ("dark", """
  <g fill="none" stroke="#61dafb" stroke-width="4.2">
    <ellipse cx="64" cy="64" rx="44" ry="16.5"/>
    <ellipse cx="64" cy="64" rx="44" ry="16.5" transform="rotate(60 64 64)"/>
    <ellipse cx="64" cy="64" rx="44" ry="16.5" transform="rotate(120 64 64)"/>
  </g>
  <circle cx="64" cy="64" r="8" fill="#61dafb"/>
""")

ICONS["vue"] = ("dark", """
  <path d="M16 36 L40 36 L64 78 L88 36 L112 36 L64 112 Z" fill="#42b883"/>
  <path d="M40 36 L52 36 L64 57 L76 36 L88 36 L64 78 Z" fill="#35495e"/>
""")

ICONS["angular"] = ("dark", """
  <defs><linearGradient id="ng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e40035"/><stop offset="1" stop-color="#c3002f"/></linearGradient></defs>
  <path d="M64 16 L110 32 L102 92 L64 112 L26 92 L18 32 Z" fill="url(#ng)"/>
  <path d="M64 16 L110 32 L102 92 L64 112 Z" fill="#b3002b" opacity=".55"/>
  <path d="M64 30 L36 94 L47 94 L52.5 80 L75.5 80 L81 94 L92 94 Z M56 71 L64 50 L72 71 Z" fill="#fff"/>
""")

# Svelte：描边式 "S" 飘带（避免实心糊成一坨）
ICONS["svelte"] = ("#ff3e00", """
  <path d="M83 50 C 83 38 65 33 52 41 C 41 47 43 60 58 65 C 71 69 73 80 63 87 C 51 95 37 90 35 78"
        fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
""")

ICONS["solidjs"] = ("dark", """
  <defs><linearGradient id="sl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#76b3e1"/><stop offset=".5" stop-color="#4f88c6"/><stop offset="1" stop-color="#2c4f7c"/></linearGradient></defs>
  <g fill="none" stroke="url(#sl)" stroke-width="9" stroke-linecap="round">
    <path d="M26 50 C 44 38 84 40 102 52 C 86 50 62 50 44 56"/>
    <path d="M26 70 C 44 58 84 60 102 72 C 86 70 62 70 44 76"/>
  </g>
  <ellipse cx="64" cy="86" rx="26" ry="8" fill="url(#sl)" opacity=".85"/>
""")

# ───────────────────────── 全栈 ─────────────────────────
ICONS["nextjs"] = ("#0a0a0a", """
  <circle cx="64" cy="64" r="44" fill="#0a0a0a"/>
  <circle cx="64" cy="64" r="44" fill="none" stroke="#3a3a3a" stroke-width="1.5"/>
  <path d="M44 40 L44 88 L52 88 L52 54 L86 96 L92 90 L52 40 Z" fill="#fff"/>
  <rect x="82" y="40" width="8" height="34" fill="#fff"/>
""")

ICONS["nuxt"] = ("dark", """
  <path d="M64 32 L104 100 L84 100 L64 66 L44 100 L24 100 Z" fill="#00dc82"/>
  <path d="M86 66 L108 100 L92 100 L78 76 Z" fill="#00dc82" opacity=".55"/>
""")

ICONS["laravel"] = ("#ff2d20", """
  <g transform="translate(64,64) scale(4.6) translate(-12,-12)" fill="none" stroke="#fff" stroke-width="1.3" stroke-linejoin="round">
    <path d="M4 6 L 4 16 L 12 20 L 20 16 L 20 8 L 14 5 L 8 8 L 8 16 L 12 18 L 16 16 L 16 11 L 12 9 L 10 10 L 10 14"/>
  </g>
""")

ICONS["rails"] = ("#d30001", """
  <path d="M28 92 C 36 64 58 48 96 48 L 96 60 C 66 60 48 72 42 92 Z" fill="#fff"/>
  <path d="M44 92 C 50 74 64 64 88 64 L 88 74 C 70 74 58 82 54 92 Z" fill="#ffd2d2" opacity=".8"/>
  <text x="64" y="40" text-anchor="middle" %s font-weight="800" font-size="20" fill="#fff" letter-spacing="-.5">Rails</text>
""" % FONT)

# ───────────────────────── 运行时 ─────────────────────────
ICONS["nodejs"] = ("dark", """
  <defs><linearGradient id="nd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#83cd29"/><stop offset="1" stop-color="#3c873a"/></linearGradient></defs>
  <path d="M64 22 L100 43 L100 85 L64 106 L28 85 L28 43 Z" fill="url(#nd)"/>
  <text x="64" y="72" text-anchor="middle" %s font-weight="800" font-size="20" fill="#0e2a14">node</text>
""" % FONT)

ICONS["bun"] = ("dark", """
  <defs><radialGradient id="bn" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fbf6e9"/><stop offset="1" stop-color="#efe6cf"/></radialGradient></defs>
  <ellipse cx="64" cy="68" rx="40" ry="33" fill="url(#bn)"/>
  <ellipse cx="58" cy="40" rx="13" ry="9" fill="#fbf6e9" transform="rotate(-24 58 40)"/>
  <circle cx="52" cy="66" r="4.5" fill="#1b1b1b"/><circle cx="76" cy="66" r="4.5" fill="#1b1b1b"/>
  <ellipse cx="46" cy="76" rx="6" ry="4" fill="#f7b6bf" opacity=".75"/><ellipse cx="82" cy="76" rx="6" ry="4" fill="#f7b6bf" opacity=".75"/>
  <path d="M58 76 Q 64 82 70 76" stroke="#1b1b1b" stroke-width="3" fill="none" stroke-linecap="round"/>
""")

# ───────────────────────── 数据库 / 样式 ─────────────────────────
# PostgreSQL：Slonik 大象头（小眼 + 眉弓 + 侧向象鼻），去卡通化
ICONS["postgresql"] = ("dark", """
  <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f7da6"/><stop offset="1" stop-color="#2d597f"/></linearGradient></defs>
  <path d="M40 58 C 38 40 49 30 63 30 C 77 30 88 40 86 58
           C 95 52 103 58 99 68 C 95 77 87 75 82 68
           C 80 81 73 88 63 88 C 53 88 46 81 44 68
           C 39 75 31 77 27 68 C 23 58 31 52 40 58 Z" fill="url(#pg)"/>
  <path d="M57 84 C 54 96 58 108 69 108 C 75 108 77 101 74 95 C 72 90 70 88 70 84 Z" fill="url(#pg)"/>
  <circle cx="54" cy="59" r="3.1" fill="#e9f2f9"/><circle cx="54" cy="59.5" r="1.4" fill="#1a3a55"/>
  <circle cx="72" cy="59" r="3.1" fill="#e9f2f9"/><circle cx="72" cy="59.5" r="1.4" fill="#1a3a55"/>
  <path d="M49 52 Q 54 49 59 52 M67 52 Q 72 49 77 52" stroke="#264f73" stroke-width="2.4" fill="none" stroke-linecap="round"/>
""")

ICONS["sqlite"] = ("dark", """
  <defs><linearGradient id="sq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#36a3e0"/><stop offset="1" stop-color="#0f6bbd"/></linearGradient></defs>
  <ellipse cx="64" cy="38" rx="34" ry="11" fill="url(#sq)"/>
  <path d="M30 38 V90 C 30 96 45 101 64 101 C 83 101 98 96 98 90 V38" fill="url(#sq)"/>
  <ellipse cx="64" cy="38" rx="34" ry="11" fill="none" stroke="#bce4fb" stroke-width="2" opacity=".7"/>
  <path d="M58 92 C 58 70 64 52 86 40 C 70 56 68 76 70 92 Z" fill="#eaf6ff" opacity=".9"/>
""")

ICONS["tailwindcss"] = ("dark", """
  <defs><linearGradient id="tw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2ad0ff"/><stop offset="1" stop-color="#1597d6"/></linearGradient></defs>
  <path d="M40 50 C 48 38 58 38 66 48 C 72 55 78 58 86 55 C 80 67 70 67 62 57 C 56 50 50 47 40 50 Z" fill="url(#tw)" transform="translate(-6,-6)"/>
  <path d="M40 50 C 48 38 58 38 66 48 C 72 55 78 58 86 55 C 80 67 70 67 62 57 C 56 50 50 47 40 50 Z" fill="url(#tw)" transform="translate(14,16)"/>
""")

# Hibernate：干净的金棕 "h" 字标
ICONS["hibernate"] = ("dark", """
  <defs><linearGradient id="hb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8be86"/><stop offset="1" stop-color="#a08a54"/></linearGradient></defs>
  <path d="M44 26 V102 M44 62 C 50 52 62 50 72 56 C 80 61 84 70 84 82 V102" fill="none" stroke="url(#hb)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
""")

# ──────────────────────────────────────────────────────────────
TILE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="%s">
<defs>%s</defs>
<rect x="4" y="4" width="120" height="120" rx="28" fill="%s"/>
%s
<rect x="4" y="4" width="120" height="120" rx="28" fill="url(#s)"/>
<rect x="4.5" y="4.5" width="119" height="119" rx="27.5" fill="none" stroke="#ffffff" stroke-opacity=".14" stroke-width="1"/>
</svg>
"""

def base_fill(base):
    if base == "dark": return "url(#d)"
    if base == "kg":   return "url(#kg)"
    return base

def build():
    for name, (base, glyph) in ICONS.items():
        svg = TILE % (name, COMMON_DEFS, base_fill(base), glyph.strip())
        with open(os.path.join(OUT, name + ".svg"), "w") as f:
            f.write(svg)
    print("wrote %d icons" % len(ICONS))
    write_gallery()

GROUPS = [
    ("语言 · Languages", ["python","typescript","javascript","java","kotlin","go","rust","csharp","cpp","swift","ruby","php"]),
    ("后端框架 · Backend", ["fastapi","springboot","gin","elysia","nestjs","aspnet","vapor","axum","drogon","ktor"]),
    ("前端 · Frontend", ["react","vue","angular","svelte","solidjs"]),
    ("全栈 · Full-stack", ["nextjs","nuxt","laravel","rails"]),
    ("运行时 · Runtime", ["nodejs","bun","dotnet"]),
    ("数据库 / 样式 · DB & Styling", ["postgresql","sqlite","tailwindcss","hibernate"]),
]

def write_gallery():
    cards = []
    for title, ids in GROUPS:
        items = ""
        for i in ids:
            items += (
              '<div class="card">'
              '<div class="big"><img src="%s.svg" alt="%s"></div>'
              '<div class="cmp"><span class="lab">旧 24px</span>'
              '<img class="old" src="../spec/icons/%s.svg" alt="old"></div>'
              '<div class="name">%s</div></div>') % (i, i, i, i)
        cards.append('<section><h2>%s</h2><div class="grid">%s</div></section>' % (title, items))
    html = """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>128px 图标提案 · HelloTime Pro</title>
<style>
:root{--bg:#0c0c14;--panel:#15151f;--line:rgba(255,255,255,.1);--text:#e9e9f2;--muted:#9a9ab0;--brand:#8467ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);
font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:40px 28px 80px}
header{max-width:1100px;margin:0 auto 8px}h1{font-size:28px;margin:0 0 6px;
background:linear-gradient(90deg,#a58eff,#ff7eb9);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:var(--muted);margin:0 0 24px;max-width:760px;line-height:1.6}
section{max-width:1100px;margin:0 auto 34px}
h2{font-size:15px;color:#c8c8da;border-left:3px solid var(--brand);padding-left:10px;margin:26px 0 16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 12px;text-align:center}
.big img{width:104px;height:104px;display:block;margin:0 auto;filter:drop-shadow(0 6px 16px rgba(0,0,0,.4))}
.cmp{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;
padding-top:10px;border-top:1px dashed var(--line)}
.lab{font-size:10px;color:var(--muted)}
.old{width:34px;height:34px;background:#fff;border-radius:7px;padding:4px;image-rendering:auto}
.name{margin-top:10px;font-size:13px;color:#d6d6e6;font-weight:600}
.note{max-width:1100px;margin:0 auto 26px;background:rgba(132,103,255,.1);
border:1px solid rgba(132,103,255,.3);border-radius:12px;padding:14px 18px;font-size:13px;color:#c9c2ee;line-height:1.7}
</style></head><body>
<header><h1>128×128 图标提案</h1>
<p class="sub">统一"玻璃瓷砖"家族框架 · 更精致 · 形态与配色更贴近官方(原创几何重绘,非复刻官方矢量) · 与现有 24px 并排对比。<br>这是<b>提案</b>,未替换 <code>spec/icons/</code>。</p>
<div class="note">每张卡片上方为新版 128px(渲染在 104px),下方"旧 24px"为现有图标放大到 34px(白底)做对照。看完告诉我哪些满意、哪些要调,确认后再决定是否回填到 spec/icons 与各实现。</div>
</header>
%s
</body></html>""" % "\n".join(cards)
    with open(os.path.join(OUT, "preview.html"), "w") as f:
        f.write(html)
    print("wrote preview.html")

if __name__ == "__main__":
    build()
