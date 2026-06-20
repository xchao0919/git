const app = getApp();
const util = require('../../utils/util');

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    version: '1.0.0'
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    this.checkLogin();
  },

  checkLogin() {
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      userInfo: app.globalData.userInfo
    });
  },

  // 清除缓存
  async handleClearCache() {
    const confirmed = await util.showConfirm('确认清除', '确定要清除本地缓存吗？这不会影响您的账号数据。');
    if (!confirmed) return;

    try {
      wx.clearStorageSync();
      util.showToast('清除成功', 'success');

      // 重新初始化全局数据
      app.globalData.userInfo = null;
      app.globalData.openid = null;
      app.globalData.isLoggedIn = false;

      // 跳转到首页
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }, 1500);
    } catch (err) {
      console.error('清除缓存失败：', err);
      util.showToast('清除失败');
    }
  },

  // 退出登录
  async handleLogout() {
    const confirmed = await util.showConfirm('确认退出', '确定要退出登录吗？');
    if (!confirmed) return;

    try {
      // 清除本地存储的登录信息
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('openid');

      // 重置全局数据
      app.globalData.userInfo = null;
      app.globalData.openid = null;
      app.globalData.isLoggedIn = false;

      util.showToast('已退出登录', 'success');

      // 跳转到首页
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }, 1500);
    } catch (err) {
      console.error('退出登录失败：', err);
      util.showToast('退出失败');
    }
  },

  // 查看关于我们
  goToAbout() {
    wx.showModal({
      title: '关于打卡小程序',
      content: '打卡小程序是一款帮助用户养成良好习惯的工具。您可以创建或加入打卡群组，与朋友一起坚持打卡，见证成长。\n\n版本：' + this.data.version,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 查看隐私政策
  goToPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '我们重视您的隐私保护。\n\n1. 我们仅收集必要的用户信息用于提供打卡服务。\n2. 您的数据将安全存储，不会泄露给第三方。\n3. 您可以随时删除您的账号和数据。\n\n如有疑问，请联系我们。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 反馈建议
  handleFeedback() {
    wx.showModal({
      title: '反馈建议',
      content: '如有问题或建议，请通过以下方式联系我们：\n\n邮箱：feedback@example.com\n微信：example_helper',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
