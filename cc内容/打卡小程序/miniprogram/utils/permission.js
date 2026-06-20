/**
 * 权限管理工具
 */

const DB = require('./db');

// 角色定义
const ROLES = {
  OWNER: 1,      // 群主
  ADMIN: 2,      // 管理员
  MEMBER: 3      // 普通成员
};

// 权限定义
const PERMISSIONS = {
  GROUP_MANAGE: 'group_manage',       // 群组设置
  MEMBER_MANAGE: 'member_manage',     // 成员管理
  CHECKIN_AUDIT: 'checkin_audit',     // 打卡审核
  ANNOUNCEMENT: 'announcement',       // 发布公告
  RULE_SETTING: 'rule_setting',       // 打卡规则设置
  ADMIN_ASSIGN: 'admin_assign',       // 指定管理员
  STATISTICS_VIEW: 'statistics_view', // 查看统计
  DATA_EXPORT: 'data_export'          // 数据导出
};

// 默认权限配置（按角色）
const DEFAULT_PERMISSIONS = {
  [ROLES.OWNER]: Object.values(PERMISSIONS), // 群主拥有所有权限
  [ROLES.ADMIN]: [
    PERMISSIONS.MEMBER_MANAGE,
    PERMISSIONS.CHECKIN_AUDIT,
    PERMISSIONS.ANNOUNCEMENT,
    PERMISSIONS.STATISTICS_VIEW,
    PERMISSIONS.DATA_EXPORT
  ],
  [ROLES.MEMBER]: [
    PERMISSIONS.STATISTICS_VIEW
  ]
};

const Permission = {
  ROLES,
  PERMISSIONS,
  DEFAULT_PERMISSIONS,

  /**
   * 获取用户在群组中的角色
   * @param {string} groupId 群组ID
   * @param {string} userId 用户ID
   */
  async getUserRole(groupId, userId) {
    try {
      const { data: member } = await DB.getOne(DB.collections.members, {
        groupId,
        userId,
        status: 1
      });

      if (!member) {
        return null;
      }

      return member.role;
    } catch (err) {
      console.error('获取用户角色失败：', err);
      return null;
    }
  },

  /**
   * 获取用户的权限列表
   * @param {string} groupId 群组ID
   * @param {string} userId 用户ID
   */
  async getUserPermissions(groupId, userId) {
    try {
      const { data: member } = await DB.getOne(DB.collections.members, {
        groupId,
        userId,
        status: 1
      });

      if (!member) {
        return [];
      }

      // 如果成员有自定义权限，使用自定义权限
      if (member.permissions && member.permissions.length > 0) {
        return member.permissions;
      }

      // 否则使用角色默认权限
      return DEFAULT_PERMISSIONS[member.role] || [];
    } catch (err) {
      console.error('获取用户权限失败：', err);
      return [];
    }
  },

  /**
   * 检查用户是否有某个权限
   * @param {string} groupId 群组ID
   * @param {string} userId 用户ID
   * @param {string} permission 权限代码
   */
  async hasPermission(groupId, userId, permission) {
    const permissions = await this.getUserPermissions(groupId, userId);
    return permissions.includes(permission);
  },

  /**
   * 检查用户是否有多个权限中的任意一个
   * @param {string} groupId 群组ID
   * @param {string} userId 用户ID
   * @param {array} permissionList 权限代码列表
   */
  async hasAnyPermission(groupId, userId, permissionList) {
    const permissions = await this.getUserPermissions(groupId, userId);
    return permissionList.some(p => permissions.includes(p));
  },

  /**
   * 检查用户是否是群主
   * @param {string} groupId 群组ID
   * @param {string} userId 用户ID
   */
  async isOwner(groupId, userId) {
    const role = await this.getUserRole(groupId, userId);
    return role === ROLES.OWNER;
  },

  /**
   * 检查用户是否是管理员（包括群主）
   * @param {string} groupId 群组ID
   * @param {string} userId 用户ID
   */
  async isAdmin(groupId, userId) {
    const role = await this.getUserRole(groupId, userId);
    return role === ROLES.OWNER || role === ROLES.ADMIN;
  },

  /**
   * 设置成员权限
   * @param {string} memberId 成员记录ID
   * @param {array} permissions 权限列表
   */
  async setMemberPermissions(memberId, permissions) {
    return await DB.update(DB.collections.members, memberId, {
      permissions
    });
  },

  /**
   * 获取权限名称
   * @param {string} code 权限代码
   */
  getPermissionName(code) {
    const names = {
      [PERMISSIONS.GROUP_MANAGE]: '群组设置',
      [PERMISSIONS.MEMBER_MANAGE]: '成员管理',
      [PERMISSIONS.CHECKIN_AUDIT]: '打卡审核',
      [PERMISSIONS.ANNOUNCEMENT]: '发布公告',
      [PERMISSIONS.RULE_SETTING]: '打卡规则设置',
      [PERMISSIONS.ADMIN_ASSIGN]: '指定管理员',
      [PERMISSIONS.STATISTICS_VIEW]: '查看统计',
      [PERMISSIONS.DATA_EXPORT]: '数据导出'
    };
    return names[code] || code;
  },

  /**
   * 获取角色名称
   * @param {number} role 角色值
   */
  getRoleName(role) {
    const names = {
      [ROLES.OWNER]: '群主',
      [ROLES.ADMIN]: '管理员',
      [ROLES.MEMBER]: '成员'
    };
    return names[role] || '未知';
  }
};

module.exports = Permission;
