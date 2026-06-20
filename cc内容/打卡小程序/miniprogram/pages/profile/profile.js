const app = getApp();
const util = require('../../utils/util');

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    myGroupsCount: 0,
    totalCheckIns: 0
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    if (app.globalData.isLoggedIn) {
      this.loadStats();
    }
  },

  checkLogin() {
    if (app.globalData.isLoggedIn) {
      this.setData({
        isLoggedIn: true,
        userInfo: app.globalData.userInfo
      });
      this.loadStats();
    }
  },

  async loadStats() {
    const openid = app.globalData.openid;
    if (!openid) return;

    try {
      const db = wx.cloud.database();

      // 获取群组数量
      const { total: myGroupsCount } = await db.collection('members')
        .where({ userId: openid, status: 1 })
        .count();

      // 获取打卡总数
      const { total: totalCheckIns } = await db.collection('checkIns')
        .where({ userId: openid, status: 1 })
        .count();

      this.setData({ myGroupsCount, totalCheckIns });
    } catch (err) {
      console.error('加载统计失败：', err);
    }
  },

  // 用户登录
  async handleLogin() {
    try {
      util.showLoading('登录中...');
      const result = await app.login();

      if (result.isNewUser) {
        // 新用户需要授权
        this.setData({ showAuth: true });
      } else {
        this.setData({
          isLoggedIn: true,
          userInfo: result.userInfo
        });
        this.loadStats();
      }
    } catch (err) {
      console.error('登录失败：', err);
      util.showToast('登录失败');
    } finally {
      util.hideLoading();
    }
  },

  // 获取用户信息（微信授权登录）
  async handleGetUserInfo(e) {
    if (e.detail.userInfo) {
      try {
        util.showLoading('登录中...');

        // 1. 先获取 openid
        const loginResult = await app.login();
        console.log('loginResult:', loginResult);

        // 2. 注册/更新用户信息
        const userInfo = {
          nickName: e.detail.userInfo.nickName,
          avatarUrl: e.detail.userInfo.avatarUrl
        };

        const result = await app.registerUser(userInfo);
        console.log('registerResult:', result);

        this.setData({
          isLoggedIn: true,
          userInfo: result
        });
        this.loadStats();
      } catch (err) {
        console.error('登录失败：', err);
        util.showToast('登录失败');
      } finally {
        util.hideLoading();
      }
    }
  },

  // 跳转到设置
  goToSetting() {
    wx.navigateTo({
      url: '/pages/setting/setting'
    });
  },

  // 查看我的群组
  goToMyGroups() {
    wx.switchTab({
      url: '/pages/group/group'
    });
  },

  // 查看我的打卡
  goToMyCheckIns() {
    wx.navigateTo({
      url: '/pages/statistics/statistics'
    });
  }
});
