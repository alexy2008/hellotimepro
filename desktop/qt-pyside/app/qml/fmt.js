// 共享格式化库（= utils/format）。.pragma library 让多个 QML 复用同一实例。
.pragma library

function pad2(n) { return ("" + n).padStart(2, "0"); }

function countdownTo(iso, nowMs) {
    var t = Date.parse(iso);
    var now = nowMs || Date.now();
    if (isNaN(t)) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
    var diff = Math.max(0, Math.floor((t - now) / 1000));
    return {
        expired: t <= now,
        days: Math.floor(diff / 86400),
        hours: Math.floor((diff % 86400) / 3600),
        minutes: Math.floor((diff % 3600) / 60),
        seconds: diff % 60
    };
}

function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.getFullYear() + "年" + pad2(d.getMonth() + 1) + "月" + pad2(d.getDate()) + "日";
}

function fmtDateTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.getFullYear() + "年" + pad2(d.getMonth() + 1) + "月" + pad2(d.getDate()) + "日 " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

// d: Date 对象。距开启文案（向上取整分钟），= React DateTimePicker.formatDistance。
function formatDistance(d, nowMs) {
    var diffMin = Math.ceil((d.getTime() - (nowMs || Date.now())) / 60000);
    if (diffMin <= 0) return "已到开启时刻";
    if (diffMin < 60) return "距开启 " + diffMin + " 分钟";
    var hours = Math.floor(diffMin / 60), minutes = diffMin % 60;
    if (hours < 24) return "距开启 " + hours + " 小时" + (minutes ? " " + minutes + " 分钟" : "");
    var days = Math.floor(hours / 24), restH = hours % 24;
    if (days < 365) return "距开启 " + days + " 天" + (restH ? " " + restH + " 小时" : "");
    var years = Math.floor(days / 365), restD = days % 365;
    return "距开启 " + years + " 年" + (restD ? " " + restD + " 天" : "");
}

// d: Date。触发按钮展示（非零填充月/日）。
function formatDisplay(d) {
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日 " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

function isoFromLocal(d) { return new Date(d).toISOString(); }
