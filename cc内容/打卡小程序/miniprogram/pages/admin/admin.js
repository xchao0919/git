const app = getApp();
const util = require('../../utils/util');
const Permission = require('../../utils/permission');

Page({
  data: {
    groupId: '',
    groupInfo: null,
    members: [],
    filteredMembers: [],
    searchKey: '',
    isOwner: false,
    isAdmin: false,
    loading: true,
    activeTab: 'members',

    // 编辑模式
    showEditModal: false,
    editMode: '', // 'info' 或 'rule'
    editForm: {
      name: '',
      description: '',
      minWords: 10,
      requireImage: false,
      requireVideo: false,
      requireAudio: false
    }
  },

  onLoad(options) {
    console.log('admin onLoad, options:', options);
    const groupId = options.id || options.groupId;
    if (groupId) {
      this.setData({ groupId });
      this.loadData();
    } else {
      console.error('groupId is missing');
      util.showToast('参数错误');
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  async loadData() {
    try {
      this.setData({ loading: true });
      console.log('admin loadData, groupId:', this.data.groupId);

      const openid = app.globalData.openid;

      // 先加载群组信息
      await this.loadGroupInfo();

      const { groupInfo } = this.data;

      // 通过 ownerId 判断是否是群主
      const isOwner = groupInfo && groupInfo.ownerId === openid;
      const isAdmin = await Permission.isAdmin(this.data.groupId, openid);

      console.log('isOwner:', isOwner, 'isAdmin:', isAdmin, 'openid:', openid, 'ownerId:', groupInfo?.ownerId);

      if (!isOwner && !isAdmin) {
        util.showToast('无权限访问');
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
        return;
      }

      // 加载成员
      await this.loadMembers();

      this.setData({ isOwner, isAdmin, loading: false });
    } catch (err) {
      console.error('加载数据失败：', err);
      util.showToast('加载失败');
      this.setData({ loading: false });
    }
  },

  // 加载群组信息
  async loadGroupInfo() {
    try {
      const { groupId } = this.data;

      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'getDetail',
          data: { groupId, excludeBookContent: true }
        }
      });

      console.log('loadGroupInfo result:', result);

      if (result.code === 0) {
        this.setData({
          groupInfo: result.data,
          adminIds: result.data.adminIds || []
        });
      }
    } catch (err) {
      console.error('加载群组信息失败:', err);
    }
  },

  // 加载成员列表
  async loadMembers() {
    try {
      const { groupId } = this.data;
      console.log('loadMembers groupId:', groupId);

      const db = wx.cloud.database();
      const membersRes = await db.collection('members')
        .where({
          groupId,
          status: 1
        })
        .orderBy('role', 'asc')
        .get();

      console.log('membersRes:', membersRes);

      const members = membersRes.data || [];

      if (members.length === 0) {
        this.setData({ members: [], filteredMembers: [] });
        return;
      }

      // 获取用户信息
      const userIds = members.map(m => m.userId);
      const usersRes = await db.collection('users')
        .where({
          _id: db.command.in(userIds)
        })
        .get();

      console.log('usersRes:', usersRes);

      const users = usersRes.data || [];
      const usersMap = {};
      users.forEach(u => {
        usersMap[u._id] = u;
      });

      const memberList = members.map(m => ({
        ...m,
        userInfo: usersMap[m.userId] || null
      }));

      console.log('memberList:', memberList);

      this.setData({
        members: memberList,
        filteredMembers: memberList
      });
    } catch (err) {
      console.error('加载成员列表失败:', err);
      this.setData({ members: [], filteredMembers: [] });
    }
  },

  // 切换标签
  switchTab(e) {
    const { tab } = e.currentTarget.dataset;
    this.setData({ activeTab: tab });
  },

  // 跳转到书籍管理
  goToBookManage() {
    const { groupId } = this.data;
    wx.navigateTo({
      url: `/pages/book-manage/book-manage?groupId=${groupId}`
    });
  },

  // 搜索成员
  handleSearch(e) {
    const searchKey = e.detail.value.trim().toLowerCase();
    const { members } = this.data;

    let filteredMembers = members;
    if (searchKey) {
      filteredMembers = members.filter(m =>
        (m.userInfo && m.userInfo.nickName && m.userInfo.nickName.toLowerCase().includes(searchKey))
      );
    }

    this.setData({ searchKey, filteredMembers });
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      searchKey: '',
      filteredMembers: this.data.members
    });
  },

  // 设置管理员
  async handleSetAdmin(e) {
    const { userId } = e.currentTarget.dataset;
    const { groupId } = this.data;

    try {
      util.showLoading('设置中...');

      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'setAdmin',
          data: { groupId, userId }
        }
      });

      if (result.code === 0) {
        util.showToast('设置成功', 'success');
        await this.loadData();
      } else {
        util.showToast(result.message || '设置失败');
      }
    } catch (err) {
      console.error('设置管理员失败：', err);
      util.showToast('设置失败');
    } finally {
      util.hideLoading();
    }
  },

  // 移除管理员
  async handleRemoveAdmin(e) {
    const { userId } = e.currentTarget.dataset;
    const { groupId } = this.data;

    try {
      util.showLoading('移除中...');

      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'removeAdmin',
          data: { groupId, userId }
        }
      });

      if (result.code === 0) {
        util.showToast('移除成功', 'success');
        await this.loadData();
      } else {
        util.showToast(result.message || '移除失败');
      }
    } catch (err) {
      console.error('移除管理员失败：', err);
      util.showToast('移除失败');
    } finally {
      util.hideLoading();
    }
  },

  // 踢出成员
  async handleKick(e) {
    const { userId } = e.currentTarget.dataset;
    const { groupId } = this.data;

    const confirmed = await util.showConfirm('确认踢出', '确定要踢出该成员吗？');
    if (!confirmed) return;

    try {
      util.showLoading('踢出中...');

      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'kickMember',
          data: { groupId, userId }
        }
      });

      if (result.code === 0) {
        util.showToast('已踢出', 'success');
        await this.loadData();
      } else {
        util.showToast(result.message || '踢出失败');
      }
    } catch (err) {
      console.error('踢出成员失败：', err);
      util.showToast('踢出失败');
    } finally {
      util.hideLoading();
    }
  },

  // 显示编辑群组信息弹窗
  showEditInfoModal() {
    const { groupInfo } = this.data;
    this.setData({
      showEditModal: true,
      editMode: 'info',
      editForm: {
        name: groupInfo?.name || '',
        description: groupInfo?.description || '',
        minWords: groupInfo?.checkInConfig?.minWords || 10,
        requireImage: groupInfo?.checkInConfig?.requireImage || false,
        requireVideo: groupInfo?.checkInConfig?.requireVideo || false,
        requireAudio: groupInfo?.checkInConfig?.requireAudio || false
      }
    });
  },

  // 显示编辑打卡规则弹窗
  showEditRuleModal() {
    const { groupInfo } = this.data;
    this.setData({
      showEditModal: true,
      editMode: 'rule',
      editForm: {
        name: groupInfo?.name || '',
        description: groupInfo?.description || '',
        minWords: groupInfo?.checkInConfig?.minWords || 10,
        requireImage: groupInfo?.checkInConfig?.requireImage || false,
        requireVideo: groupInfo?.checkInConfig?.requireVideo || false,
        requireAudio: groupInfo?.checkInConfig?.requireAudio || false
      }
    });
  },

  // 关闭弹窗
  closeModal() {
    this.setData({ showEditModal: false, editMode: '' });
  },

  // 输入群组名称
  handleNameInput(e) {
    this.setData({ 'editForm.name': e.detail.value });
  },

  // 输入群组描述
  handleDescInput(e) {
    this.setData({ 'editForm.description': e.detail.value });
  },

  // 输入最少字数
  handleMinWordsInput(e) {
    this.setData({ 'editForm.minWords': Number(e.detail.value) || 10 });
  },

  // 切换图片要求
  toggleRequireImage(e) {
    this.setData({ 'editForm.requireImage': e.detail.value });
  },

  // 切换视频要求
  toggleRequireVideo(e) {
    this.setData({ 'editForm.requireVideo': e.detail.value });
  },

  // 切换音频要求
  toggleRequireAudio(e) {
    this.setData({ 'editForm.requireAudio': e.detail.value });
  },

  // 保存编辑
  async handleSaveEdit() {
    const { groupId, editMode, editForm } = this.data;

    if (editMode === 'info' && !editForm.name.trim()) {
      util.showToast('请输入群组名称');
      return;
    }

    try {
      util.showLoading('保存中...');

      let updateData = {};

      if (editMode === 'info') {
        updateData = {
          name: editForm.name.trim(),
          description: editForm.description.trim()
        };
      } else if (editMode === 'rule') {
        updateData = {
          checkInConfig: {
            type: 'daily',
            startTime: '00:00',
            endTime: '23:59',
            requiredTypes: ['text'],
            minWords: editForm.minWords,
            requireImage: editForm.requireImage,
            requireVideo: editForm.requireVideo,
            requireAudio: editForm.requireAudio
          }
        };
      }

      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'update',
          data: {
            groupId,
            ...updateData
          }
        }
      });

      if (result.code === 0) {
        util.showToast('保存成功', 'success');
        this.closeModal();
        await this.loadData();
      } else {
        util.showToast(result.message || '保存失败');
      }
    } catch (err) {
      console.error('保存失败：', err);
      util.showToast('保存失败');
    } finally {
      util.hideLoading();
    }
  },

  // 解散群组
  async handleDissolve() {
    const confirmed = await util.showConfirm('确认解散', '解散后群组将无法恢复，所有成员将被移除，确定要解散吗？');
    if (!confirmed) return;

    const { groupId } = this.data;

    try {
      util.showLoading('解散中...');

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
      console.error('解散群组失败：', err);
      util.showToast('解散失败');
    } finally {
      util.hideLoading();
    }
  },

  // 退出群组
  async handleQuit() {
    const confirmed = await util.showConfirm('确认退出', '确定要退出该群组吗？');
    if (!confirmed) return;

    const { groupId } = this.data;

    try {
      util.showLoading('退出中...');

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
          wx.navigateBack({ delta: 2 });
        }, 1500);
      } else {
        util.showToast(result.message || '退出失败');
      }
    } catch (err) {
      console.error('退出群组失败：', err);
      util.showToast('退出失败');
    } finally {
      util.hideLoading();
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  }
});
