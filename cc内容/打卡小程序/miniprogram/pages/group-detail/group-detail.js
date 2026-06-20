const app = getApp();
const util = require('../../utils/util');
const Permission = require('../../utils/permission');

Page({
  data: {
    groupId: '',
    groupInfo: null,
    memberInfo: null,
    todayCheckIns: [],
    isAdmin: false,
    isOwner: false,
    loading: true
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.setData({ groupId: id });
      this.loadData();
    }
  },

  async loadData() {
    try {
      this.setData({ loading: true });

      // 先加载群组信息
      await this.loadGroupInfo();

      // 再检查权限和加载打卡记录
      await Promise.all([
        this.checkPermission(),
        this.loadTodayCheckIns()
      ]);
    } catch (err) {
      console.error('加载数据失败：', err);
      util.showToast('加载失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载群组信息
  async loadGroupInfo() {
    const { groupId } = this.data;

    const { result } = await wx.cloud.callFunction({
      name: 'group',
      data: {
        action: 'getDetail',
        data: { groupId, excludeBookContent: true }
      }
    });

    if (result.code === 0) {
      this.setData({ groupInfo: result.data });
    }
  },

  // 检查权限
  async checkPermission() {
    const { groupId, groupInfo } = this.data;
    const openid = app.globalData.openid;

    if (!openid || !groupInfo) return;

    // 直接比较 ownerId 判断是否是群主
    const isOwner = groupInfo.ownerId === openid;
    const isAdmin = await Permission.isAdmin(groupId, openid);

    console.log('checkPermission:', { openid, ownerId: groupInfo.ownerId, isOwner, isAdmin });

    this.setData({ isOwner, isAdmin });
  },

  // 加载今日打卡
  async loadTodayCheckIns() {
    const { groupId } = this.data;
    const today = util.getToday();

    const { result } = await wx.cloud.callFunction({
      name: 'checkin',
      data: {
        action: 'getList',
        data: { groupId, date: today }
      }
    });

    if (result.code === 0) {
      this.setData({ todayCheckIns: result.data });
    }
  },

  // 跳转到打卡
  goToCheckIn() {
    const { groupId } = this.data;
    wx.navigateTo({
      url: `/pages/checkin/checkin?groupId=${groupId}`
    });
  },

  // 跳转到统计
  goToStatistics() {
    const { groupId } = this.data;
    wx.navigateTo({
      url: `/pages/statistics/statistics?groupId=${groupId}`
    });
  },

  // 跳转到管理
  goToAdmin() {
    const { groupId } = this.data;
    wx.navigateTo({
      url: `/pages/admin/admin?groupId=${groupId}`
    });
  },

  // 邀请成员
  async handleInvite() {
    try {
      const { groupId } = this.data;
      // 生成分享链接
      const sharePath = `/pages/group-detail/group-detail?id=${groupId}`;
      // 实际使用时可以生成小程序码或分享卡片
      util.showToast('请使用右上角分享功能邀请成员');
    } catch (err) {
      console.error('邀请失败：', err);
    }
  },

  // 退出群组
  async handleQuit() {
    const confirmed = await util.showConfirm('确认退出', '确定要退出该群组吗？');
    if (!confirmed) return;

    try {
      util.showLoading('退出中...');

      const { groupId } = this.data;
      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'quit',
          data: { groupId }
        }
      });

      if (result.code === 0) {
        util.showToast('已退出', 'success');
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        util.showToast(result.message || '退出失败');
      }
    } catch (err) {
      console.error('退出失败：', err);
      util.showToast('退出失败');
    } finally {
      util.hideLoading();
    }
  },

  // 解散群组
  async handleDissolve() {
    const confirmed = await util.showConfirm('确认解散', '解散后群组将无法恢复，所有成员将被移除，确定要解散吗？');
    if (!confirmed) return;

    try {
      util.showLoading('解散中...');

      const { groupId } = this.data;
      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'dissolve',
          data: { groupId }
        }
      });

      if (result.code === 0) {
        util.showToast('已解散', 'success');
        setTimeout(() => {
          wx.navigateBack({ delta: 2 });
        }, 1500);
      } else {
        util.showToast(result.message || '解散失败');
      }
    } catch (err) {
      console.error('解散失败：', err);
      util.showToast('解散失败');
    } finally {
      util.hideLoading();
    }
  },

  // 分享
  onShareAppMessage() {
    const { groupId, groupInfo } = this.data;
    return {
      title: `邀请你加入「${groupInfo?.name || '打卡群组'}」`,
      path: `/pages/group-detail/group-detail?id=${groupId}`
    };
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  }
});
