import { utils_debounce, utils_escapeHTML } from './shared.js';

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

export { renderAdminAnnounceTableHTML, performAdminAnnounceSearch };
