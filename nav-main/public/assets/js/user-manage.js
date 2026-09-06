/**
 * user-manage.js
 * 账户与后台治理 (User & Admin Hub Management Module)
 * 负责用户管理、邀请管理、公告管理与审计日志等管理员控制中心核心功能。
 */

(() => {
const utils_debounce = window.utils ? window.utils.debounce : (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

const utils_escapeHTML = window.utils ? window.utils.escapeHTML : (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
};

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

// 搜索与筛选交互函数
window.toggleAdminSearch = () => {
    const body = document.getElementById('admin-search-body');
    const arrow = document.getElementById('admin-search-arrow');
    if (!body || !arrow) return;
    const isCollapsed = body.classList.toggle('collapsed');
    arrow.className = isCollapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
};

const performAdminUserSearch = async () => {
    const container = document.getElementById('admin-users-table-container');
    if (container) container.style.opacity = '0.5';

    try {
        const query = new URLSearchParams({
            page: window.adminUserFilters.page,
            pageSize: window.adminUserFilters.pageSize,
            keyword: window.adminUserFilters.keyword,
            status: window.adminUserFilters.status
        });
        const res = await fetch(`/api/admin/users?${query.toString()}`, {
            headers: { 'Authorization': window.sysToken }
        });
        const data = await res.json();
        if (data.success) {
            window.adminData.users = data.users;
            window.adminData.pagination = data.pagination;
            if (container) {
                container.innerHTML = renderAdminUserTableHTML(data.users);
                container.style.opacity = '1';
            }
        }
    } catch (e) {
        if (typeof window.showToast === 'function') window.showToast("加载用户失败: " + e.message, "#e74c3c");
    }
};

window.handleAdminUserSearch = utils_debounce((val) => {
    window.adminUserFilters.keyword = val.trim();
    window.adminUserFilters.page = 1; // 重置页码
    performAdminUserSearch();
}, 400);

window.handleAdminUserFilter = (type, val) => {
    window.adminUserFilters[type] = val;
    window.adminUserFilters.page = 1;
    performAdminUserSearch();
};

// 公告管理交互逻辑 (复用 UM 模块思路)
window.toggleAnnounceSearch = () => {
    const body = document.getElementById('announce-search-body');
    const arrow = document.getElementById('announce-search-arrow');
    if (!body || !arrow) return;
    const isCollapsed = body.classList.toggle('collapsed');
    arrow.className = isCollapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
};

window.toggleAnnounceEditor = () => {
    const fields = document.getElementById('announce-editor-fields');
    const btn = document.getElementById('btn-toggle-editor');
    if (!fields || !btn) return;
    const isHidden = fields.style.display === 'none';
    fields.style.display = isHidden ? 'block' : 'none';
    btn.innerText = isHidden ? '展开编辑器' : '收起编辑器';
};

const performAdminAnnounceSearch = async () => {
    const container = document.getElementById('admin-announce-table-container');
    if (container) container.style.opacity = '0.5';

    try {
        const query = new URLSearchParams({
            page: window.adminAnnounceFilters.page,
            pageSize: window.adminAnnounceFilters.pageSize,
            keyword: window.adminAnnounceFilters.keyword,
            status: window.adminAnnounceFilters.status,
            type: window.adminAnnounceFilters.type
        });
        const res = await fetch(`/api/admin/announcements?${query.toString()}`, {
            headers: { 'Authorization': window.sysToken }
        });
        const data = await res.json();
        if (data.success) {
            window.adminData.announcements = data.announcements;
            window.adminData.pagination = data.pagination;
            if (container) {
                container.innerHTML = renderAdminAnnounceTableHTML(data.announcements, data.pagination);
                container.style.opacity = '1';
                updateAnnounceBatchBar();
            }
        }
    } catch (e) {
        if (typeof window.showToast === 'function') window.showToast("加载公告失败: " + e.message, "#e74c3c");
    }
};

window.handleAdminAnnounceSearch = utils_debounce((val) => {
    window.adminAnnounceFilters.keyword = val.trim();
    window.adminAnnounceFilters.page = 1;
    performAdminAnnounceSearch();
}, 400);

window.handleAdminAnnounceFilter = (type, val) => {
    window.adminAnnounceFilters[type] = val;
    window.adminAnnounceFilters.page = 1;
    performAdminAnnounceSearch();
};

window.handleAdminAnnouncePageChange = (page) => {
    window.adminAnnounceFilters.page = page;
    performAdminAnnounceSearch();
};

window.handleAdminAnnouncePageSizeChange = (size) => {
    window.adminAnnounceFilters.pageSize = parseInt(size);
    window.adminAnnounceFilters.page = 1;
    performAdminAnnounceSearch();
};

const renderAdminAnnounceTableHTML = (list, pagination) => {
    const isAllSelected = list.length > 0 && list.every(a => window.adminSelectedAnnounceIds.has(a.id.toString()));
    const { total, page, pageSize } = pagination || { total: 0, page: 1, pageSize: 20 };
    const totalPages = Math.ceil(total / pageSize);

    return `
        <div class="admin-table-container">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th class="col-checkbox">
                            <input type="checkbox" ${isAllSelected ? 'checked' : ''} onchange="toggleAdminAnnounceSelectAll(this.checked)">
                        </th>
                        <th>标题</th>
                        <th>类型</th>
                        <th>状态</th>
                        <th>发布人</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:30px; opacity:0.5;">未找到匹配的公告</td></tr>' :
                      list.map(a => `
                        <tr class="${window.adminSelectedAnnounceIds.has(a.id.toString()) ? 'selected' : ''}">
                            <td class="col-checkbox">
                                <input type="checkbox" ${window.adminSelectedAnnounceIds.has(a.id.toString()) ? 'checked' : ''} onchange="toggleAdminAnnounceSelect('${a.id}', this.checked)">
                            </td>
                            <td>
                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-weight:bold;">${a.is_top ? '<i class="ri-pushpin-fill" style="color:#f1c40f"></i> ' : ''}${utils_escapeHTML(a.title)}</span>
                                    <span style="font-size:10px; opacity:0.5; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${utils_escapeHTML(a.content)}</span>
                                </div>
                            </td>
                            <td>
                                <span class="status-badge" style="background:${a.type === 'important' ? 'rgba(231,76,60,0.1)' : 'rgba(52,152,219,0.1)'}; color:${a.type === 'important' ? '#e74c3c' : '#3498db'}">
                                    ${a.type === 'important' ? '重要' : '静默'}
                                </span>
                            </td>
                            <td><span class="status-badge ${a.status}">${a.status === 'published' ? '已发布' : (a.status === 'draft' ? '草稿' : '已归档')}</span></td>
                            <td><small style="opacity:0.7">${a.creator_name || 'System'}</small></td>
                            <td>
                                <div style="display:flex; gap:8px;">
                                    <button class="action-link" onclick="editAnnouncement(${JSON.stringify(a).replace(/"/g, '&quot;')})" title="编辑">
                                        <i class="ri-edit-line"></i>
                                    </button>
                                    <button class="action-link danger" onclick="deleteAnnouncement(${a.id})" title="删除">
                                        <i class="ri-delete-bin-line"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="admin-pagination">
            <div class="pagination-info">
                共 <b>${total}</b> 条，每页
                <select style="width:auto; padding:2px 5px; height:24px; font-size:11px;" onchange="handleAdminAnnouncePageSizeChange(this.value)">
                    <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
                    <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
                </select>
            </div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="handleAdminAnnouncePageChange(${page - 1})"><i class="ri-arrow-left-s-line"></i></button>
                <span style="font-size:12px;">${page} / ${totalPages || 1}</span>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="handleAdminAnnouncePageChange(${page + 1})"><i class="ri-arrow-right-s-line"></i></button>
            </div>
        </div>
    `;
};

window.toggleAdminAnnounceSelect = (id, checked) => {
    if (checked) window.adminSelectedAnnounceIds.add(id.toString());
    else window.adminSelectedAnnounceIds.delete(id.toString());

    const container = document.getElementById('admin-announce-table-container');
    if (container) {
        container.innerHTML = renderAdminAnnounceTableHTML(window.adminData.announcements, window.adminData.pagination);
    }
    updateAnnounceBatchBar();
};

window.toggleAdminAnnounceSelectAll = (checked) => {
    if (checked) {
        window.adminData.announcements.forEach(a => window.adminSelectedAnnounceIds.add(a.id.toString()));
    } else {
        window.adminSelectedAnnounceIds.clear();
    }
    const container = document.getElementById('admin-announce-table-container');
    if (container) {
        container.innerHTML = renderAdminAnnounceTableHTML(window.adminData.announcements, window.adminData.pagination);
    }
    updateAnnounceBatchBar();
};

window.updateAnnounceBatchBar = () => {
    const bar = document.getElementById('admin-announce-batch-bar');
    const countSpan = document.getElementById('announce-batch-count');
    if (!bar || !countSpan) return;

    if (window.adminSelectedAnnounceIds.size > 0) {
        countSpan.innerHTML = `已选中 <b>${window.adminSelectedAnnounceIds.size}</b> 条公告`;
        bar.classList.add('visible');
    } else {
        bar.classList.remove('visible');
    }
};

window.batchAnnounceAction = async (action) => {
    if (window.adminSelectedAnnounceIds.size === 0) return;

    const ids = Array.from(window.adminSelectedAnnounceIds);
    let msg = "";
    let title = "";
    let isDanger = false;
    if (action === 'delete') {
        title = "批量删除公告";
        msg = `确定要批量删除这 ${ids.length} 条公告吗？此操作不可撤销！`;
        isDanger = true;
    } else if (action === 'publish') {
        title = "批量发布公告";
        msg = `确定要批量发布这 ${ids.length} 条公告吗？`;
        isDanger = false;
    } else if (action === 'archive') {
        title = "批量归档公告";
        msg = `确定要批量归档这 ${ids.length} 条公告吗？`;
        isDanger = false;
    }

    if (msg) {
        if (typeof window.requireSystemConfirm === 'function') {
            const ok = await window.requireSystemConfirm(title, msg, isDanger);
            if (!ok) return;
        }
    }

    if (window.SyncUI) {
        await window.SyncUI.perform('ADMIN_ANNOUNCE', async () => {
            // 依次同步
            for (const id of ids) {
                if (action === 'delete') {
                    await fetch('/api/admin/announcements', {
                        method: 'DELETE',
                        headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id })
                    });
                } else {
                    await fetch('/api/admin/announcements', {
                        method: 'PATCH',
                        headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, status: action === 'publish' ? 'published' : 'archived' })
                    });
                }
            }
            if (typeof window.showToast === 'function') window.showToast("批量操作完成", "#2ecc71");
            window.adminSelectedAnnounceIds.clear();
            performAdminAnnounceSearch();
        });
    }
};

// 邀请管理交互逻辑
window.toggleInviteSearch = () => {
    const body = document.getElementById('invite-search-body');
    const arrow = document.getElementById('invite-search-arrow');
    if (!body || !arrow) return;
    const isCollapsed = body.classList.toggle('collapsed');
    arrow.className = isCollapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
};

const performAdminInviteSearch = async () => {
    const container = document.getElementById('admin-invite-table-container');
    if (container) container.style.opacity = '0.5';

    try {
        const query = new URLSearchParams({
            page: window.adminInviteFilters.page,
            pageSize: window.adminInviteFilters.pageSize,
            keyword: window.adminInviteFilters.keyword,
            status: window.adminInviteFilters.status
        });
        const res = await fetch(`/api/admin/invitations?${query.toString()}`, {
            headers: { 'Authorization': window.sysToken }
        });
        const data = await res.json();
        if (data.success) {
            window.adminData.invitations = data.invitations;
            if (container) {
                container.innerHTML = renderAdminInviteTableHTML(data.invitations, data.pagination);
                container.style.opacity = '1';
                updateInviteBatchBar();
            }
        }
    } catch (e) {
        if (typeof window.showToast === 'function') window.showToast("加载邀请码失败: " + e.message, "#e74c3c");
    }
};

window.handleAdminInviteSearch = utils_debounce((val) => {
    window.adminInviteFilters.keyword = val.trim();
    window.adminInviteFilters.page = 1;
    performAdminInviteSearch();
}, 400);

window.handleAdminInviteFilter = (type, val) => {
    window.adminInviteFilters[type] = val;
    window.adminInviteFilters.page = 1;
    performAdminInviteSearch();
};

window.handleAdminInvitePageChange = (page) => {
    window.adminInviteFilters.page = page;
    performAdminInviteSearch();
};

const renderAdminInviteTableHTML = (list, pagination) => {
    const isAllSelected = list.length > 0 && list.every(i => window.adminSelectedInviteIds.has(i.code));
    const { total, page, pageSize } = pagination || { total: 0, page: 1, pageSize: 20 };
    const totalPages = Math.ceil(total / pageSize);

    return `
        <div class="admin-table-container">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th class="col-checkbox">
                            <input type="checkbox" ${isAllSelected ? 'checked' : ''} onchange="toggleAdminInviteSelectAll(this.checked)">
                        </th>
                        <th>邀请码</th>
                        <th>状态</th>
                        <th>使用者</th>
                        <th>创建时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:30px; opacity:0.5;">暂无邀请码</td></tr>' :
                      list.map(i => `
                        <tr class="${window.adminSelectedInviteIds.has(i.code) ? 'selected' : ''}">
                            <td class="col-checkbox">
                                <input type="checkbox" ${window.adminSelectedInviteIds.has(i.code) ? 'checked' : ''} onchange="toggleAdminInviteSelect('${i.code}', this.checked)">
                            </td>
                            <td class="code-font" style="font-weight:bold; letter-spacing:1px;">${i.code}</td>
                            <td><span class="status-badge ${i.status}">${i.status === 'unused' ? '未使用' : '已使用'}</span></td>
                            <td>${i.used_by_name ? `<b>${utils_escapeHTML(i.used_by_name)}</b>` : '<span style="opacity:0.3">-</span>'}</td>
                            <td><small style="opacity:0.6">${typeof window.formatSystemDate === 'function' ? window.formatSystemDate(i.created_at, false) : i.created_at}</small></td>
                            <td>
                                <button class="action-link" onclick="copySingleInvite('${i.code}')" title="复制">
                                    <i class="ri-file-copy-line"></i>
                                </button>
                                ${i.status === 'unused' ? `
                                    <button class="action-link danger" onclick="deleteInvite('${i.code}')" title="删除" style="margin-left:8px;">
                                        <i class="ri-delete-bin-line"></i>
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="admin-pagination">
            <div class="pagination-info">共 <b>${total}</b> 条</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="handleAdminInvitePageChange(${page - 1})"><i class="ri-arrow-left-s-line"></i></button>
                <span style="font-size:12px;">${page} / ${totalPages || 1}</span>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="handleAdminInvitePageChange(${page + 1})"><i class="ri-arrow-right-s-line"></i></button>
            </div>
        </div>
    `;
};

window.toggleAdminInviteSelect = (code, checked) => {
    if (checked) window.adminSelectedInviteIds.add(code);
    else window.adminSelectedInviteIds.delete(code);
    const container = document.getElementById('admin-invite-table-container');
    if (container) container.innerHTML = renderAdminInviteTableHTML(window.adminData.invitations, { ...window.adminData.pagination, page: window.adminInviteFilters.page });
    updateInviteBatchBar();
};

window.toggleAdminInviteSelectAll = (checked) => {
    if (checked) window.adminData.invitations.forEach(i => window.adminSelectedInviteIds.add(i.code));
    else window.adminSelectedInviteIds.clear();
    const container = document.getElementById('admin-invite-table-container');
    if (container) container.innerHTML = renderAdminInviteTableHTML(window.adminData.invitations, { ...window.adminData.pagination, page: window.adminInviteFilters.page });
    updateInviteBatchBar();
};

window.updateInviteBatchBar = () => {
    const bar = document.getElementById('admin-invite-batch-bar');
    const countSpan = document.getElementById('invite-batch-count');
    if (!bar || !countSpan) return;

    if (window.adminSelectedInviteIds.size > 0) {
        countSpan.innerHTML = `已选中 <b>${window.adminSelectedInviteIds.size}</b> 个邀请码`;
        bar.classList.add('visible');
    } else {
        bar.classList.remove('visible');
    }
};

window.batchInviteAction = async (action) => {
    if (window.adminSelectedInviteIds.size === 0) return;
    const codes = Array.from(window.adminSelectedInviteIds);
    if (action === 'delete') {
        if (typeof window.requireSystemConfirm === 'function') {
            const ok = await window.requireSystemConfirm("批量下架邀请码", `确定要批量下架这 ${codes.length} 个未使用邀请码吗？`, true);
            if (!ok) return;
        }
    }

    if (window.SyncUI) {
        await window.SyncUI.perform('INVITE_BATCH', async () => {
            for (const code of codes) {
                await fetch('/api/admin/invitations', {
                    method: 'DELETE',
                    headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
            }
            if (typeof window.showToast === 'function') window.showToast("批量下架完成", "#2ecc71");
            window.adminSelectedInviteIds.clear();
            performAdminInviteSearch();
        });
    }
};

// 审计日志交互逻辑
window.toggleAuditSearch = () => {
    const body = document.getElementById('audit-search-body');
    const arrow = document.getElementById('audit-search-arrow');
    if (!body || !arrow) return;
    const isCollapsed = body.classList.toggle('collapsed');
    arrow.className = isCollapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
};

const performAdminAuditSearch = async () => {
    const container = document.getElementById('admin-audit-table-container');
    if (container) container.style.opacity = '0.5';

    try {
        const query = new URLSearchParams({
            page: window.adminAuditFilters.page,
            pageSize: window.adminAuditFilters.pageSize,
            keyword: window.adminAuditFilters.keyword,
            actionType: window.adminAuditFilters.actionType
        });
        const res = await fetch(`/api/admin/audit-logs?${query.toString()}`, {
            headers: { 'Authorization': window.sysToken }
        });
        const data = await res.json();
        if (data.success) {
            window.adminData.logs = data.logs;
            if (container) {
                container.innerHTML = renderAdminAuditTableHTML(data.logs, data.pagination);
                container.style.opacity = '1';
            }
        }
    } catch (e) {
        if (typeof window.showToast === 'function') window.showToast("加载日志失败: " + e.message, "#e74c3c");
    }
};

window.handleAdminAuditSearch = utils_debounce((val) => {
    window.adminAuditFilters.keyword = val.trim();
    window.adminAuditFilters.page = 1;
    performAdminAuditSearch();
}, 400);

window.handleAdminAuditFilter = (type, val) => {
    window.adminAuditFilters[type] = val;
    window.adminAuditFilters.page = 1;
    performAdminAuditSearch();
};

window.handleAdminAuditPageChange = (page) => {
    window.adminAuditFilters.page = page;
    performAdminAuditSearch();
};

window.toggleAdminAuditSelect = (id, checked) => {
    if (checked) window.adminSelectedAuditIds.add(id.toString());
    else window.adminSelectedAuditIds.delete(id.toString());

    const tr = document.querySelector(`#admin-audit-table-container tr[data-id="${id}"]`);
    if (tr) tr.classList.toggle('selected', checked);

    updateAuditBatchBar();
};

window.toggleAdminAuditSelectAll = (checked) => {
    if (checked) {
        window.adminData.logs.forEach(log => window.adminSelectedAuditIds.add(log.id.toString()));
    } else {
        window.adminSelectedAuditIds.clear();
    }
    const container = document.getElementById('admin-audit-table-container');
    if (container) {
        container.innerHTML = renderAdminAuditTableHTML(window.adminData.logs, { ...window.adminData.pagination, page: window.adminAuditFilters.page });
    }
    updateAuditBatchBar();
};

window.clearAdminAuditSelection = () => {
    window.adminSelectedAuditIds.clear();
    updateAuditBatchBar();
    const container = document.getElementById('admin-audit-table-container');
    if (container) {
        container.innerHTML = renderAdminAuditTableHTML(window.adminData.logs, { ...window.adminData.pagination, page: window.adminAuditFilters.page });
    }
};

window.updateAuditBatchBar = () => {
    const bar = document.getElementById('admin-audit-batch-bar');
    if (!bar) return;

    if (window.adminSelectedAuditIds.size > 0) {
        bar.innerHTML = `
            <span id="audit-batch-count">已选中 <b>${window.adminSelectedAuditIds.size}</b> 条审计日志</span>
            <div style="display:flex; gap:10px;">
                <button class="batch-btn" style="background: var(--primary); color: white !important;" onclick="exportAuditCSV()"><i class="ri-download-2-line"></i> 导出选中日志 (CSV)</button>
                <button class="batch-btn" style="background: rgba(255,255,255,0.08); color: var(--text) !important;" onclick="clearAdminAuditSelection()"><i class="ri-close-line"></i> 清除选择</button>
            </div>
        `;
    } else {
        bar.innerHTML = `
            <span><i class="ri-history-line"></i> 审计安全日志管理</span>
            <div style="display:flex; gap:10px;">
                <button class="batch-btn" style="background: var(--primary); color: white !important;" onclick="exportAuditCSV()"><i class="ri-download-2-line"></i> 导出页筛选日志 (CSV)</button>
            </div>
        `;
    }
};

const renderAdminAuditTableHTML = (logs, pagination) => {
    const isAllSelected = logs.length > 0 && logs.every(l => window.adminSelectedAuditIds.has(l.id.toString()));
    const { total, page, pageSize } = pagination || { total: 0, page: 1, pageSize: 20 };
    const totalPages = Math.ceil(total / pageSize);

    return `
        <div class="admin-table-container">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th class="col-checkbox">
                            <input type="checkbox" ${isAllSelected ? 'checked' : ''} onchange="toggleAdminAuditSelectAll(this.checked)">
                        </th>
                        <th style="width:100px;">记录时间</th>
                        <th>操作人</th>
                        <th>动作</th>
                        <th>详情</th>
                        <th>来源 IP</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:30px; opacity:0.5;">暂无日志数据</td></tr>' :
                      logs.map(l => {
                        const dateStr = typeof window.formatSystemDate === 'function' ? window.formatSystemDate(l.created_at, false) : l.created_at;
                        const tz = window.sysSiteConfig?.systemTimezone || 'Asia/Shanghai';
                        let timeStr = '';
                        try {
                            const dateObj = typeof window.parseUtcDate === 'function' ? window.parseUtcDate(l.created_at) : new Date(l.created_at);
                            timeStr = dateObj.toLocaleTimeString('zh-CN', { timeZone: tz, hour12: false });
                        } catch (e) {
                            timeStr = new Date(l.created_at).toLocaleTimeString('zh-CN', { hour12: false });
                        }
                        const actionInfo = window.AuditActionMap ? (window.AuditActionMap[l.action] || { label: l.action, color: '#3498db' }) : { label: l.action, color: '#3498db' };
                        const isSelected = window.adminSelectedAuditIds.has(l.id.toString());

                        return `
                        <tr class="${isSelected ? 'selected' : ''}" data-id="${l.id}">
                            <td class="col-checkbox">
                                <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleAdminAuditSelect('${l.id}', this.checked)">
                            </td>
                            <td style="font-family:monospace; line-height:1.2;">
                                <div style="font-size:10px; opacity:0.5;">${dateStr}</div>
                                <div style="font-size:12px; font-weight:bold; color:var(--text-main);">${timeStr}</div>
                            </td>
                            <td style="font-weight:bold;" title="用户内部 ID: ${l.user_id}">${utils_escapeHTML(l.operator_name || 'System')}</td>
                            <td>
                                <span class="status-badge" style="background:rgba(255,255,255,0.05); color:${actionInfo.color}; border:1px solid ${actionInfo.color}44; white-space:nowrap;" title="原始动作: ${l.action}">
                                    ${actionInfo.label}
                                </span>
                            </td>
                            <td style="font-size:11px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${utils_escapeHTML(l.details || '')}">
                                ${utils_escapeHTML(l.details || '-')}
                            </td>
                            <td style="font-size:10px; opacity:0.5; font-family:monospace;">${l.ip}</td>
                        </tr>
                        `;
                      }).join('')}
                </tbody>
            </table>
        </div>
        <div class="admin-pagination">
            <div class="pagination-info">共 <b>${total}</b> 条日志</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="handleAdminAuditPageChange(${page - 1})"><i class="ri-arrow-left-s-line"></i></button>
                <span style="font-size:12px;">${page} / ${totalPages || 1}</span>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="handleAdminAuditPageChange(${page + 1})"><i class="ri-arrow-right-s-line"></i></button>
            </div>
        </div>
    `;
};

window.handleAdminPageChange = (page) => {
    window.adminUserFilters.page = page;
    performAdminUserSearch();
};

window.handleAdminPageSizeChange = (size) => {
    window.adminUserFilters.pageSize = parseInt(size);
    window.adminUserFilters.page = 1;
    performAdminUserSearch();
};

const renderAdminUserTableHTML = (users) => {
    const isAllSelected = users.length > 0 && users.every(u => window.adminSelectedUserIds.has(u.id));
    const { total, page, pageSize } = window.adminData.pagination || { total: 0, page: 1, pageSize: 20 };
    const totalPages = Math.ceil(total / pageSize);

    return `
        <div class="admin-table-container">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th class="col-checkbox">
                            <input type="checkbox" ${isAllSelected ? 'checked' : ''} onchange="toggleAdminSelectAll(this.checked)">
                        </th>
                        <th>用户名</th>
                        <th>角色</th>
                        <th>状态</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:30px; opacity:0.5;">未找到匹配的用户</td></tr>' :
                      users.map(u => `
                        <tr class="${window.adminSelectedUserIds.has(u.id) ? 'selected' : ''}">
                            <td class="col-checkbox">
                                <input type="checkbox" ${window.adminSelectedUserIds.has(u.id) ? 'checked' : ''} onchange="toggleAdminUserSelect('${u.id}', this.checked)">
                            </td>
                            <td>
                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-weight:bold;">${utils_escapeHTML(u.username)}</span>
                                    <span style="font-size:10px; opacity:0.5; font-family:monospace;" title="完整内部 ID: ${u.id}">${u.uid || u.id?.substring(0, 8) || '---'}</span>
                                </div>
                            </td>
                            <td>
                                <span class="status-badge ${u.role}">${u.role.toUpperCase()}</span>
                            </td>
                            <td><span class="status-badge ${u.status}">${u.status}</span></td>
                            <td>
                                <div style="display:flex; gap:8px; align-items:center;">
                                    ${u.role === 'admin' ? '-' : `
                                        <button class="action-link" onclick="updateUserAdmin('${u.id}', { status: '${u.status === 'active' ? 'frozen' : 'active'}' })" title="${u.status === 'active' ? '冻结账号' : '激活账号'}">
                                            <i class="${u.status === 'active' ? 'ri-user-forbid-line' : 'ri-user-follow-line'}"></i>
                                        </button>
                                        <button class="action-link" onclick="resetUserPasswordAdmin('${u.id}')" title="重置密码">
                                            <i class="ri-key-2-line"></i>
                                        </button>
                                        <button class="action-link danger" onclick="deleteUserAdmin('${u.id}')" title="删除用户">
                                            <i class="ri-delete-bin-line"></i>
                                        </button>
                                    `}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- 分页控制 -->
        <div class="admin-pagination">
            <div class="pagination-info">
                共 <b>${total}</b> 条数据，每页
                <select style="width:auto; padding:2px 5px; height:24px; font-size:11px;" onchange="handleAdminPageSizeChange(this.value)">
                    <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
                    <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
                </select> 条
            </div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="handleAdminPageChange(1)" title="第一页"><i class="ri-arrow-left-double-line"></i></button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="handleAdminPageChange(${page - 1})" title="上一页"><i class="ri-arrow-left-s-line"></i></button>

                <span style="font-size:12px; margin:0 10px;">第 <b>${page}</b> / ${totalPages || 1} 页</span>

                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="handleAdminPageChange(${page + 1})" title="下一页"><i class="ri-arrow-right-s-line"></i></button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="handleAdminPageChange(${totalPages})" title="末页"><i class="ri-arrow-right-double-line"></i></button>
            </div>
        </div>
    `;
};

// 多选与批量操作逻辑
window.toggleAdminUserSelect = (userId, checked) => {
    if (checked) window.adminSelectedUserIds.add(userId);
    else window.adminSelectedUserIds.delete(userId);

    // 局部更新表格行样式而不重绘整个表格（优化性能）
    const container = document.getElementById('admin-users-table-container');
    if (container) {
        container.innerHTML = renderAdminUserTableHTML(window.adminData.users);
    }
    updateAdminBatchBar();
};

window.toggleAdminSelectAll = (checked) => {
    if (checked) {
        window.adminData.users.forEach(u => window.adminSelectedUserIds.add(u.id));
    } else {
        window.adminData.users.forEach(u => window.adminSelectedUserIds.delete(u.id));
    }
    const container = document.getElementById('admin-users-table-container');
    if (container) {
        container.innerHTML = renderAdminUserTableHTML(window.adminData.users);
    }
    updateAdminBatchBar();
};

window.clearAdminUserSelection = () => {
    window.adminSelectedUserIds.clear();
    updateAdminBatchBar();
    const container = document.getElementById('admin-users-table-container');
    if (container) {
        container.innerHTML = renderAdminUserTableHTML(window.adminData.users);
    }
};

window.updateAdminBatchBar = () => {
    const bar = document.getElementById('admin-user-batch-bar');
    const countSpan = document.getElementById('user-batch-count');
    if (!bar || !countSpan) return;

    if (window.adminSelectedUserIds.size > 0) {
        countSpan.innerHTML = `已选中 <b>${window.adminSelectedUserIds.size}</b> 名用户`;
        bar.classList.add('visible');
    } else {
        bar.classList.remove('visible');
    }
};

// CSV 批量导出实现
window.exportUsersCSV = () => {
    if (window.adminSelectedUserIds.size === 0) {
        if (typeof window.showToast === 'function') window.showToast("请先选择要导出的用户", "#e67e22");
        return;
    }

    const selectedUsers = window.adminData.users.filter(u => window.adminSelectedUserIds.has(u.id));

    // 1. 构建 CSV 内容
    const headers = ['ID', 'UUID', 'Username', 'Role', 'Status', 'Last Login', 'Created At'];
    const rows = selectedUsers.map(u => [
        u.id,
        u.uid,
        u.username,
        u.role,
        u.status,
        u.last_login || '-',
        u.created_at
    ]);

    let csvContent = "\ufeff"; // 添加 BOM 支持中文 Excel
    csvContent += headers.join(',') + "\n";
    rows.forEach(row => {
        csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + "\n";
    });

    // 2. 触发下载
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, '');

    link.setAttribute("href", url);
    link.setAttribute("download", `CloudNav_Users_Export_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof window.showToast === 'function') window.showToast("成功导出 CSV 记录", "#2ecc71");
};

