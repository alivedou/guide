import { utils_debounce, utils_escapeHTML } from './shared.js';

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

export { renderAdminInviteTableHTML, performAdminInviteSearch };
