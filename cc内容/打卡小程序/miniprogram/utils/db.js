/**
 * 数据库操作工具
 */

const db = wx.cloud.database();
const _ = db.command;

const DB = {
  // 数据库实例
  db,
  command: _,

  // 集合名称
  collections: {
    users: 'users',
    groups: 'groups',
    members: 'members',
    checkIns: 'checkIns',
    permissions: 'permissions'
  },

  /**
   * 添加文档
   * @param {string} collection 集合名称
   * @param {object} data 文档数据
   */
  async add(collection, data) {
    try {
      const res = await db.collection(collection).add({
        data: {
          ...data,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
      return { code: 0, data: res, message: '添加成功' };
    } catch (err) {
      console.error('添加文档失败：', err);
      return { code: -1, message: err.message || '添加失败' };
    }
  },

  /**
   * 根据ID获取文档
   * @param {string} collection 集合名称
   * @param {string} id 文档ID
   */
  async getById(collection, id) {
    try {
      const res = await db.collection(collection).doc(id).get();
      return { code: 0, data: res.data, message: '获取成功' };
    } catch (err) {
      console.error('获取文档失败：', err);
      return { code: -1, message: err.message || '获取失败' };
    }
  },

  /**
   * 查询文档列表
   * @param {string} collection 集合名称
   * @param {object} options 查询选项
   */
  async getList(collection, options = {}) {
    try {
      const {
        where = {},
        field = {},
        orderBy = { createTime: 'desc' },
        skip = 0,
        limit = 20
      } = options;

      let query = db.collection(collection);

      // 条件
      if (Object.keys(where).length > 0) {
        query = query.where(where);
      }

      // 字段
      if (Object.keys(field).length > 0) {
        query = query.field(field);
      }

      // 排序
      for (const key in orderBy) {
        query = query.orderBy(key, orderBy[key]);
      }

      // 分页
      query = query.skip(skip).limit(limit);

      const res = await query.get();
      return { code: 0, data: res.data, message: '获取成功' };
    } catch (err) {
      console.error('查询列表失败：', err);
      return { code: -1, message: err.message || '查询失败' };
    }
  },

  /**
   * 查询单个文档
   * @param {string} collection 集合名称
   * @param {object} where 查询条件
   */
  async getOne(collection, where) {
    try {
      const res = await db.collection(collection).where(where).limit(1).get();
      return { code: 0, data: res.data[0] || null, message: '获取成功' };
    } catch (err) {
      console.error('查询单个文档失败：', err);
      return { code: -1, message: err.message || '查询失败' };
    }
  },

  /**
   * 更新文档
   * @param {string} collection 集合名称
   * @param {string} id 文档ID
   * @param {object} data 更新数据
   */
  async update(collection, id, data) {
    try {
      const res = await db.collection(collection).doc(id).update({
        data: {
          ...data,
          updateTime: db.serverDate()
        }
      });
      return { code: 0, data: res, message: '更新成功' };
    } catch (err) {
      console.error('更新文档失败：', err);
      return { code: -1, message: err.message || '更新失败' };
    }
  },

  /**
   * 根据条件更新文档
   * @param {string} collection 集合名称
   * @param {object} where 查询条件
   * @param {object} data 更新数据
   */
  async updateWhere(collection, where, data) {
    try {
      const res = await db.collection(collection).where(where).update({
        data: {
          ...data,
          updateTime: db.serverDate()
        }
      });
      return { code: 0, data: res, message: '更新成功' };
    } catch (err) {
      console.error('更新文档失败：', err);
      return { code: -1, message: err.message || '更新失败' };
    }
  },

  /**
   * 删除文档
   * @param {string} collection 集合名称
   * @param {string} id 文档ID
   */
  async remove(collection, id) {
    try {
      const res = await db.collection(collection).doc(id).remove();
      return { code: 0, data: res, message: '删除成功' };
    } catch (err) {
      console.error('删除文档失败：', err);
      return { code: -1, message: err.message || '删除失败' };
    }
  },

  /**
   * 统计文档数量
   * @param {string} collection 集合名称
   * @param {object} where 查询条件
   */
  async count(collection, where = {}) {
    try {
      const res = await db.collection(collection).where(where).count();
      return { code: 0, data: res.total, message: '统计成功' };
    } catch (err) {
      console.error('统计失败：', err);
      return { code: -1, message: err.message || '统计失败' };
    }
  },

  /**
   * 聚合查询
   * @param {string} collection 集合名称
   * @param {array} pipeline 聚合管道
   */
  async aggregate(collection, pipeline) {
    try {
      let query = db.collection(collection).aggregate();

      for (const stage of pipeline) {
        for (const key in stage) {
          query = query[key](stage[key]);
        }
      }

      const res = await query.end();
      return { code: 0, data: res.list, message: '聚合成功' };
    } catch (err) {
      console.error('聚合查询失败：', err);
      return { code: -1, message: err.message || '聚合失败' };
    }
  }
};

module.exports = DB;
