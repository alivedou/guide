/**
 * @fileoverview Feature module: audit-map
 */
// 审计日志动作语义化映射
const AuditActionMap = {
    'LOGIN': { label: '安全登录', color: '#2ecc71' },
    'CREATE_USER': { label: '创建用户', color: '#3498db' },
    'DELETE_USER': { label: '危险：物理删除', color: '#e74c3c' },
    'CHANGE_USER_STATUS': { label: '状态切换', color: '#f39c12' },
    'CHANGE_USER_ROLE': { label: '权限变更', color: '#9b59b6' },
    'RESET_PASSWORD': { label: '重置密码', color: '#e67e22' },
    'RESET_TEMP_PASSWORD': { label: '临时密码', color: '#f39c12' },
    'UPDATE_SITE_CONFIG': { label: '配置修改', color: '#e74c3c' },
    'CREATE_ANNOUNCEMENT': { label: '发布公告', color: '#3498db' },
    'UPDATE_ANNOUNCEMENT': { label: '编辑公告', color: '#f39c12' },
    'DELETE_ANNOUNCEMENT': { label: '下架公告', color: '#95a5a6' },
    'BATCH_GENERATE_INVITATIONS': { label: '批量生成邀请码', color: '#1abc9c' },
    'DELETE_INVITATION': { label: '作废邀请码', color: '#95a5a6' }
};
window.AuditActionMap = AuditActionMap;
