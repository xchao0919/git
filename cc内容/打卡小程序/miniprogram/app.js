App({
  globalData: {
    userInfo: null,
    openid: null,
    isLoggedIn: false
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d3gssbmqz5b234a74', // 替换为你的云开发环境ID
        traceUser: true,
      });
    }

    // 检查登录状态
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const openid = wx.getStorageSync('openid');

    if (userInfo && openid) {
      this.globalData.userInfo = userInfo;
      this.globalData.openid = openid;
      this.globalData.isLoggedIn = true;
    }
  },

  // 用户登录
  async login() {
    try {
      console.log('开始登录...');

      // 获取 openid
      const { result } = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'login'
        }
      });

      console.log('login 云函数返回:', result);

      if (result.code === 0) {
        const openid = result.data.openid;
        this.globalData.openid = openid;
        wx.setStorageSync('openid', openid);
        console.log('openid 已保存:', openid);

        // 检查用户是否已注册
        const userRes = await wx.cloud.callFunction({
          name: 'user',
          data: {
            action: 'getUser',
            data: { openid: openid }
          }
        });

        console.log('getUser 云函数返回:', userRes.result);

        if (userRes.result.code === 0 && userRes.result.data) {
          // 用户已存在
          this.globalData.userInfo = userRes.result.data;
          this.globalData.isLoggedIn = true;
          wx.setStorageSync('userInfo', userRes.result.data);
          return { isNewUser: false, userInfo: userRes.result.data };
        } else {
          // 新用户，需要获取微信信息
          return { isNewUser: true, openid: openid };
        }
      } else {
        console.error('登录云函数返回错误:', result);
        throw new Error(result.message || '登录失败');
      }
    } catch (err) {
      console.error('登录失败：', err);
      throw err;
    }
  },

  // 注册新用户
  async registerUser(userInfo) {
    try {
      // 确保有 openid
      if (!this.globalData.openid) {
        const openid = wx.getStorageSync('openid');
        if (openid) {
          this.globalData.openid = openid;
        } else {
          throw new Error('请先完成登录');
        }
      }

      const { result } = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'register',
          data: userInfo
        }
      });

      if (result.code === 0) {
        this.globalData.userInfo = result.data;
        this.globalData.isLoggedIn = true;
        wx.setStorageSync('userInfo', result.data);
        return result.data;
      } else if (result.code === 1) {
        // 用户已存在，尝试更新
        const updateResult = await wx.cloud.callFunction({
          name: 'user',
          data: {
            action: 'update',
            data: userInfo
          }
        });
        if (updateResult.result.code === 0) {
          this.globalData.userInfo = updateResult.result.data;
          this.globalData.isLoggedIn = true;
          wx.setStorageSync('userInfo', updateResult.result.data);
          return updateResult.result.data;
        }
      }
      throw new Error(result.message || '注册失败');
    } catch (err) {
      console.error('注册失败：', err);
      throw err;
    }
  },

  // 更新用户信息
  async updateUserInfo(userInfo) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'update',
          data: userInfo
        }
      });

      if (result.code === 0) {
        this.globalData.userInfo = result.data;
        wx.setStorageSync('userInfo', result.data);
        return result.data;
      }
    } catch (err) {
      console.error('更新用户信息失败：', err);
      throw err;
    }
  }
});
