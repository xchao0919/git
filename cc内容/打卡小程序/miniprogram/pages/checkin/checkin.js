const app = getApp();
const util = require('../../utils/util');

Page({
  data: {
    groupId: '',
    groupInfo: null,
    myGroups: [],
    showGroupPicker: false,
    todayChecked: false,
    todayDate: '',
    formData: {
      text: '',
      images: [],
      video: '',
      audio: '',
      readingAudio: ''
    },
    uploading: false,
    canSubmit: true,
    recording: false,
    loading: true,

    // 阅读打卡相关
    checkinType: 'normal', // 'normal' 或 'reading'
    currentChapter: 0,
    currentChapterContent: null,
    bookInfo: null, // 书籍元信息
    readingRecording: false,
    readingDuration: 0,
    readingTimer: null
  },

  onLoad(options) {
    const { groupId } = options;
    if (groupId) {
      this.setData({ groupId });
      this.initCheckIn(groupId);
    } else {
      this.loadMyGroups();
    }
  },

  onShow() {
    if (this.data.groupId) {
      this.checkTodayStatus(this.data.groupId);
    }
  },

  onUnload() {
    // 清理定时器
    if (this.data.readingTimer) {
      clearInterval(this.data.readingTimer);
    }
  },

  async initCheckIn(groupId) {
    console.log('initCheckIn called, groupId:', groupId);
    this.setData({ loading: true });

    try {
      await Promise.all([
        this.loadGroupInfo(groupId),
        this.checkTodayStatus(groupId)
      ]);
    } catch (err) {
      console.error('initCheckIn error:', err);
    }

    console.log('initCheckIn done, groupInfo:', this.data.groupInfo);
    this.setData({ loading: false });
  },

  async loadMyGroups() {
    try {
      this.setData({ loading: true });

      const openid = app.globalData.openid;
      if (!openid) {
        const storedOpenid = wx.getStorageSync('openid');
        if (storedOpenid) {
          app.globalData.openid = storedOpenid;
        } else {
          util.showToast('请先登录');
          setTimeout(() => {
            wx.switchTab({ url: '/pages/index/index' });
          }, 1500);
          return;
        }
      }

      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'getList',
          data: { type: 'joined' }
        }
      });

      if (result.code === 0) {
        const myGroups = result.data || [];
        this.setData({ myGroups, loading: false });

        if (myGroups.length === 0) {
          util.showToast('您还没有加入任何群组');
          setTimeout(() => {
            wx.switchTab({ url: '/pages/group/group' });
          }, 1500);
        } else if (myGroups.length === 1) {
          this.selectGroup(myGroups[0]._id);
        } else {
          this.setData({ showGroupPicker: true });
        }
      }
    } catch (err) {
      console.error('加载群组列表失败：', err);
      util.showToast('加载失败');
      this.setData({ loading: false });
    }
  },

  async loadGroupInfo(groupId) {
    console.log('loadGroupInfo called, groupId:', groupId);
    try {
      // 获取群组信息（不含书籍内容）
      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'getDetail',
          data: { groupId, excludeBookContent: true }
        }
      });

      console.log('loadGroupInfo result:', result);

      if (result.code === 0) {
        const groupInfo = result.data;

        // 如果有书籍，加载书籍元信息和第一章
        if (groupInfo.book) {
          await this.loadBookInfo(groupId);
          const checkinType = 'reading';
          this.setData({ groupInfo, checkinType, currentChapter: 0 });
        } else {
          this.setData({ groupInfo, checkinType: 'normal' });
        }
      } else {
        console.error('loadGroupInfo failed:', result.message);
        util.showToast(result.message || '加载失败');
      }
    } catch (err) {
      console.error('加载群组信息失败：', err);
      util.showToast('加载失败');
    }
  },

  // 加载书籍信息
  async loadBookInfo(groupId) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'getBook',
          data: { groupId }
        }
      });

      if (result.code === 0) {
        this.setData({ bookInfo: result.data });
        // 加载第一章内容
        await this.loadChapter(0);
      }
    } catch (err) {
      console.error('加载书籍信息失败：', err);
    }
  },

  // 加载章节内容
  async loadChapter(chapterIndex) {
    const { groupId, bookInfo } = this.data;
    if (!bookInfo || chapterIndex >= bookInfo.chapterCount) return;

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'getBook',
          data: { groupId, chapterIndex }
        }
      });

      if (result.code === 0) {
        this.setData({
          currentChapter: chapterIndex,
          currentChapterContent: result.data.chapter
        });
      }
    } catch (err) {
      console.error('加载章节失败：', err);
    }
  },

  async checkTodayStatus(groupId) {
    console.log('checkTodayStatus called, groupId:', groupId);
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'checkin',
        data: {
          action: 'getTodayStatus',
          data: { groupId }
        }
      });

      console.log('checkTodayStatus result:', result);

      if (result.code === 0) {
        this.setData({
          todayChecked: result.data.checked,
          todayDate: result.data.date
        });
      }
    } catch (err) {
      console.error('检查打卡状态失败：', err);
    }
  },

  showGroupSelector() {
    this.setData({ showGroupPicker: true });
  },

  hideGroupPicker() {
    this.setData({ showGroupPicker: false });
  },

  async selectGroup(e) {
    const groupId = e?.currentTarget?.dataset?.id || e;
    console.log('selectGroup called, groupId:', groupId, 'type:', typeof groupId);

    if (!groupId) {
      console.error('groupId is empty');
      return;
    }

    this.setData({
      groupId: String(groupId),
      showGroupPicker: false,
      loading: true,
      groupInfo: null,
      bookInfo: null,
      currentChapterContent: null,
      todayChecked: false,
      formData: {
        text: '',
        images: [],
        video: '',
        audio: '',
        readingAudio: ''
      },
      currentChapter: 0,
      checkinType: 'normal'
    });

    await this.initCheckIn(String(groupId));
  },

  // 切换打卡类型
  switchCheckinType(e) {
    const { type } = e.currentTarget.dataset;
    this.setData({ checkinType: type });
    this.checkCanSubmit();
  },

  // 上一章
  prevChapter() {
    const { currentChapter } = this.data;
    if (currentChapter > 0) {
      this.loadChapter(currentChapter - 1);
    }
  },

  // 下一章
  nextChapter() {
    const { bookInfo, currentChapter } = this.data;
    if (bookInfo && currentChapter < bookInfo.chapterCount - 1) {
      this.loadChapter(currentChapter + 1);
    }
  },

  // 阅读录音
  toggleReadingRecord() {
    if (this.data.readingRecording) {
      this.stopReadingRecord();
    } else {
      this.startReadingRecord();
    }
  },

  startReadingRecord() {
    const recorderManager = wx.getRecorderManager();

    recorderManager.start({
      format: 'mp3',
      duration: 300000 // 最长5分钟
    });

    this.setData({ readingRecording: true, readingDuration: 0 });

    // 计时器
    const timer = setInterval(() => {
      this.setData({ readingDuration: this.data.readingDuration + 1 });
    }, 1000);

    this.setData({ readingTimer: timer });

    recorderManager.onStop((res) => {
      this.setData({
        'formData.readingAudio': res.tempFilePath,
        readingRecording: false
      });
      if (this.data.readingTimer) {
        clearInterval(this.data.readingTimer);
      }
      this.checkCanSubmit();
    });

    recorderManager.onError((err) => {
      console.error('录音失败：', err);
      util.showToast('录音失败');
      this.setData({ readingRecording: false });
      if (this.data.readingTimer) {
        clearInterval(this.data.readingTimer);
      }
    });
  },

  stopReadingRecord() {
    const recorderManager = wx.getRecorderManager();
    recorderManager.stop();
  },

  // 播放阅读录音
  playReadingAudio() {
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = this.data.formData.readingAudio;
    innerAudioContext.play();
  },

  // 删除阅读录音
  deleteReadingAudio() {
    this.setData({
      'formData.readingAudio': '',
      readingDuration: 0
    });
    this.checkCanSubmit();
  },

  handleTextInput(e) {
    this.setData({ 'formData.text': e.detail.value });
    this.checkCanSubmit();
  },

  async handleChooseImage() {
    try {
      const res = await wx.chooseMedia({
        count: 9 - this.data.formData.images.length,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      });

      const images = res.tempFiles.map(file => file.tempFilePath);
      this.setData({ 'formData.images': [...this.data.formData.images, ...images] });
      this.checkCanSubmit();
    } catch (err) {
      console.log('取消选择图片');
    }
  },

  handlePreviewImage(e) {
    const { url } = e.currentTarget.dataset;
    wx.previewImage({ urls: this.data.formData.images, current: url });
  },

  handleDeleteImage(e) {
    const { index } = e.currentTarget.dataset;
    const images = this.data.formData.images.filter((_, i) => i !== index);
    this.setData({ 'formData.images': images });
    this.checkCanSubmit();
  },

  async handleChooseVideo() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['video'],
        sourceType: ['album', 'camera'],
        maxDuration: 60
      });
      this.setData({ 'formData.video': res.tempFiles[0].tempFilePath });
      this.checkCanSubmit();
    } catch (err) {
      console.log('取消选择视频');
    }
  },

  handleDeleteVideo() {
    this.setData({ 'formData.video': '' });
    this.checkCanSubmit();
  },

  async handleRecordAudio() {
    try {
      const res = wx.getRecorderManager();

      if (this.data.recording) {
        res.stop();
        this.setData({ recording: false });
      } else {
        res.start({ format: 'mp3', duration: 60000 });
        this.setData({ recording: true });

        res.onStop((res) => {
          this.setData({ 'formData.audio': res.tempFilePath, recording: false });
          this.checkCanSubmit();
        });
      }
    } catch (err) {
      console.error('录音失败：', err);
      util.showToast('录音失败');
    }
  },

  handleDeleteAudio() {
    this.setData({ 'formData.audio': '' });
    this.checkCanSubmit();
  },

  checkCanSubmit() {
    const { formData, groupInfo, checkinType, bookInfo } = this.data;
    let canSubmit = true;

    if (checkinType === 'reading' && bookInfo) {
      // 阅读打卡：必须录音
      if (!formData.readingAudio) {
        canSubmit = false;
      }
    } else {
      // 普通打卡
      const config = groupInfo?.checkInConfig || {};

      if (config.requiredTypes?.includes('text') && config.minWords) {
        if (formData.text.length < config.minWords) {
          canSubmit = false;
        }
      }

      if (config.requireImage && formData.images.length === 0) {
        canSubmit = false;
      }

      if (config.requireVideo && !formData.video) {
        canSubmit = false;
      }

      if (config.requireAudio && !formData.audio) {
        canSubmit = false;
      }
    }

    this.setData({ canSubmit });
  },

  async handleSubmit() {
    if (this.data.todayChecked) {
      util.showToast('今日已打卡');
      return;
    }

    if (!this.data.canSubmit) {
      util.showToast('请完成打卡要求');
      return;
    }

    try {
      this.setData({ uploading: true });
      util.showLoading('提交中...');

      const { formData, groupId, checkinType, currentChapter, groupInfo } = this.data;

      const uploadedContent = {
        text: formData.text,
        images: [],
        video: '',
        audio: '',
        readingAudio: '',
        checkinType: checkinType
      };

      // 上传图片
      for (const img of formData.images) {
        const fileID = await this.uploadFile(img, 'images');
        if (fileID) uploadedContent.images.push(fileID);
      }

      // 上传视频
      if (formData.video) {
        uploadedContent.video = await this.uploadFile(formData.video, 'videos');
      }

      // 上传语音
      if (formData.audio) {
        uploadedContent.audio = await this.uploadFile(formData.audio, 'audios');
      }

      // 上传阅读录音
      if (formData.readingAudio) {
        uploadedContent.readingAudio = await this.uploadFile(formData.readingAudio, 'readings');
        uploadedContent.readingChapter = currentChapter;
        uploadedContent.readingChapterTitle = this.data.currentChapterContent?.title || '';
      }

      const { result } = await wx.cloud.callFunction({
        name: 'checkin',
        data: {
          action: 'create',
          data: { groupId, content: uploadedContent }
        }
      });

      if (result.code === 0) {
        util.showToast('打卡成功', 'success');
        this.setData({
          todayChecked: true,
          formData: {
            text: '',
            images: [],
            video: '',
            audio: '',
            readingAudio: ''
          }
        });
      } else {
        util.showToast(result.message || '打卡失败');
      }
    } catch (err) {
      console.error('打卡失败：', err);
      util.showToast('打卡失败');
    } finally {
      this.setData({ uploading: false });
      util.hideLoading();
    }
  },

  async uploadFile(filePath, folder) {
    try {
      const ext = filePath.split('.').pop();
      const cloudPath = `${folder}/${Date.now()}-${Math.random().toString(36).substr(2)}.${ext}`;
      const res = await wx.cloud.uploadFile({ cloudPath, filePath });
      return res.fileID;
    } catch (err) {
      console.error('上传文件失败：', err);
      return null;
    }
  }
});
