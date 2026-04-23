/**
 * seed-capsules.ts · 契约测试预置胶囊（M0 占位）
 *
 * 10 条胶囊，覆盖 5 种典型状态，便于测试枚举：
 *  - 1×  opened  + inPlaza=true  + 高收藏
 *  - 1×  opened  + inPlaza=true  + 中收藏
 *  - 1×  opened  + inPlaza=true  + 0 收藏
 *  - 1×  opened  + inPlaza=false                     （不上广场）
 *  - 2×  sealed  + inPlaza=true  + openAt in 10min   （还没到）
 *  - 2×  sealed  + inPlaza=false + openAt in 30d     （长期）
 *  - 1×  sealed  + inPlaza=true  + openAt in 61s     （边界临近）
 *  - 1×  sealed  + inPlaza=true  + openAt=now-1s     （应当惰性开启）
 *
 * M1 的 verify-contract.sh 会调用本模块：
 *   import { seed } from "./seed-capsules.ts";
 *   await seed(baseUrl, authTokens);
 */
export const CAPSULES: Array<{
  title: string;
  content: string;
  openAtOffsetSec: number;   // 相对"运行时现在"的偏移
  inPlaza: boolean;
  ownerNickname: "specter" | "neo";
  preFavorites: number;      // 预置收藏数（运行时模拟）
}> = [
  { title: "已开启 · 热门头条", content: "第一条跨越时光的问候。", openAtOffsetSec: -86400 * 30,  inPlaza: true,  ownerNickname: "neo",     preFavorites: 128 },
  { title: "已开启 · 中等热度", content: "一次普通的小记。",         openAtOffsetSec: -86400 * 10,  inPlaza: true,  ownerNickname: "specter", preFavorites:  42 },
  { title: "已开启 · 无人问津", content: "静静躺在广场角落。",       openAtOffsetSec: -86400 * 3,   inPlaza: true,  ownerNickname: "neo",     preFavorites:   0 },
  { title: "已开启但私有",     content: "只接受 8 位码访问。",       openAtOffsetSec: -86400 * 1,   inPlaza: false, ownerNickname: "specter", preFavorites:   5 },
  { title: "未开启 · 公开 a",   content: "公开，还在等。",            openAtOffsetSec:  600,         inPlaza: true,  ownerNickname: "neo",     preFavorites:   0 },
  { title: "未开启 · 公开 b",   content: "公开，还在等。",            openAtOffsetSec:  600,         inPlaza: true,  ownerNickname: "specter", preFavorites:   0 },
  { title: "未开启 · 私有长线 a", content: "30 天后的秘密。",         openAtOffsetSec:  86400 * 30,  inPlaza: false, ownerNickname: "neo",     preFavorites:   0 },
  { title: "未开启 · 私有长线 b", content: "30 天后的秘密。",         openAtOffsetSec:  86400 * 30,  inPlaza: false, ownerNickname: "specter", preFavorites:   0 },
  { title: "未开启 · 临界",     content: "差一点就开了。",            openAtOffsetSec:  61,          inPlaza: true,  ownerNickname: "neo",     preFavorites:   0 },
  { title: "未开启 · 应触发惰性开启", content: "边界测试用。",         openAtOffsetSec: -1,           inPlaza: true,  ownerNickname: "specter", preFavorites:   0 },
];

export async function seed(_baseUrl: string, _tokens: { specter: string; neo: string }): Promise<void> {
  throw new Error("seed() 待 M1 实现：调用 POST /capsules + POST /capsules/{id}/favorite");
}
