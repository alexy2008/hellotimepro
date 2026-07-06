// 通用格式化工具（倒计时 / 时间 / 数字）
// 移植自 mobile/react-native/src/utils/format.ts（TS → JS，逻辑零改动）。
// 差异：小程序无 Intl/toLocaleString 的完整实现（真机 iOS 尚可，安卓/工具端参差），
// 故 fmtDateTime / fmtDate / fmtNumber 改为手动拼装，语义与 zh-CN 一致且跨端稳定。

function pad2(n) {
  return String(n).padStart(2, "0");
}

function countdownTo(iso, now = Date.now()) {
  const target = new Date(iso).getTime();
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  return {
    expired: target <= now,
    totalSeconds: diff,
    days,
    hours,
    minutes,
    seconds,
  };
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

function fmtNumber(n) {
  // 千分位分组
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 把本地时间字符串（YYYY-MM-DDTHH:mm）转成 ISO（UTC）
function localInputToIso(local) {
  const d = new Date(local);
  return d.toISOString();
}

// 把 ISO 转成本地时间字符串（YYYY-MM-DDTHH:mm）
function isoToLocalInput(iso) {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

// 倒计时短文案（供列表/卡片）：expired → 已解封；否则 "N天 / N小时 / N分钟"
function countdownLabel(iso, now = Date.now()) {
  const c = countdownTo(iso, now);
  if (c.expired) return "已解封";
  if (c.days > 0) return `${c.days} 天后解封`;
  if (c.hours > 0) return `${c.hours} 小时后解封`;
  if (c.minutes > 0) return `${c.minutes} 分钟后解封`;
  return "即将解封";
}

module.exports = {
  pad2,
  countdownTo,
  countdownLabel,
  fmtDateTime,
  fmtDate,
  fmtNumber,
  localInputToIso,
  isoToLocalInput,
};
