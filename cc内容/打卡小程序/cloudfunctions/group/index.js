// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const groupsCollection = db.collection('groups');
const membersCollection = db.collection('members');

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {
    case 'create':
      return handleCreate(data, openid);
    case 'update':
      return handleUpdate(data, openid);
    case 'getDetail':
      return handleGetDetail(data);
    case 'getList':
      return handleGetList(data, openid);
    case 'getBook':
      return handleGetBook(data);
    case 'join':
      return handleJoin(data, openid);
    case 'quit':
      return handleQuit(data, openid);
    case 'setAdmin':
      return handleSetAdmin(data, openid);
    case 'removeAdmin':
      return handleRemoveAdmin(data, openid);
    case 'kickMember':
      return handleKickMember(data, openid);
    case 'dissolve':
      return handleDissolve(data, openid);
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 创建群组
async function handleCreate(data, openid) {
  try {
    const { name, description, coverUrl, checkInConfig } = data;

    // 创建群组
    const groupData = {
      name,
      description: description || '',
      coverUrl: coverUrl || '',
      ownerId: openid,
      adminIds: [],
      memberCount: 1,
      checkInConfig: checkInConfig || {
        type: 'daily',
        startTime: '00:00',
        endTime: '23:59',
        requiredTypes: ['text'],
        minWords: 10
      },
      status: 1,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };

    const groupRes = await groupsCollection.add({
      data: groupData
    });

    // 创建成员记录（群主）
    await membersCollection.add({
      data: {
        groupId: groupRes._id,
        userId: openid,
        role: 1, // 群主
        permissions: [],
        joinTime: db.serverDate(),
        status: 1
      }
    });

    return {
      code: 0,
      data: { _id: groupRes._id, ...groupData },
      message: '创建成功'
    };
  } catch (err) {
    console.error('创建群组失败：', err);
    return { code: -1, message: err.message || '创建失败' };
  }
}

// 更新群组
async function handleUpdate(data, openid) {
  try {
    const { groupId, ...updateData } = data;

    // 检查权限
    const groupRes = await groupsCollection.doc(groupId).get();
    if (groupRes.data.ownerId !== openid) {
      return { code: 403, message: '无权限操作' };
    }

    await groupsCollection.doc(groupId).update({
      data: {
        ...updateData,
        updateTime: db.serverDate()
      }
    });

    return { code: 0, message: '更新成功' };
  } catch (err) {
    console.error('更新群组失败：', err);
    return { code: -1, message: err.message || '更新失败' };
  }
}

// 获取群组详情
async function handleGetDetail(data) {
  try {
    const { groupId, excludeBookContent } = data;

    const groupRes = await groupsCollection.doc(groupId).get();

    if (!groupRes.data || groupRes.data.status === 0) {
      return { code: 1, message: '群组不存在或已解散' };
    }

    const groupData = groupRes.data;

    // 如果书籍内容太大，排除或截断
    if (groupData.book && groupData.book.chapters) {
      if (excludeBookContent) {
        // 只返回书籍元信息
        groupData.book = {
          title: groupData.book.title,
          chapterCount: groupData.book.chapters.length
        };
      } else {
        // 检查书籍大小，如果太大则截断章节内容
        const bookSize = JSON.stringify(groupData.book).length;
        if (bookSize > 500000) { // 超过500KB
          // 只保留章节标题，不返回内容
          groupData.book = {
            title: groupData.book.title,
            chapters: groupData.book.chapters.map(ch => ({
              title: ch.title,
              content: ch.content ? ch.content.substring(0, 200) : ''
            }))
          };
        }
      }
    }

    return {
      code: 0,
      data: groupData,
      message: '获取成功'
    };
  } catch (err) {
    console.error('获取群组详情失败：', err);
    return { code: -1, message: err.message || '获取失败' };
  }
}

// 获取书籍内容（支持分章节）
async function handleGetBook(data) {
  try {
    const { groupId, chapterIndex } = data;

    const groupRes = await groupsCollection.doc(groupId).get();

    if (!groupRes.data || groupRes.data.status === 0) {
      return { code: 1, message: '群组不存在或已解散' };
    }

    const book = groupRes.data.book;
    if (!book || !book.chapters) {
      return { code: 1, message: '该群组暂无书籍' };
    }

    // 如果指定了章节索引，返回单个章节
    if (chapterIndex !== undefined) {
      const chapter = book.chapters[chapterIndex];
      if (!chapter) {
        return { code: 1, message: '章节不存在' };
      }
      return {
        code: 0,
        data: {
          title: book.title,
          chapterCount: book.chapters.length,
          currentChapter: chapterIndex,
          chapter: chapter
        },
        message: '获取成功'
      };
    }

    // 否则返回书籍元信息
    return {
      code: 0,
      data: {
        title: book.title,
        chapterCount: book.chapters.length,
        chapters: book.chapters.map(ch => ({ title: ch.title }))
      },
      message: '获取成功'
    };
  } catch (err) {
    console.error('获取书籍失败：', err);
    return { code: -1, message: err.message || '获取失败' };
  }
}

// 获取群组列表
async function handleGetList(data, openid) {
  try {
    const { type = 'joined', skip = 0, limit = 20 } = data;

    console.log('handleGetList called:', { type, openid, skip, limit });

    if (type === 'joined') {
      // 获取我加入的群组
      const memberRes = await membersCollection.where({
        userId: openid,
        status: 1
      }).skip(skip).limit(limit).get();

      console.log('memberRes:', memberRes);

      const groupIds = memberRes.data.map(m => m.groupId);
      console.log('groupIds:', groupIds);

      if (groupIds.length === 0) {
        return { code: 0, data: [], message: '获取成功' };
      }

      // 逐个查询群组，避免 _.in() 的类型问题
      const groups = [];
      for (const groupId of groupIds) {
        try {
          const groupRes = await groupsCollection.doc(groupId).get();
          if (groupRes.data && groupRes.data.status === 1) {
            const groupData = groupRes.data;
            // 排除书籍内容，只保留元信息
            if (groupData.book) {
              groupData.book = {
                title: groupData.book.title,
                chapterCount: groupData.book.chapters ? groupData.book.chapters.length : 0
              };
            }
            groups.push(groupData);
          }
        } catch (e) {
          console.log('group not found:', groupId);
        }
      }

      console.log('groups:', groups);

      return {
        code: 0,
        data: groups,
        message: '获取成功'
      };
    } else if (type === 'owned') {
      // 获取我创建的群组
      const groupsRes = await groupsCollection.where({
        ownerId: openid,
        status: 1
      }).skip(skip).limit(limit).get();

      console.log('owned groupsRes:', groupsRes);

      // 排除书籍内容
      const groups = groupsRes.data.map(group => {
        if (group.book) {
          group.book = {
            title: group.book.title,
            chapterCount: group.book.chapters ? group.book.chapters.length : 0
          };
        }
        return group;
      });

      return {
        code: 0,
        data: groups,
        message: '获取成功'
      };
    }

    return { code: 0, data: [], message: '获取成功' };
  } catch (err) {
    console.error('获取群组列表失败：', err);
    return { code: -1, message: err.message || '获取失败' };
  }
}

// 加入群组
async function handleJoin(data, openid) {
  try {
    const { groupId } = data;

    // 检查群组是否存在
    const groupRes = await groupsCollection.doc(groupId).get();
    if (!groupRes.data || groupRes.data.status === 0) {
      return { code: 1, message: '群组不存在或已解散' };
    }

    // 检查是否已加入
    const existRes = await membersCollection.where({
      groupId,
      userId: openid,
      status: 1
    }).count();

    if (existRes.total > 0) {
      return { code: 1, message: '已加入该群组' };
    }

    // 创建成员记录
    await membersCollection.add({
      data: {
        groupId,
        userId: openid,
        role: 3, // 普通成员
        permissions: [],
        joinTime: db.serverDate(),
        status: 1
      }
    });

    // 更新群组成员数量
    await groupsCollection.doc(groupId).update({
      data: {
        memberCount: _.inc(1),
        updateTime: db.serverDate()
      }
    });

    return { code: 0, message: '加入成功' };
  } catch (err) {
    console.error('加入群组失败：', err);
    return { code: -1, message: err.message || '加入失败' };
  }
}

// 退出群组
async function handleQuit(data, openid) {
  try {
    const { groupId } = data;

    // 检查是否是群主
    const groupRes = await groupsCollection.doc(groupId).get();
    if (groupRes.data.ownerId === openid) {
      return { code: 1, message: '群主不能退出群组，请转让群主或解散群组' };
    }

    // 更新成员状态
    await membersCollection.where({
      groupId,
      userId: openid
    }).update({
      data: {
        status: 0
      }
    });

    // 更新群组成员数量
    await groupsCollection.doc(groupId).update({
      data: {
        memberCount: _.inc(-1),
        updateTime: db.serverDate()
      }
    });

    return { code: 0, message: '退出成功' };
  } catch (err) {
    console.error('退出群组失败：', err);
    return { code: -1, message: err.message || '退出失败' };
  }
}

// 设置管理员
async function handleSetAdmin(data, openid) {
  try {
    const { groupId, userId } = data;

    // 检查权限
    const groupRes = await groupsCollection.doc(groupId).get();
    if (groupRes.data.ownerId !== openid) {
      return { code: 403, message: '无权限操作' };
    }

    // 更新成员角色
    await membersCollection.where({
      groupId,
      userId
    }).update({
      data: {
        role: 2 // 管理员
      }
    });

    // 更新群组管理员列表
    await groupsCollection.doc(groupId).update({
      data: {
        adminIds: _.push(userId),
        updateTime: db.serverDate()
      }
    });

    return { code: 0, message: '设置成功' };
  } catch (err) {
    console.error('设置管理员失败：', err);
    return { code: -1, message: err.message || '设置失败' };
  }
}

// 移除管理员
async function handleRemoveAdmin(data, openid) {
  try {
    const { groupId, userId } = data;

    // 检查权限
    const groupRes = await groupsCollection.doc(groupId).get();
    if (groupRes.data.ownerId !== openid) {
      return { code: 403, message: '无权限操作' };
    }

    // 更新成员角色
    await membersCollection.where({
      groupId,
      userId
    }).update({
      data: {
        role: 3 // 普通成员
      }
    });

    // 更新群组管理员列表
    const adminIds = groupRes.data.adminIds.filter(id => id !== userId);
    await groupsCollection.doc(groupId).update({
      data: {
        adminIds,
        updateTime: db.serverDate()
      }
    });

    return { code: 0, message: '移除成功' };
  } catch (err) {
    console.error('移除管理员失败：', err);
    return { code: -1, message: err.message || '移除失败' };
  }
}

// 踢出成员
async function handleKickMember(data, openid) {
  try {
    const { groupId, userId } = data;

    // 检查权限
    const groupRes = await groupsCollection.doc(groupId).get();
    const memberRes = await membersCollection.where({
      groupId,
      userId: openid,
      status: 1
    }).get();

    const currentUser = memberRes.data[0];
    if (!currentUser || (currentUser.role !== 1 && currentUser.role !== 2)) {
      return { code: 403, message: '无权限操作' };
    }

    // 不能踢群主
    if (userId === groupRes.data.ownerId) {
      return { code: 1, message: '不能踢出群主' };
    }

    // 更新成员状态
    await membersCollection.where({
      groupId,
      userId
    }).update({
      data: {
        status: 0
      }
    });

    // 更新群组成员数量
    await groupsCollection.doc(groupId).update({
      data: {
        memberCount: _.inc(-1),
        updateTime: db.serverDate()
      }
    });

    return { code: 0, message: '踢出成功' };
  } catch (err) {
    console.error('踢出成员失败：', err);
    return { code: -1, message: err.message || '踢出失败' };
  }
}

// 解散群组
async function handleDissolve(data, openid) {
  try {
    const { groupId } = data;

    // 检查权限
    const groupRes = await groupsCollection.doc(groupId).get();
    if (groupRes.data.ownerId !== openid) {
      return { code: 403, message: '无权限操作' };
    }

    // 更新群组状态
    await groupsCollection.doc(groupId).update({
      data: {
        status: 0,
        updateTime: db.serverDate()
      }
    });

    // 更新所有成员状态
    await membersCollection.where({
      groupId
    }).update({
      data: {
        status: 0
      }
    });

    return { code: 0, message: '解散成功' };
  } catch (err) {
    console.error('解散群组失败：', err);
    return { code: -1, message: err.message || '解散失败' };
  }
}
