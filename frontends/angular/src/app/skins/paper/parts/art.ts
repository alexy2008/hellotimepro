// ============================================================
// 「时笺」火漆的蜡滴轮廓：由种子随机生成，保证每次形状一致（模块级常量，只算一次）
// ============================================================

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blobPath(cx: number, cy: number, r: number, n: number, jitter: number, seed: number) {
  const rnd = mulberry(seed);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + (rnd() - 0.5) * 2 * jitter);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}

export const WAX_OUT = blobPath(50, 50, 46, 18, 0.055, 21);
export const WAX_IN = blobPath(50, 50, 43.5, 14, 0.03, 8);

/** 卡片 / 预览的短文：压成一行，超长加省略号 */
export const preview = (text: string | null | undefined, n = 78) => {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '……' : t;
};

/** 详情页启封动画的一帧：火漆状态、封舌是否掀起、信纸是否升起 */
export interface Opening {
  crack: 'whole' | 'split' | 'cracked';
  open: boolean;
  rising: boolean;
}

let uid = 0;
/** SVG 渐变 / 路径的 id：同一页面上有多枚火漆、邮戳时不能撞名 */
export const nextId = (prefix: string) => `${prefix}-${++uid}`;
