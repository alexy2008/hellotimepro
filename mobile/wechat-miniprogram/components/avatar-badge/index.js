// avatar-badge —— 头像徽章。
//
// 小程序 <image> 不支持渲染 SVG，故无法直接引用后端的
// /static/avatars/<id>.svg（其它原生端靠 SVGView/flutter_svg/react-native-svg
// 这类库直接渲染同一份远端 SVG）。这里改用 scripts/gen-avatars-miniprogram
// 预渲染好的本地 PNG（assets/avatars/<id>.png，与 spec/avatars 同源），
// <image> 直接加载，视觉上与其它端一致。
//
// 兜底：avatarId 不在内置 10 个头像之列（或 PNG 资产缺失未生成）时，
// <image> 加载失败触发 binderror → 回退到「品牌色底 + 首字」确定性徽章。

// 由字符串确定性派生一个品牌调性的 HSL 颜色（无 color 时兜底）。
function hashColor(seed) {
  let h = 0;
  const s = String(seed || "neo");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 62%, 55%)`;
}

function initial(name, avatarId) {
  const s = (name || avatarId || "?").trim();
  return s ? s[0].toUpperCase() : "?";
}

Component({
  properties: {
    name: { type: String, value: "" },
    avatarId: { type: String, value: "" },
    color: { type: String, value: "" },
    size: { type: Number, value: 40 },
  },
  data: { bg: "", ch: "", fontSize: 18, imgSrc: "", imgOk: true },
  observers: {
    "name,avatarId,color,size": function (name, avatarId, color, size) {
      this.setData({
        bg: color || hashColor(avatarId || name),
        ch: initial(name, avatarId),
        fontSize: Math.round(size * 0.42),
        // 每次 avatarId 变化都重置 imgOk：让新 id 重新尝试加载本地 PNG
        imgSrc: avatarId ? `/assets/avatars/${avatarId}.png` : "",
        imgOk: !!avatarId,
      });
    },
  },
  methods: {
    onImgError() {
      this.setData({ imgOk: false });
    },
  },
});
