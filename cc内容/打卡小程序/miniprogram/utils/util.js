/**
 * 通用工具函数
 */

/**
 * 格式化日期
 * @param {Date|string|number} date 日期
 * @param {string} format 格式
 */
const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return '';

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

/**
 * 获取今天的日期字符串
 */
const getToday = () => {
  return formatDate(new Date(), 'YYYY-MM-DD');
};

/**
 * 计算连续打卡天数
 * @param {array} checkInDates 打卡日期列表 ['2024-01-01', '2024-01-02', ...]
 */
const calcContinuousDays = (checkInDates) => {
  if (!checkInDates || checkInDates.length === 0) return 0;

  // 按日期排序（降序）
  const sortedDates = [...checkInDates].sort().reverse();
  const today = getToday();
  const yesterday = formatDate(new Date(Date.now() - 86400000), 'YYYY-MM-DD');

  // 如果最新打卡不是今天或昨天，连续天数为0
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0;
  }

  let continuous = 1;
  let prevDate = new Date(sortedDates[0]);

  for (let i = 1; i < sortedDates.length; i++) {
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.floor((prevDate - currDate) / 86400000);

    if (diffDays === 1) {
      continuous++;
      prevDate = currDate;
    } else {
      break;
    }
  }

  return continuous;
};

/**
 * 获取月份的日历数据
 * @param {number} year 年份
 * @param {number} month 月份 (1-12)
 * @param {array} checkInDates 打卡日期列表
 */
const getMonthCalendar = (year, month, checkInDates = []) => {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const calendar = [];
  let week = [];

  // 填充前面的空白
  for (let i = 0; i < startWeekday; i++) {
    week.push({ day: '', date: '', checked: false });
  }

  // 填充日期
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(new Date(year, month - 1, day), 'YYYY-MM-DD');
    week.push({
      day,
      date: dateStr,
      checked: checkInDates.includes(dateStr)
    });

    if (week.length === 7) {
      calendar.push(week);
      week = [];
    }
  }

  // 填充后面的空白
  if (week.length > 0) {
    while (week.length < 7) {
      week.push({ day: '', date: '', checked: false });
    }
    calendar.push(week);
  }

  return calendar;
};

/**
 * 显示加载中
 * @param {string} title 提示文字
 */
const showLoading = (title = '加载中...') => {
  wx.showLoading({
    title,
    mask: true
  });
};

/**
 * 隐藏加载中
 */
const hideLoading = () => {
  wx.hideLoading();
};

/**
 * 显示提示
 * @param {string} title 提示文字
 * @param {string} icon 图标
 */
const showToast = (title, icon = 'none') => {
  wx.showToast({
    title,
    icon,
    duration: 2000
  });
};

/**
 * 显示确认弹窗
 * @param {string} title 标题
 * @param {string} content 内容
 */
const showConfirm = (title, content) => {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm);
      }
    });
  });
};

/**
 * 防抖函数
 * @param {function} fn 要防抖的函数
 * @param {number} delay 延迟时间
 */
const debounce = (fn, delay = 300) => {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

/**
 * 节流函数
 * @param {function} fn 要节流的函数
 * @param {number} delay 延迟时间
 */
const throttle = (fn, delay = 300) => {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
};

module.exports = {
  formatDate,
  getToday,
  calcContinuousDays,
  getMonthCalendar,
  showLoading,
  hideLoading,
  showToast,
  showConfirm,
  debounce,
  throttle
};
