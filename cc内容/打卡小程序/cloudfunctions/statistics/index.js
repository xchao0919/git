// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const checkInsCollection = db.collection('checkIns');
const membersCollection = db.collection('members');

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {
    case 'getUserStats':
      return handleGetUserStats(data, openid);
    case 'getGroupStats':
      return handleGetGroupStats(data);
    case 'getCalendar':
      return handleGetCalendar(data, openid);
    case 'getRanking':
      return handleGetRanking(data);
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 获取用户统计
async function handleGetUserStats(data, openid) {
  try {
    const { groupId } = data;

    const where = {
      userId: openid,
      status: 1
    };

    if (groupId) {
      where.groupId = groupId;
    }

    // 获取所有打卡记录
    const res = await checkInsCollection.where(where).get();

    const checkIns = res.data;
    const totalDays = checkIns.length;

    // 计算连续打卡天数
    const dates = checkIns.map(item => item.date).sort().reverse();
    const continuousDays = calcContinuousDays(dates);

    // 本月打卡天数
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthDays = checkIns.filter(item => item.date >= monthStart).length;

    return {
      code: 0,
      data: {
        totalDays,
        continuousDays,
        monthDays
      },
      message: '获取成功'
    };
  } catch (err) {
    console.error('获取用户统计失败：', err);
    return { code: -1, message: err.message || '获取失败' };
  }
}

// 获取群组统计
async function handleGetGroupStats(data) {
  try {
    const { groupId, year, month } = data;

    // 获取群组成员数量
    const memberRes = await membersCollection.where({
      groupId,
      status: 1
    }).count();

    // 构建日期范围
    const datePrefix = `${year}-${String(month).padStart(2, '0')}`;

    // 获取本月打卡记录
    const checkInRes = await checkInsCollection.where({
      groupId,
      status: 1,
      date: _.gte(datePrefix + '-01').and(_.lte(datePrefix + '-31'))
    }).get();

    // 统计每日打卡人数
    const dailyStats = {};
    checkInRes.data.forEach(item => {
      if (!dailyStats[item.date]) {
        dailyStats[item.date] = new Set();
      }
      dailyStats[item.date].add(item.userId);
    });

    // 转换为数组
    const dailyList = Object.keys(dailyStats).map(date => ({
      date,
      count: dailyStats[date].size
    }));

    // 本月总打卡次数
    const totalCheckIns = checkInRes.data.length;

    return {
      code: 0,
      data: {
        memberCount: memberRes.total,
        totalCheckIns,
        dailyList
      },
      message: '获取成功'
    };
  } catch (err) {
    console.error('获取群组统计失败：', err);
    return { code: -1, message: err.message || '获取失败' };
  }
}

// 获取打卡日历数据
async function handleGetCalendar(data, openid) {
  try {
    const { groupId, year, month } = data;

    const where = {
      userId: openid,
      status: 1
    };

    if (groupId) {
      where.groupId = groupId;
    }

    // 获取打卡记录
    const res = await checkInsCollection
      .where(where)
      .field({ date: true })
      .get();

    // 筛选指定月份
    const datePrefix = `${year}-${String(month).padStart(2, '0')}`;
    const checkedDates = res.data
      .filter(item => item.date.startsWith(datePrefix))
      .map(item => item.date);

    return {
      code: 0,
      data: checkedDates,
      message: '获取成功'
    };
  } catch (err) {
    console.error('获取日历数据失败：', err);
    return { code: -1, message: err.message || '获取失败' };
  }
}

// 获取排行榜
async function handleGetRanking(data) {
  try {
    const { groupId, type = 'total', limit = 10 } = data;

    // 获取所有成员
    const memberRes = await membersCollection.where({
      groupId,
      status: 1
    }).get();

    const members = memberRes.data;

    // 获取每个成员的打卡数量
    const statsPromises = members.map(async (member) => {
      const countRes = await checkInsCollection.where({
        groupId,
        userId: member.userId,
        status: 1
      }).count();

      return {
        userId: member.userId,
        role: member.role,
        checkInCount: countRes.total
      };
    });

    const stats = await Promise.all(statsPromises);

    // 获取用户信息
    const userIds = stats.map(s => s.userId);
    const usersCollection = db.collection('users');
    const usersRes = await usersCollection.where({
      _id: _.in(userIds)
    }).get();

    const usersMap = {};
    usersRes.data.forEach(user => {
      usersMap[user._id] = user;
    });

    // 组合数据
    const rankingList = stats.map(stat => ({
      ...stat,
      userInfo: usersMap[stat.userId] || null
    }));

    // 排序
    rankingList.sort((a, b) => b.checkInCount - a.checkInCount);

    // 取前N名
    const topList = rankingList.slice(0, limit);

    return {
      code: 0,
      data: topList,
      message: '获取成功'
    };
  } catch (err) {
    console.error('获取排行榜失败：', err);
    return { code: -1, message: err.message || '获取失败' };
  }
}

// 计算连续打卡天数
function calcContinuousDays(dates) {
  if (!dates || dates.length === 0) return 0;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(today.getTime() - 86400000);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  // 如果最新打卡不是今天或昨天，连续天数为0
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    return 0;
  }

  let continuous = 1;
  let prevDate = new Date(dates[0]);

  for (let i = 1; i < dates.length; i++) {
    const currDate = new Date(dates[i]);
    const diffDays = Math.floor((prevDate - currDate) / 86400000);

    if (diffDays === 1) {
      continuous++;
      prevDate = currDate;
    } else {
      break;
    }
  }

  return continuous;
}
