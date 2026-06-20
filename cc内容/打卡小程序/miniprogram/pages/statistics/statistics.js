const app = getApp();
const util = require('../../utils/util');

Page({
  data: {
    groupId: '',
    currentMonth: '',
    year: 0,
    month: 0,
    calendar: [],
    userStats: {
      totalDays: 0,
      continuousDays: 0,
      monthDays: 0
    },
    rankingList: [],
    checkedDates: [],
    loading: true
  },

  onLoad(options) {
    const { groupId } = options;
    const now = new Date();

    this.setData({
      groupId: groupId || '',
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      currentMonth: `${now.getFullYear()}年${now.getMonth() + 1}月`
    });
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });

    try {
      await Promise.all([
        this.loadUserStats(),
        this.loadCalendar(),
        this.loadRanking()
      ]);
    } catch (err) {
      console.error('加载数据失败：', err);
      util.showToast('加载失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载用户统计
  async loadUserStats() {
    const { groupId } = this.data;
    const openid = app.globalData.openid;
    if (!openid) return;

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'statistics',
        data: {
          action: 'getUserStats',
          data: { groupId }
        }
      });

      if (result.code === 0) {
        this.setData({ userStats: result.data });
      }
    } catch (err) {
      console.error('加载用户统计失败：', err);
    }
  },

  // 加载日历数据
  async loadCalendar() {
    const { groupId, year, month } = this.data;
    const openid = app.globalData.openid;
    if (!openid) return;

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'statistics',
        data: {
          action: 'getCalendar',
          data: { groupId, year, month }
        }
      });

      if (result.code === 0) {
        this.setData({ checkedDates: result.data });
        this.generateCalendar();
      }
    } catch (err) {
      console.error('加载日历失败：', err);
    }
  },

  // 生成日历
  generateCalendar() {
    const { year, month, checkedDates } = this.data;
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay();

    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const calendar = [];
    let week = [];

    // 添加星期标题
    calendar.push(weekDays.map(day => ({ day, isHeader: true })));

    // 填充前面的空白
    for (let i = 0; i < startWeekday; i++) {
      week.push({ day: '', date: '', checked: false });
    }

    // 填充日期
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      week.push({
        day,
        date: dateStr,
        checked: checkedDates.includes(dateStr),
        isToday: dateStr === util.getToday()
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

    this.setData({ calendar });
  },

  // 加载排行榜
  async loadRanking() {
    const { groupId } = this.data;
    if (!groupId) return;

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'statistics',
        data: {
          action: 'getRanking',
          data: { groupId, limit: 10 }
        }
      });

      if (result.code === 0) {
        this.setData({ rankingList: result.data });
      }
    } catch (err) {
      console.error('加载排行榜失败：', err);
    }
  },

  // 上一个月
  prevMonth() {
    let { year, month } = this.data;
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
    this.setData({
      year,
      month,
      currentMonth: `${year}年${month}月`
    });
    this.loadCalendar();
  },

  // 下一个月
  nextMonth() {
    let { year, month } = this.data;
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
    this.setData({
      year,
      month,
      currentMonth: `${year}年${month}月`
    });
    this.loadCalendar();
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  }
});