// CSV 审计日志导出实现
window.exportAuditCSV = () => {
    let targetLogs = [];
    if (window.adminSelectedAuditIds.size > 0) {
        targetLogs = window.adminData.logs.filter(log => window.adminSelectedAuditIds.has(log.id.toString()));
    } else {
        targetLogs = window.adminData.logs || [];
    }

    if (targetLogs.length === 0) {
        if (typeof window.showToast === 'function') window.showToast("当前筛选条件下无可导出的日志", "#e67e22");
        return;
    }

    // 1. 构建 CSV 内容
    const headers = ['ID', 'Username (User ID)', 'Action', 'Details', 'IP Address', 'Timestamp'];
    const rows = targetLogs.map(log => {
        const actionLabel = (window.AuditActionMap && window.AuditActionMap[log.action]) ? window.AuditActionMap[log.action].label : log.action;
        return [
            log.id,
            log.username ? `${log.username} (${log.user_id})` : `System (${log.user_id})`,
            actionLabel,
            log.details || '-',
            log.ip || '-',
            log.created_at
        ];
    });

    let csvContent = "\ufeff"; // 添加 BOM 支持中文 Excel
    csvContent += headers.join(',') + "\n";
    rows.forEach(row => {
        csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + "\n";
    });

    // 2. 触发下载
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, '');

    link.setAttribute("href", url);
    link.setAttribute("download", `CloudNav_Audit_Logs_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof window.showToast === 'function') {
        window.showToast(window.adminSelectedAuditIds.size > 0 ? "已成功导出选中日志" : "已成功导出当前页全部筛选日志", "#2ecc71");
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
        updateAdminBatchBar();
    } else if (tab === 'announcements') {
        updateAnnounceBatchBar();
    } else if (tab === 'invites') {
        updateInviteBatchBar();
    } else if (tab === 'audit') {
        updateAuditBatchBar();
    }
};

window.generateInvites = async (count) => {
    if (window.SyncUI) {
        await window.SyncUI.perform('INVITE_GEN', async () => {
            const res = await fetch('/api/admin/invitations', {
                method: 'POST',
                headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ count })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '生成失败');
            }
            window.openAdminHub('invites');
        });
    }
};

window.deleteInvite = async (code) => {
    if (typeof window.requireSystemConfirm === 'function') {
        const ok = await window.requireSystemConfirm("作废邀请码", "确定要作废并彻底删除此未使用的邀请码吗？", true);
        if (!ok) return;
    }
    if (window.SyncUI) {
        await window.SyncUI.perform('INVITE_DEL', async () => {
            const res = await fetch('/api/admin/invitations', {
                method: 'DELETE',
                headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            if (!res.ok) throw new Error("删除失败");
            window.openAdminHub('invites');
        });
    }
};

window.updateUserAdmin = async (userId, payload) => {
    // 统一二次验证逻辑
    if (typeof window.requireAdminAuth !== 'function') return;
    const adminPassword = await window.requireAdminAuth("正在更改用户的安全与状态配置");
    if (!adminPassword) return;

    if (window.SyncUI) {
        await window.SyncUI.perform('USER_MANAGE', async () => {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...payload, adminPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "操作失败");
            performAdminUserSearch(); // 局部刷新
        });
    }
};

window.resetUserPasswordAdmin = async (userId) => {
    if (typeof window.requireNewPasswordAdmin !== 'function' || typeof window.requireAdminAuth !== 'function') return;
    const newPassword = await window.requireNewPasswordAdmin("请指定该用户的新密码：");
    if (!newPassword) return;

    const adminPassword = await window.requireAdminAuth("强行改写其它用户登录密码");
    if (!adminPassword) return;

    if (window.SyncUI) {
        await window.SyncUI.perform('USER_MANAGE', async () => {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, newPassword, adminPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "重置失败");
            if (typeof window.showToast === 'function') window.showToast("临时密码已设置（有效期30分钟）", "#2ecc71");
        });
    }
};

window.deleteUserAdmin = async (userId) => {
    if (typeof window.requireSystemConfirm !== 'function' || typeof window.requireAdminAuth !== 'function') return;
    const ok = await window.requireSystemConfirm("物理删除用户", "警告：删除用户将永久清除其所有数据（分类、书签、设置），且不可恢复！此操作不可撤销，确认删除吗？", true);
    if (!ok) return;

    const adminPassword = await window.requireAdminAuth("【终极大警告】彻底删除并抹去该用户及其全站数据");
    if (!adminPassword) return;

    if (window.SyncUI) {
        await window.SyncUI.perform('USER_MANAGE', async () => {
            const res = await fetch('/api/admin/users', {
                method: 'DELETE',
                headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, adminPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "删除失败");
            if (typeof window.showToast === 'function') window.showToast("用户已删除", "#2ecc71");
            performAdminUserSearch();
        });
    }
};

window.saveAnnouncement = async () => {
    const isEdit = window.currentEditingAnnounceId !== null;
    const isDraft = document.getElementById('announce-is-draft')?.checked;
    const payload = {
        id: isEdit ? Number(window.currentEditingAnnounceId) : null,
        title: document.getElementById('announce-title').value.trim(),
        content: document.getElementById('announce-content').value.trim(),
        type: document.getElementById('announce-type').value,
        expire_at: document.getElementById('announce-expire').value,
        is_top: document.getElementById('announce-top').checked,
        status: isDraft ? 'draft' : 'published'
    };

    if (!payload.title || !payload.content) {
        if (typeof window.showToast === 'function') window.showToast("标题和内容不能为空", "#e67e22");
        return;
    }
    if (!window.sysToken) {
        if (typeof window.showToast === 'function') window.showToast("登录已失效，请重新登录", "#e74c3c");
        return;
    }

    if (window.SyncUI) {
        await window.SyncUI.perform('ANNOUNCE_SAVE', async () => {
            const res = await fetch('/api/admin/announcements', {
                method: isEdit ? 'PATCH' : 'POST',
                headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "发布失败");
            if (typeof window.showToast === 'function') window.showToast(isEdit ? "公告已更新" : "公告已发布", "#2ecc71");
            cancelEditAnnounce();
            performAdminAnnounceSearch();
            if (typeof window.initAnnouncements === 'function') window.initAnnouncements();
        });
    }
};

window.deleteAnnouncement = async (id) => {
    if (typeof window.requireSystemConfirm !== 'function') return;
    const ok = await window.requireSystemConfirm("删除全站公告", "确定要下架并彻底删除这条公告吗？下发后将全员隐退！", true);
    if (!ok) return;

    if (window.SyncUI) {
        await window.SyncUI.perform('ANNOUNCE_DEL', async () => {
            const res = await fetch('/api/admin/announcements', {
                method: 'DELETE',
                headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (!res.ok) throw new Error("下架失败");
            if (typeof window.showToast === 'function') window.showToast("公告已删除", "#2ecc71");
            performAdminAnnounceSearch();
            if (typeof window.initAnnouncements === 'function') window.initAnnouncements();
        });
    }
};

window.handleAnnounceDraftChange = (checked) => {
    const btn = document.getElementById('btn-save-announce');
    if (!btn) return;
    const isEdit = window.currentEditingAnnounceId !== null;
    if (checked) {
        btn.innerText = "保存为草稿";
    } else {
        btn.innerText = isEdit ? "确认保存修改" : "发布公告";
    }
};

window.editAnnouncement = (a) => {
    window.currentEditingAnnounceId = a.id;
    document.getElementById('announce-title').value = a.title;
    document.getElementById('announce-content').value = a.content;
    document.getElementById('announce-type').value = a.type;
    document.getElementById('announce-top').checked = a.is_top === 1;

    if (a.expire_at) {
        // 将数据库时间格式转换为 datetime-local 接受的格式 (YYYY-MM-DDTHH:MM)
        const date = new Date(a.expire_at);
        const isoStr = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('announce-expire').value = isoStr;
    } else {
        document.getElementById('announce-expire').value = '';
    }

    const isDraft = a.status === 'draft';
    document.getElementById('announce-is-draft').checked = isDraft;

    // UI 状态切换
    document.getElementById('btn-save-announce').innerText = isDraft ? "保存为草稿" : "确认保存修改";
    document.getElementById('btn-save-announce').classList.add('warning-btn'); // 提示是修改操作
    document.getElementById('btn-cancel-announce').style.display = 'inline-block';

    // 平滑滚动到编辑器区域
    const editor = document.querySelector('.admin-announce-editor');
    if (editor) editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.cancelEditAnnounce = () => {
    window.currentEditingAnnounceId = null;
    document.getElementById('announce-title').value = '';
    document.getElementById('announce-content').value = '';
    document.getElementById('announce-type').value = 'quiet';
    document.getElementById('announce-expire').value = '';
    document.getElementById('announce-top').checked = false;
    document.getElementById('announce-is-draft').checked = false;

    document.getElementById('btn-save-announce').innerText = "发布公告";
    document.getElementById('btn-save-announce').classList.remove('warning-btn');
    document.getElementById('btn-cancel-announce').style.display = 'none';
};

window.copyUnusedInvites = async () => {
    // 改为从内存数据读取，彻底解耦 DOM
    const allInvites = window.adminData.invitations || [];
    const unused = allInvites.filter(i => i.status === 'unused').map(i => i.code);

    if (allInvites.length === 0) {
        if (typeof window.showToast === 'function') window.showToast("当前没有任何邀请码", "#e67e22");
        return;
    }
    if (unused.length === 0) {
        if (typeof window.showToast === 'function') window.showToast("所有邀请码均已被使用", "#e67e22");
        return;
    }

    if (window.SyncUI) {
        await window.SyncUI.perform('CLIPBOARD', async () => {
            if (window.utils && typeof window.utils.copyText === 'function') {
                await window.utils.copyText(unused.join('\n'));
            } else {
                await navigator.clipboard.writeText(unused.join('\n'));
            }
        });
    }
};

window.copySingleInvite = async (code) => {
    if (window.SyncUI) {
        await window.SyncUI.perform('CLIPBOARD', async () => {
            if (window.utils && typeof window.utils.copyText === 'function') {
                await window.utils.copyText(code);
            } else {
                await navigator.clipboard.writeText(code);
            }
        });
    }
};

window.toggleUserStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'frozen' : 'active';
    if (typeof window.requireSystemConfirm === 'function') {
        const ok = await window.requireSystemConfirm(newStatus === 'frozen' ? "安全冻结账号" : "激活账号", `确定要将该用户设为 [${newStatus.toUpperCase()}] 状态吗？${newStatus === 'frozen' ? '冻结后该用户将立即在全终端强制下线并封禁！' : ''}`, newStatus === 'frozen');
        if (!ok) return;
    }

    if (window.SyncUI) {
        await window.SyncUI.perform('USER_MANAGE', async () => {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, status: newStatus })
            });
            if (!res.ok) throw new Error("操作失败");
            window.openAdminHub('users'); // 刷新并停留在用户管理
        });
    }
};

})();

