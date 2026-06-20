// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const usersCollection = db.collection('users');

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event;
  const wxContext = cloud.getWXContext();

  switch (action) {
    case 'login':
      return handleLogin(wxContext);
    case 'getUser':
      return handleGetUser(data);
    case 'register':
      return handleRegister(data, wxContext);
    case 'update':
      return handleUpdate(data, wxContext);
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 登录 - 获取 openid
async function handleLogin(wxContext) {
  return {
    code: 0,
    data: {
      openid: wxContext.OPENID,
      appid: wxContext.APPID
    },
    message: '获取成功'
  };
}

// 获取用户信息
async function handleGetUser(data) {
  try {
    const { openid } = data;

    const res = await usersCollection.where({
      _id: openid
    }).get();

    if (res.data.length > 0) {
      return {
        code: 0,
        data: res.data[0],
        message: '获取成功'
      };
    } else {
      return {
        code: 1,
        data: null,
        message: '用户不存在'
      };
    }
  } catch (err) {
    console.error('获取用户失败：', err);
    return { code: -1, message: err.message || '获取失败' };
  }
}

// 注册用户
async function handleRegister(data, wxContext) {
  try {
    const openid = wxContext.OPENID;
    const { nickName, avatarUrl } = data;

    // 检查是否已存在
    const existRes = await usersCollection.where({
      _id: openid
    }).count();

    if (existRes.total > 0) {
      return { code: 1, message: '用户已存在' };
    }

    // 创建用户
    const userData = {
      _id: openid,
      nickName,
      avatarUrl,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };

    await usersCollection.add({
      data: userData
    });

    return {
      code: 0,
      data: userData,
      message: '注册成功'
    };
  } catch (err) {
    console.error('注册失败：', err);
    return { code: -1, message: err.message || '注册失败' };
  }
}

// 更新用户信息
async function handleUpdate(data, wxContext) {
  try {
    const openid = wxContext.OPENID;
    const { nickName, avatarUrl } = data;

    const updateData = {
      updateTime: db.serverDate()
    };

    if (nickName) updateData.nickName = nickName;
    if (avatarUrl) updateData.avatarUrl = avatarUrl;

    await usersCollection.doc(openid).update({
      data: updateData
    });

    // 获取更新后的数据
    const res = await usersCollection.doc(openid).get();

    return {
      code: 0,
      data: res.data,
      message: '更新成功'
    };
  } catch (err) {
    console.error('更新用户失败：', err);
    return { code: -1, message: err.message || '更新失败' };
  }
}
