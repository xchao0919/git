const app = getApp();
const util = require('../../utils/util');

Page({
  data: {
    groups: [],
    loading: true,
    activeTab: 'joined'
  },

  onLoad() {
    this.loadGroups();
  },

  onShow() {
    // 每次显示页面都重新加载群组列表
    this.loadGroups();
  },

  // 切换标签
  switchTab(e) {
    const { tab } = e.currentTarget.dataset;
    this.setData({ activeTab: tab });
    this.loadGroups();
  },

  // 加载群组列表
  async loadGroups() {
    let openid = app.globalData.openid;

    // 如果 openid 不存在，尝试从 storage 读取
    if (!openid) {
      openid = wx.getStorageSync('openid');
      if (openid) {
        app.globalData.openid = openid;
      }
    }

    if (!openid) {
      console.log('openid 不存在，跳过加载');
      this.setData({ loading: false, groups: [] });
      return;
    }

    try {
      this.setData({ loading: true });
      console.log('加载群组列表, openid:', openid);

      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'getList',
          data: {
            type: this.data.activeTab
          }
        }
      });

      console.log('群组列表结果:', result);

      if (result.code === 0) {
        this.setData({ groups: result.data });
      } else {
        console.error('获取群组失败:', result.message);
      }
    } catch (err) {
      console.error('加载群组失败：', err);
      util.showToast('加载失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 跳转到群组详情
  goToGroupDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/group-detail/group-detail?id=${id}`
    });
  },

  // 跳转到创建群组
  goToCreate() {
    wx.navigateTo({
      url: '/pages/create-group/create-group'
    });
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadGroups();
    wx.stopPullDownRefresh();
  }
});
