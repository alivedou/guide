import { utils_debounce, utils_escapeHTML } from './shared.js';

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

export { renderAdminUserTableHTML, performAdminUserSearch };
