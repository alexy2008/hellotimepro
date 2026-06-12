// UI 原型的少量交互：主题切换 + 片段切换 tabs
// 仅服务于静态页面演示；生产实现由各前端替代

(function () {
  const THEME_KEY = "hellotime-pro:theme";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }

  function initTheme() {
    let theme;
    try {
      theme = localStorage.getItem(THEME_KEY);
    } catch {}
    if (!theme) {
      theme = window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    applyTheme(theme);
  }

  function wireToggles() {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next =
          document.documentElement.getAttribute("data-theme") === "dark"
            ? "light"
            : "dark";
        applyTheme(next);
        btn.querySelector("[data-theme-toggle-icon]")?.replaceChildren(
          document.createTextNode(next === "dark" ? "☾" : "☀"),
        );
      });
    });
  }

  function wireSegments() {
    document.querySelectorAll("[data-seg]").forEach((group) => {
      group.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          group
            .querySelectorAll("button")
            .forEach((b) => b.classList.remove("cy-seg__active"));
          btn.classList.add("cy-seg__active");
        });
      });
    });
  }

  function wireFavorites() {
    document.querySelectorAll("[data-fav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("is-active");
      });
    });
  }

  function wireUserDropdown() {
    document.querySelectorAll(".cy-user-chip--button").forEach((btn) => {
      const menu = btn.closest(".cy-user-menu");
      const dropdown = menu?.querySelector(".cy-user-dropdown");
      if (!dropdown) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = dropdown.style.display !== "none" && dropdown.style.display !== "";
        dropdown.style.display = open ? "none" : "block";
        btn.setAttribute("aria-expanded", String(!open));
      });
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".cy-user-dropdown").forEach((d) => {
        d.style.display = "none";
        d.closest(".cy-user-menu")?.querySelector("[aria-expanded]")?.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ----------------- 自定义日期时间选择器 -----------------
  function initCustomDateTimePicker() {
    const wrapper = document.getElementById("datetime-wrapper");
    if (!wrapper) return;

    const trigger = document.getElementById("open_at_trigger");
    const picker = document.getElementById("datetime-picker");
    const nativeInput = document.getElementById("open_at");
    const triggerText = document.getElementById("open_at_text");
    const triggerBadge = document.getElementById("open_at_relative_badge");
    const monthYearLabel = document.getElementById("month-year-label");
    const daysGrid = document.getElementById("calendar-days-grid");
    const prevMonthBtn = document.getElementById("prev-month-btn");
    const nextMonthBtn = document.getElementById("next-month-btn");
    const hourCol = document.getElementById("hour-col");
    const minuteCol = document.getElementById("minute-col");
    const relativeTimeInfo = document.getElementById("picker-relative-time-info");
    const cancelBtn = document.getElementById("picker-cancel-btn");
    const confirmBtn = document.getElementById("picker-confirm-btn");

    let now = new Date();
    let selectedDate = new Date();
    // 默认设为 1 小时后，且分钟对齐到 5 分钟
    selectedDate.setHours(selectedDate.getHours() + 1);
    selectedDate.setMinutes(Math.round(selectedDate.getMinutes() / 5) * 5);
    selectedDate.setSeconds(0);
    selectedDate.setMilliseconds(0);

    let viewYear = selectedDate.getFullYear();
    let viewMonth = selectedDate.getMonth(); // 0-11

    // 生成小时列表 (00-23)
    for (let h = 0; h < 24; h++) {
      const hStr = String(h).padStart(2, "0");
      const item = document.createElement("div");
      item.className = "cy-time-item";
      item.textContent = hStr;
      item.dataset.value = h;
      hourCol.appendChild(item);
    }

    // 生成分钟列表 (00-59)
    for (let m = 0; m < 60; m++) {
      const mStr = String(m).padStart(2, "0");
      const item = document.createElement("div");
      item.className = "cy-time-item";
      item.textContent = mStr;
      item.dataset.value = m;
      minuteCol.appendChild(item);
    }

    // 展开/收起面板
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = picker.style.display !== "none" && picker.style.display !== "";
      if (isVisible) {
        hidePicker();
      } else {
        showPicker();
      }
    });

    picker.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    document.addEventListener("click", () => {
      hidePicker();
    });

    cancelBtn.addEventListener("click", () => {
      hidePicker();
    });

    confirmBtn.addEventListener("click", () => {
      saveValue();
      hidePicker();
    });

    function showPicker() {
      // 关掉其他可能打开的下拉单 (例如用户头像菜单)
      document.querySelectorAll(".cy-user-dropdown").forEach((d) => d.style.display = "none");
      
      picker.style.display = "flex";
      trigger.classList.add("is-active");
      now = new Date();
      
      // 同步滚轮选中态
      scrollToTime(selectedDate.getHours(), selectedDate.getMinutes());
      renderCalendar();
      updateRelativeInfo();
    }

    function hidePicker() {
      picker.style.display = "none";
      trigger.classList.remove("is-active");
    }

    // 滚动定位时间
    function scrollToTime(h, m) {
      setTimeout(() => {
        const hItem = hourCol.children[h];
        if (hItem) {
          hourCol.scrollTop = hItem.offsetTop - hourCol.offsetTop - 72;
          updateSelectedTimeItem(hourCol, h);
        }
        const mItem = minuteCol.children[m];
        if (mItem) {
          minuteCol.scrollTop = mItem.offsetTop - minuteCol.offsetTop - 72;
          updateSelectedTimeItem(minuteCol, m);
        }
      }, 10);
    }

    function updateSelectedTimeItem(col, value) {
      col.querySelectorAll(".cy-time-item").forEach((item) => {
        if (parseInt(item.dataset.value) === value) {
          item.classList.add("is-selected");
        } else {
          item.classList.remove("is-selected");
        }
      });
    }

    // 绑定滚轮滚动事件（磁吸效果）
    function handleColScroll(col, unit) {
      let scrollTimeout;
      col.addEventListener("scroll", () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          const colCenter = col.scrollTop + 90; // 高度的一半
          let closestItem = null;
          let minDiff = Infinity;
          
          Array.from(col.children).forEach((item) => {
            const itemCenter = item.offsetTop - col.offsetTop + 18; // 项高的一半
            const diff = Math.abs(colCenter - itemCenter);
            if (diff < minDiff) {
              minDiff = diff;
              closestItem = item;
            }
          });

          if (closestItem) {
            const val = parseInt(closestItem.dataset.value);
            if (unit === "hour") {
              selectedDate.setHours(val);
            } else {
              selectedDate.setMinutes(val);
            }
            updateSelectedTimeItem(col, val);
            updateRelativeInfo();
          }
        }, 100);
      });
    }

    handleColScroll(hourCol, "hour");
    handleColScroll(minuteCol, "minute");

    // 点击某一项直接滚动到它
    hourCol.addEventListener("click", (e) => {
      const item = e.target.closest(".cy-time-item");
      if (item) {
        const val = parseInt(item.dataset.value);
        selectedDate.setHours(val);
        scrollToTime(val, selectedDate.getMinutes());
        updateRelativeInfo();
      }
    });

    minuteCol.addEventListener("click", (e) => {
      const item = e.target.closest(".cy-time-item");
      if (item) {
        const val = parseInt(item.dataset.value);
        selectedDate.setMinutes(val);
        scrollToTime(selectedDate.getHours(), val);
        updateRelativeInfo();
      }
    });

    // 日历月份切换
    prevMonthBtn.addEventListener("click", () => {
      viewMonth--;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
      }
      renderCalendar();
    });

    nextMonthBtn.addEventListener("click", () => {
      viewMonth++;
      if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
      }
      renderCalendar();
    });

    // 渲染日历网格
    function renderCalendar() {
      monthYearLabel.textContent = `${viewYear} 年 ${viewMonth + 1} 月`;
      daysGrid.innerHTML = "";

      const firstDay = new Date(viewYear, viewMonth, 1).getDay();
      const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();
      const prevLastDate = new Date(viewYear, viewMonth, 0).getDate();

      const today = new Date();
      today.setHours(0,0,0,0);

      // 上个月的补全
      for (let i = firstDay - 1; i >= 0; i--) {
        const dayNum = prevLastDate - i;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cy-calendar-day cy-calendar-day--other-month";
        btn.textContent = dayNum;
        btn.disabled = true;
        daysGrid.appendChild(btn);
      }

      // 当月的天数
      for (let day = 1; day <= lastDate; day++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cy-calendar-day";
        btn.textContent = day;

        const thisDate = new Date(viewYear, viewMonth, day);
        
        // 限制不能选今天之前的过去时间
        const compareDate = new Date(viewYear, viewMonth, day);
        compareDate.setHours(23, 59, 59, 999);
        if (compareDate < now) {
          btn.disabled = true;
        }

        // 高亮选中
        if (selectedDate.getFullYear() === viewYear &&
            selectedDate.getMonth() === viewMonth &&
            selectedDate.getDate() === day) {
          btn.classList.add("is-selected");
        }

        // 高亮今天
        if (today.getFullYear() === thisDate.getFullYear() &&
            today.getMonth() === thisDate.getMonth() &&
            today.getDate() === day) {
          btn.classList.add("is-today");
        }

        btn.addEventListener("click", () => {
          selectedDate.setFullYear(viewYear);
          selectedDate.setMonth(viewMonth);
          selectedDate.setDate(day);
          
          daysGrid.querySelectorAll(".cy-calendar-day").forEach((b) => b.classList.remove("is-selected"));
          btn.classList.add("is-selected");
          updateRelativeInfo();
        });

        daysGrid.appendChild(btn);
      }

      // 下个月的补全
      const totalCells = daysGrid.children.length;
      const nextDays = totalCells <= 35 ? 35 - totalCells : 42 - totalCells;
      for (let day = 1; day <= nextDays; day++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cy-calendar-day cy-calendar-day--other-month";
        btn.textContent = day;
        btn.disabled = true;
        daysGrid.appendChild(btn);
      }
    }

    // 计算相对时间的友好展示文字
    function getRelativeTimeString(targetDate) {
      const diffMs = targetDate - new Date();
      if (diffMs < 0) {
        return "时间已过";
      }

      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) {
        return `${diffSecs} 秒后`;
      }
      if (diffMins < 60) {
        return `${diffMins} 分钟后`;
      }
      if (diffHours < 24) {
        return `${diffHours} 小时后`;
      }
      if (diffDays < 30) {
        return `${diffDays} 天后`;
      }
      
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths < 12) {
        const remainingDays = diffDays % 30;
        return remainingDays > 0 ? `${diffMonths} 个月 ${remainingDays} 天后` : `${diffMonths} 个月后`;
      }

      const diffYears = Math.floor(diffMonths / 12);
      const remainingMonths = diffMonths % 12;
      return remainingMonths > 0 ? `${diffYears} 年 ${remainingMonths} 个月后` : `${diffYears} 年后`;
    }

    function updateRelativeInfo() {
      const relStr = getRelativeTimeString(selectedDate);
      relativeTimeInfo.innerHTML = `⏳ 解锁倒计时：<span style="color: var(--color-signal-primary); font-weight: bold;">${relStr}</span>`;
    }

    function saveValue() {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const date = String(selectedDate.getDate()).padStart(2, "0");
      const hours = String(selectedDate.getHours()).padStart(2, "0");
      const minutes = String(selectedDate.getMinutes()).padStart(2, "0");

      const localISO = `${year}-${month}-${date}T${hours}:${minutes}`;
      nativeInput.value = localISO;
      
      // 更新展示文字
      const textVal = `${year}-${month}-${date} ${hours}:${minutes}`;
      triggerText.textContent = textVal;
      trigger.classList.add("has-value");

      // 更新相对提示标签
      const relStr = getRelativeTimeString(selectedDate);
      triggerBadge.textContent = relStr;
      triggerBadge.style.display = "inline-flex";

      // 触发原生事件以便其他监听器触发
      nativeInput.dispatchEvent(new Event("change"));
    }

    // 初始化默认保存一次
    saveValue();

    // 绑定外部快速预设按钮
    const presetButtons = document.querySelectorAll("form.cy-form button.cy-btn--ghost.cy-btn--sm");
    presetButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = btn.textContent.trim();
        const newDate = new Date();
        newDate.setSeconds(0);
        newDate.setMilliseconds(0);

        if (text.includes("1 分钟后")) {
          newDate.setMinutes(newDate.getMinutes() + 1);
        } else if (text.includes("1 小时后")) {
          newDate.setHours(newDate.getHours() + 1);
        } else if (text.includes("明天早上 9:00")) {
          newDate.setDate(newDate.getDate() + 1);
          newDate.setHours(9, 0, 0, 0);
        } else if (text.includes("1 年后")) {
          newDate.setFullYear(newDate.getFullYear() + 1);
        } else if (text.includes("2030.01.01")) {
          newDate.setFullYear(2030, 0, 1);
          newDate.setHours(9, 0, 0, 0);
        } else {
          return;
        }

        selectedDate = newDate;
        viewYear = selectedDate.getFullYear();
        viewMonth = selectedDate.getMonth();
        
        saveValue();
        
        if (picker.style.display !== "none") {
          scrollToTime(selectedDate.getHours(), selectedDate.getMinutes());
          renderCalendar();
          updateRelativeInfo();
        }
      });
    });

    // 绑定内联快速预设按钮
    const pickerPresets = picker.querySelectorAll(".cy-preset-pill");
    pickerPresets.forEach((btn) => {
      btn.addEventListener("click", () => {
        const preset = btn.dataset.preset;
        const newDate = new Date();
        newDate.setSeconds(0);
        newDate.setMilliseconds(0);

        if (preset === "1m") {
          newDate.setMinutes(newDate.getMinutes() + 1);
        } else if (preset === "1h") {
          newDate.setHours(newDate.getHours() + 1);
        } else if (preset === "tomorrow") {
          newDate.setDate(newDate.getDate() + 1);
          newDate.setHours(9, 0, 0, 0);
        } else if (preset === "nextyear") {
          newDate.setFullYear(newDate.getFullYear() + 1);
        }

        selectedDate = newDate;
        viewYear = selectedDate.getFullYear();
        viewMonth = selectedDate.getMonth();
        
        saveValue();
        scrollToTime(selectedDate.getHours(), selectedDate.getMinutes());
        renderCalendar();
        updateRelativeInfo();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    wireToggles();
    wireSegments();
    wireFavorites();
    wireUserDropdown();
    initCustomDateTimePicker();
  });

  // 立刻应用以避免 FOUC
  initTheme();
})();
