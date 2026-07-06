// 头像 / 图标 URL 解析：指向当前后端 /static/avatars|icons/<id>.svg。
// 移植自 mobile/react-native/src/utils/avatar.ts。
//
// ⚠️ 小程序 <image> 不认 SVG（仅 jpg/png/webp/gif/base64），故本端不直接
//    渲染远端 SVG，而是用后端 avatar 元数据里的 primaryColor 画一个「色底 + 首字」
//    的占位徽章（见 components/avatar-badge）。这些 URL 仅在需要原图时备用。

const { API_BASE } = require("../config");

function avatarUrl(avatarId) {
  const id = avatarId || "neo";
  return `${API_BASE}/static/avatars/${id}.svg`;
}

function iconUrl(name) {
  return `${API_BASE}/static/icons/${name}.svg`;
}

module.exports = { avatarUrl, iconUrl };
