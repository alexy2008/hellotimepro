import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // 禁用图片优化（教学项目用静态 SVG 即可）
  images: { unoptimized: true },
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Server Actions 默认启用；这里关掉自动 Body 限制以兼容稍大请求
  },
};

export default config;
