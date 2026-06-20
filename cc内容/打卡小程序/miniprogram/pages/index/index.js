const app = getApp();
const util = require('../../utils/util');
const DB = require('../../utils/db');

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    myGroups: [],
    recentCheckIns: [],
    loading: true
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    if (app.globalData.isLoggedIn) {
      this.loadData();
    }
  },

  // 检查登录状态
  async checkLogin() {
    if (app.globalData.isLoggedIn) {
      this.setData({
        isLoggedIn: true,
        userInfo: app.globalData.userInfo
      });
      await this.loadData();
    } else {
      this.setData({
        loading: false
      });
    }
  },

  // 加载数据
  async loadData() {
    try {
      util.showLoading('加载中...');

      // 并行加载群组数据和最近打卡
      const [groupsRes, checkInsRes] = await Promise.all([
        this.loadMyGroups(),
        this.loadRecentCheckIns()
      ]);

      this.setData({
        loading: false
      });
    } catch (err) {
      console.error('加载数据失败：', err);
      util.showToast('加载失败');
      this.setData({ loading: false });
    } finally {
      util.hideLoading();
    }
  },

  // 加载我的群组
  async loadMyGroups() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'getList',
          data: { type: 'joined' }
        }
      });

      if (result.code === 0) {
        this.setData({
          myGroups: result.data
        });
      }
    } catch (err) {
      console.error('加载群组失败：', err);
    }
  },

  // 加载最近打卡记录
  async loadRecentCheckIns() {
    const openid = app.globalData.openid;
    if (!openid) return;

    const today = util.getToday();
    const res = await DB.getList(DB.collections.checkIns, {
      where: {
        userId: openid,
        status: 1
      },
      orderBy: { createTime: 'desc' },
      limit: 5
    });

    if (res.code === 0) {
      this.setData({
        recentCheckIns: res.data
      });
    }
  },

  // 用户登录
  async handleLogin() {
    try {
      util.showLoading('登录中...');
      const result = await app.login();

      if (result.isNewUser) {
        // 新用户，跳转到授权页面
        wx.navigateTo({
          url: '/pages/authorize/authorize'
        });
      } else {
        this.setData({
          isLoggedIn: true,
          userInfo: result.userInfo
        });
        await this.loadData();
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
        await this.loadData();
      } catch (err) {
        console.error('登录失败：', err);
        util.showToast('登录失败');
      } finally {
        util.hideLoading();
      }
    }
  },

  // 跳转到群组详情
  goToGroup(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/group-detail/group-detail?id=${id}`
    });
  },

  // 跳转到创建群组
  goToCreateGroup() {
    wx.navigateTo({
      url: '/pages/create-group/create-group'
    });
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  }
});
