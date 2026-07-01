// ============================================================
// 后端地址：RN 无 Vite 代理，fetch 直打后端（默认 :9080 反代）。
//
// - 模拟器可达宿主 localhost；真机需改为局域网 IP（经 EXPO_PUBLIC_API_BASE）。
// - 与 hello switch 切换的反代一致；也可直连某后端口：
//     EXPO_PUBLIC_API_BASE=http://192.168.1.10:9080 npx expo start
//   机制对齐 desktop/swiftui「直连不走代理」。
// ============================================================

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost:9080";
