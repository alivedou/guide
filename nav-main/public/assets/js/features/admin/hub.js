import { renderAdminUserTableHTML } from './users.js';
import { renderAdminInviteTableHTML } from './invites.js';
import { renderAdminAnnounceTableHTML } from './announcements.js';
import { renderAdminAuditTableHTML } from './audit.js';

// ==================== 10. 管理员后台 (Admin Hub) ====================

window.openAdminHub = async (defaultTab = 'users') => {
    window.lastFocusedElement = document.activeElement; 
    // 切换弹窗启用静默模式
    if (typeof window.closeAllModals === 'function') window.closeAllModals(true);

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');

    if (!modal || !body) return;

    modal.dataset.modalType = 'admin-hub';
    title.innerText = "管理员控制中心 (Admin Hub)";
    body.innerHTML = '<div class="admin-hub-loading">正在加载全站数据...</div>';
    modal.style.display = 'flex';
    confirmBtn.style.display = 'none'; // 后台采用即时操作

    // 初始化筛选状态
    window.adminUserFilters = { page: 1, pageSize: 20, keyword: '', status: '' };
    window.adminSelectedUserIds.clear();
    window.adminAnnounceFilters = { page: 1, pageSize: 20, keyword: '', status: '', type: '' };
    window.adminSelectedAnnounceIds.clear();
    window.adminInviteFilters = { page: 1, pageSize: 20, keyword: '', status: '' };
    window.adminSelectedInviteIds.clear();
    window.adminAuditFilters = { page: 1, pageSize: 20, keyword: '', actionType: '' };
    window.adminSelectedAuditIds.clear();

    if (typeof window.updateAdminBatchBar === 'function') window.updateAdminBatchBar();
    if (typeof window.updateAnnounceBatchBar === 'function') window.updateAnnounceBatchBar();
    if (typeof window.updateInviteBatchBar === 'function') window.updateInviteBatchBar();
    if (typeof window.updateAuditBatchBar === 'function') window.updateAuditBatchBar();

    try {
        const [usersRes, inviteRes, announceRes, auditRes] = await Promise.all([
            fetch(`/api/admin/users?page=1&pageSize=20`, { headers: { 'Authorization': window.sysToken } }),
            fetch(`/api/admin/invitations?page=1&pageSize=20`, { headers: { 'Authorization': window.sysToken } }),
            fetch(`/api/admin/announcements?page=1&pageSize=20`, { headers: { 'Authorization': window.sysToken } }),
            fetch(`/api/admin/audit-logs?page=1&pageSize=20`, { headers: { 'Authorization': window.sysToken } })
        ]);

        const userData = await usersRes.json();
        const inviteData = await inviteRes.json();
        const announceData = await announceRes.json();
        const auditData = await auditRes.json();

        // 同步到内存状态
        window.adminData = {
            users: userData.users || [],
            invitations: inviteData.invitations || [],
            announcements: announceData.announcements || [],
            logs: auditData.logs || [],
            pagination: userData.pagination || {}
        };

        body.innerHTML = `
            <div class="admin-hub-tabs">
                <button class="hub-tab ${defaultTab === 'users' ? 'active' : ''}" data-tab="users" onclick="switchHubTab('users')">用户管理</button>
                <button class="hub-tab ${defaultTab === 'invites' ? 'active' : ''}" data-tab="invites" onclick="switchHubTab('invites')">邀请管理</button>
                <button class="hub-tab ${defaultTab === 'announcements' ? 'active' : ''}" data-tab="announcements" onclick="switchHubTab('announcements')">公告管理</button>
                <button class="hub-tab ${defaultTab === 'audit' ? 'active' : ''}" data-tab="audit" onclick="switchHubTab('audit')">审计日志</button>
            </div>
            <div id="hub-content-users" class="hub-pane ${defaultTab === 'users' ? 'active' : ''}">
                <!-- 折叠式搜索/筛选面板 -->
                <div class="admin-search-panel">
                    <div class="admin-search-header" onclick="toggleAdminSearch()">
                        <span style="font-size: 13px; font-weight: bold;"><i class="ri-search-line"></i> 搜索与筛选面板</span>
                        <i id="admin-search-arrow" class="ri-arrow-down-s-line"></i>
                    </div>
                    <div id="admin-search-body" class="admin-search-body collapsed">
                        <div class="form-group" style="margin-bottom:0">
                            <label>关键字检索</label>
                            <input type="text" id="admin-user-kw" placeholder="搜索用户名 / UID..." oninput="handleAdminUserSearch(this.value)">
                        </div>
                        <div class="form-group" style="margin-bottom:0">
                            <label>状态筛选</label>
                            <select id="admin-user-status" onchange="handleAdminUserFilter('status', this.value)">
                                <option value="">全部状态</option>
                                <option value="active">活跃 (Active)</option>
                                <option value="frozen">冻结 (Frozen)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 批量操作栏  -->
                <div id="admin-user-batch-bar" class="admin-batch-bar">
                    <span id="user-batch-count">已选中 0 名用户</span>
                    <div style="display:flex; gap:10px;">
                        <button class="batch-btn" onclick="exportUsersCSV()"><i class="ri-download-2-line"></i> CSV 批量导出</button>
                        <button class="batch-btn" style="background: rgba(255,255,255,0.08); color: var(--text) !important;" onclick="clearAdminUserSelection()"><i class="ri-close-line"></i> 清除选择</button>
                    </div>
                </div>

                <div id="admin-users-table-container">
                    ${renderAdminUserTableHTML(userData.users || [])}
                </div>
            </div>
            <div id="hub-content-invites" class="hub-pane ${defaultTab === 'invites' ? 'active' : ''}">
                <div style="display:flex; gap:10px; margin-bottom:15px; align-items:center;">
                    <div style="display:flex; gap:8px;">
                        <button class="tab-btn active" onclick="generateInvites(1)">+ 1</button>
                        <button class="tab-btn active" onclick="generateInvites(5)">+ 5</button>
                    </div>
                    <button class="tab-btn" onclick="copyUnusedInvites()"><i class="ri-file-copy-line"></i> 复制未使用</button>
                </div>

                <div class="admin-search-panel">
                    <div class="admin-search-header" onclick="toggleInviteSearch()">
                        <span style="font-size: 13px; font-weight: bold;"><i class="ri-search-line"></i> 邀请码搜索</span>
                        <i id="invite-search-arrow" class="ri-arrow-down-s-line"></i>
                    </div>
                    <div id="invite-search-body" class="admin-search-body collapsed">
                        <div class="form-row" style="display:grid; grid-template-columns: 2fr 1fr; gap:10px;">
                            <input type="text" id="invite-search-kw" placeholder="搜索邀请码/使用者..." oninput="handleAdminInviteSearch(this.value)">
                            <select id="invite-filter-status" onchange="handleAdminInviteFilter('status', this.value)">
                                <option value="">全部状态</option>
                                <option value="unused">未使用</option>
                                <option value="used">已使用</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 批量操作栏  -->
                <div id="admin-invite-batch-bar" class="admin-batch-bar">
                    <span id="invite-batch-count">已选中 0 项</span>
                    <div style="display:flex; gap:10px;">
                        <button class="batch-btn danger" onclick="batchInviteAction('delete')"><i class="ri-close-circle-line"></i> 批量下架</button>
                    </div>
                </div>

                <div id="admin-invite-table-container" style="margin-top:15px;">
                    ${renderAdminInviteTableHTML(inviteData.invitations || [], inviteData.pagination)}
                </div>
            </div>
            <div id="hub-content-announcements" class="hub-pane ${defaultTab === 'announcements' ? 'active' : ''}">
                <div class="admin-announce-editor" style="padding:12px; background:rgba(255,255,255,0.03); border:1px dashed var(--glass-border); border-radius:8px;">
                    <div style="font-size:12px; font-weight:bold; margin-bottom:10px; color:var(--text); display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="ri-edit-line"></i> 发布新公告 / 修改公告</span>
                        <button class="action-link" id="btn-toggle-editor" onclick="toggleAnnounceEditor()">收起编辑器</button>
                    </div>
                    <div id="announce-editor-fields">
                        <div class="form-group">
                            <input type="text" id="announce-title" placeholder="请输入公告标题...">
                        </div>
                        <div class="form-group">
                            <textarea id="announce-content" rows="3" placeholder="请输入公告详细内容..."></textarea>
                        </div>
                        <div class="form-row" style="display:flex; gap:15px; margin-bottom:10px;">
                            <div class="form-group" style="flex:1">
                                <label style="font-size:11px; opacity:0.7">展示层级</label>
                                <select id="announce-type">
                                    <option value="quiet">静默通知</option>
                                    <option value="important">横幅通知</option>
                                </select>
                            </div>
                            <div class="form-group" style="flex:1">
                                <label style="font-size:11px; opacity:0.7">过期时间 (可选)</label>
                                <input type="datetime-local" id="announce-expire">
                            </div>
                        </div>
                        <div class="form-group" style="display:flex; align-items:center; gap:15px;">
                            <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:12px;">
                                <input type="checkbox" id="announce-top"> 置顶公告
                            </label>
                            <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:12px;">
                                <input type="checkbox" id="announce-is-draft" onchange="handleAnnounceDraftChange(this.checked)"> 存为草稿
                            </label>
                        </div>
                        <div id="announce-actions" style="display:flex; gap:10px; margin-top:10px;">
                            <button id="btn-save-announce" class="tab-btn active" style="flex:1;" onclick="saveAnnouncement()">发布公告</button>
                            <button id="btn-cancel-announce" class="tab-btn" style="flex:1; display:none;" onclick="cancelEditAnnounce()">取消修改</button>
                        </div>
                    </div>
                </div>

                <div class="admin-search-panel" style="margin-top:15px;">
                    <div class="admin-search-header" onclick="toggleAnnounceSearch()">
                        <span style="font-size: 13px; font-weight: bold;"><i class="ri-search-line"></i> 公告搜索与筛选</span>
                        <i id="announce-search-arrow" class="ri-arrow-down-s-line"></i>
                    </div>
                    <div id="announce-search-body" class="admin-search-body collapsed">
                        <div class="form-group" style="margin-bottom:0">
                            <input type="text" id="announce-search-kw" placeholder="标题/内容搜索..." oninput="handleAdminAnnounceSearch(this.value)">
                        </div>
                        <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                            <select id="announce-filter-status" onchange="handleAdminAnnounceFilter('status', this.value)">
                                <option value="">全部状态</option>
                                <option value="published">已发布</option>
                                <option value="draft">草稿</option>
                            </select>
                            <select id="announce-filter-type" onchange="handleAdminAnnounceFilter('type', this.value)">
                                <option value="">全部类型</option>
                                <option value="quiet">静默通知</option>
                                <option value="important">横幅通知</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 批量操作栏  -->
                <div id="admin-announce-batch-bar" class="admin-batch-bar">
                    <span id="announce-batch-count">已选中 0 项</span>
                    <div style="display:flex; gap:10px;">
                        <button class="batch-btn" onclick="batchAnnounceAction('publish')"><i class="ri-checkbox-circle-line"></i> 一键发布</button>
                        <button class="batch-btn" onclick="batchAnnounceAction('archive')"><i class="ri-archive-line"></i> 一键归档</button>
                        <button class="batch-btn danger" onclick="batchAnnounceAction('delete')"><i class="ri-delete-bin-line"></i> 批量删除</button>
                    </div>
                </div>

                <div id="admin-announce-table-container" style="margin-top:15px;">
                    ${renderAdminAnnounceTableHTML(announceData.announcements || [], announceData.pagination)}
                </div>
            </div>
            <div id="hub-content-audit" class="hub-pane ${defaultTab === 'audit' ? 'active' : ''}">
                <div class="admin-search-panel" style="margin-bottom:15px;">
                    <div class="admin-search-header" onclick="toggleAuditSearch()">
                        <span style="font-size: 13px; font-weight: bold;"><i class="ri-search-line"></i> 日志高级检索</span>
                        <i id="audit-search-arrow" class="ri-arrow-down-s-line"></i>
                    </div>
                    <div id="audit-search-body" class="admin-search-body collapsed">
                        <div class="form-row" style="display:grid; grid-template-columns: 2fr 1fr; gap:10px;">
                            <input type="text" id="audit-search-kw" placeholder="操作人/IP/详情搜索..." oninput="handleAdminAuditSearch(this.value)">
                            <select id="audit-filter-action" onchange="handleAdminAuditFilter('actionType', this.value)">
                                <option value="">全部动作类型</option>
                                ${Object.keys(window.AuditActionMap || {}).map(key => `
                                    <option value="${key}">${window.AuditActionMap[key].label}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 批量控制条  -->
                <div id="admin-audit-batch-bar" class="admin-batch-bar visible" style="margin-bottom:15px;">
                    <span><i class="ri-history-line"></i> 审计安全日志管理</span>
                    <div style="display:flex; gap:10px;">
                        <button class="batch-btn" style="background: var(--primary); color: white !important;" onclick="exportAuditCSV()"><i class="ri-download-2-line"></i> 导出页筛选日志 (CSV)</button>
                    </div>
                </div>

                <div id="admin-audit-table-container">
                    ${renderAdminAuditTableHTML(auditData.logs || [], auditData.pagination)}
                </div>
            </div>
        `;
    } catch (e) {
        body.innerHTML = `<div class="error-text">加载失败: ${e.message}</div>`;
    }
};

window.switchHubTab = (tab) => {
    document.querySelectorAll('.hub-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.hub-pane').forEach(p => p.classList.toggle('active', p.id === `hub-content-${tab}`));

    // 复位所有批量状态的可见性类
    const userBar = document.getElementById('admin-user-batch-bar');
    const announceBar = document.getElementById('admin-announce-batch-bar');
    const inviteBar = document.getElementById('admin-invite-batch-bar');
    const auditBar = document.getElementById('admin-audit-batch-bar');

    if (userBar) userBar.classList.remove('visible');
    if (announceBar) announceBar.classList.remove('visible');
    if (inviteBar) inviteBar.classList.remove('visible');
    // 审计常驻工具栏无需移除 visible 类

    if (tab === 'users') {
        window.updateAdminBatchBar();
    } else if (tab === 'announcements') {
        window.updateAnnounceBatchBar();
    } else if (tab === 'invites') {
        window.updateInviteBatchBar();
    } else if (tab === 'audit') {
        window.updateAuditBatchBar();
    }
};
