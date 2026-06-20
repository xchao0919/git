// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const checkInsCollection = db.collection('checkIns');
const membersCollection = db.collection('members');
const groupsCollection = db.collection('groups');

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {
    case 'create':
      return handleCreate(data, openid);
    case 'getList':
      return handleGetList(data);
    case 'getMyList':
      return handleGetMyList(data, openid);
    case 'delete':
      return handleDelete(data, openid);
    case 'getTodayStatus':
      return handleGetTodayStatus(data, openid);
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 创建打卡记录
async function handleCreate(data, openid) {
  try {
    const { groupId, content } = data;

    // 检查是否是群成员
    const memberRes = await membersCollection.where({
      groupId,
      userId: openid,
      status: 1
    }).count();

    if (memberRes.total === 0) {
      return { code: 403, message: '您不是该群组成员' };
    }

    // 获取今天日期
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 检查今天是否已打卡
    const existRes = await checkInsCollection.where({
      groupId,
      userId: openid,
      date: dateStr,
      status: 1
    }).count();

    if (existRes.total > 0) {
      return { code: 1, message: '今日已打卡' };
    }

    // 创建打卡记录
    const checkInData = {
      groupId,
      userId: openid,
      date: dateStr,
      content: {
        text: content.text || '',
        images: content.images || [],
        video: content.video || '',
        audio: content.audio || ''
      },
      status: 1,
      createTime: db.serverDate()
    };

    const res = await checkInsCollection.add({
      data: checkInData
    });

    return {
      code: 0,
      data: { _id: res._id, ...checkInData },
      message: '打卡成功'
    };
  } catch (err) {
    console.error('打卡失败：', err);
    return { code: -1, message: err.message || '打卡失败' };
  }
}

// 获取群组打卡列表
async function handleGetList(data) {
  try {
    const { groupId, date, skip = 0, limit = 20 } = data;

    const where = {
      groupId,
      status: 1
    };

    if (date) {
      where.date = date;
    }

    const res = await checkInsCollection
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    // 获取用户信息
    const userIds = [...new Set(res.data.map(item => item.userId))];
    const usersCollection = db.collection('users');
    const usersRes = await usersCollection.where({
      _id: _.in(userIds)
    }).get();

    const usersMap = {};
    usersRes.data.forEach(user => {
      usersMap[user._id] = user;
    });

    const list = res.data.map(item => ({
      ...item,
      userInfo: usersMap[item.userId] || null
    }));

    return {
      code: 0,
      data: list,
      message: '获取成功'
    };
  } catch (err) {
    console.error('获取打卡列表失败：', err);
    return { code: -1, message: err.message || '获取失败' };
  }
}

// 获取我的打卡列表
async function handleGetMyList(data, openid) {
  try {
    const { groupId, skip = 0, limit = 30 } = data;

    const where = {
      userId: openid,
      status: 1
    };

    if (groupId) {
      where.groupId = groupId;
    }

    const res = await checkInsCollection
      .where(where)
      .orderBy('date', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    return {
      code: 0,
      data: res.data,
      message: '获取成功'
    };
  } catch (err) {
    console.error('获取我的打卡列表失败：', err);
    return { code: -1, message: err.message || '获取失败' };
  }
}

// 删除打卡记录
async function handleDelete(data, openid) {
  try {
    const { checkInId } = data;

    // 检查打卡记录是否存在且属于当前用户
    const checkInRes = await checkInsCollection.doc(checkInId).get();

    if (!checkInRes.data || checkInRes.data.status === 0) {
      return { code: 1, message: '打卡记录不存在' };
    }

    if (checkInRes.data.userId !== openid) {
      return { code: 403, message: '无权限操作' };
    }

    // 软删除
    await checkInsCollection.doc(checkInId).update({
      data: {
        status: 0
      }
    });

    return { code: 0, message: '删除成功' };
  } catch (err) {
    console.error('删除打卡记录失败：', err);
    return { code: -1, message: err.message || '删除失败' };
  }
}

// 获取今日打卡状态
async function handleGetTodayStatus(data, openid) {
  try {
    const { groupId } = data;

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const res = await checkInsCollection.where({
      groupId,
      userId: openid,
      date: dateStr,
      status: 1
    }).count();

    return {
      code: 0,
      data: {
        checked: res.total > 0,
        date: dateStr
      },
      message: '获取成功'
    };
  } catch (err) {
    console.error('获取今日打卡状态失败：', err);
    return { code: -1, message: err.message || '获取失败' };
  }
}
