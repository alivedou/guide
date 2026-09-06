import { utils_debounce, utils_escapeHTML } from './shared.js';

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

export { renderAdminAuditTableHTML, performAdminAuditSearch };
