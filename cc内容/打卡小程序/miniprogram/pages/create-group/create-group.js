const app = getApp();
const util = require('../../utils/util');

Page({
  data: {
    form: {
      name: '',
      description: '',
      coverUrl: '',
      checkInConfig: {
        type: 'daily',
        startTime: '00:00',
        endTime: '23:59',
        requiredTypes: ['text'],
        minWords: 10,
        requireImage: false,
        requireVideo: false,
        requireAudio: false
      }
    },
    coverFile: null
  },

  // 输入群组名称
  handleNameInput(e) {
    this.setData({ 'form.name': e.detail.value });
  },

  // 输入群组描述
  handleDescInput(e) {
    this.setData({ 'form.description': e.detail.value });
  },

  // 选择封面
  async handleChooseCover() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      });

      this.setData({
        coverFile: res.tempFiles[0].tempFilePath
      });
    } catch (err) {
      console.log('取消选择封面');
    }
  },

  // 设置最少字数
  handleMinWordsChange(e) {
    this.setData({
      'form.checkInConfig.minWords': Number(e.detail.value)
    });
  },

  // 切换图片要求
  toggleRequireImage(e) {
    this.setData({
      'form.checkInConfig.requireImage': e.detail.value
    });
  },

  // 切换视频要求
  toggleRequireVideo(e) {
    this.setData({
      'form.checkInConfig.requireVideo': e.detail.value
    });
  },

  // 切换音频要求
  toggleRequireAudio(e) {
    this.setData({
      'form.checkInConfig.requireAudio': e.detail.value
    });
  },

  // 提交创建
  async handleSubmit() {
    const { form, coverFile } = this.data;

    if (!form.name.trim()) {
      util.showToast('请输入群组名称');
      return;
    }

    try {
      util.showLoading('创建中...');

      // 上传封面
      let coverUrl = '';
      if (coverFile) {
        const ext = coverFile.split('.').pop();
        const cloudPath = `covers/${Date.now()}-${Math.random().toString(36).substr(2)}.${ext}`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: coverFile
        });
        coverUrl = uploadRes.fileID;
      }

      // 创建群组
      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'create',
          data: {
            name: form.name,
            description: form.description,
            coverUrl,
            checkInConfig: form.checkInConfig
          }
        }
      });

      if (result.code === 0) {
        util.showToast('创建成功', 'success');
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        util.showToast(result.message || '创建失败');
      }
    } catch (err) {
      console.error('创建群组失败：', err);
      util.showToast('创建失败');
    } finally {
      util.hideLoading();
    }
  }
});
