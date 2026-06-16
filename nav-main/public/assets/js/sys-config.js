/**
 * sys-config.js
 * 系统参数管理中心 (System Configuration Hub Module)
 * 负责站点品牌与 SEO、注册准入、安全防护及角色授权 (含审计通知设定)。
 */

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

// Task 12.2 & 13.2 & 14.1: 唤起全站系统参数配置中枢 (Tab 架构重构)
window.openSystemConfigHub = async (defaultTab = 'brand') => {
    if (!window.isAdmin) return;
    window.lastFocusedElement = document.activeElement;
    if (typeof window.closeAllModals === 'function') window.closeAllModals(true);
    if (typeof window.showLoader === 'function') window.showLoader('正在读取全站配置...');

    try {
        const res = await fetch('/api/admin/site-config', {
            headers: { 'Authorization': window.sysToken }
        });
        const config = await res.json();
        if (typeof window.hideLoader === 'function') window.hideLoader();

        const modal = document.getElementById('edit-modal');
        const title = document.getElementById('edit-title');
        const body = document.getElementById('edit-form-body');
        const confirmBtn = document.getElementById('btn-confirm-edit');
        
        if (!modal || !body) return;

        title.innerHTML = `<i class="ri-settings-5-line"></i> 系统配置中心`;
        const sec = config.security || { maxLoginAttempts: 5, loginLockoutMin: 10, maxRegisterPerHour: 3, registerLockoutHours: 24 };

        body.innerHTML = `
            <div class="admin-hub-tabs">
                <button class="hub-tab ${defaultTab === 'brand' ? 'active' : ''}" onclick="switchSysTab('brand')">品牌与 SEO</button>
                <button class="hub-tab ${defaultTab === 'policy' ? 'active' : ''}" onclick="switchSysTab('policy')">注册策略</button>
                <button class="hub-tab ${defaultTab === 'security' ? 'active' : ''}" onclick="switchSysTab('security')">安全与时间</button>
                <button class="hub-tab ${defaultTab === 'roles' ? 'active' : ''}" onclick="switchSysTab('roles')">角色授权</button>
            </div>

            <!-- 区块 1: 品牌与 SEO -->
            <div id="sys-pane-brand" class="hub-pane ${defaultTab === 'brand' ? 'active' : ''}">
                <div class="admin-config-section">
                    <div class="form-group">
                        <label>站点标题</label>
                        <input type="text" id="sys-site-title" value="${config.siteTitle || ''}" placeholder="CloudNav">
                    </div>
                    <div class="form-group">
                        <label>Favicon URL</label>
                        <input type="text" id="sys-favicon-url" value="${config.faviconUrl || ''}" placeholder="https://...">
                    </div>
                    <div class="form-group">
                        <label>SEO 关键词</label>
                        <input type="text" id="sys-seo-keywords" value="${config.seoKeywords || ''}" placeholder="以逗号分隔">
                    </div>
                    <div class="form-group">
                        <label>SEO 描述</label>
                        <textarea id="sys-seo-desc" rows="2" placeholder="站点描述信息...">${config.seoDescription || ''}</textarea>
                    </div>
                </div>
            </div>
            
            <!-- 区块 2: 注册与准入 -->
            <div id="sys-pane-policy" class="hub-pane ${defaultTab === 'policy' ? 'active' : ''}">
                <div class="admin-config-section">
                    <div class="form-group" style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div>
                            <div style="font-size:14px; color:var(--text);">开放注册</div>
                            <div style="font-size:11px; color:#888;">允许新用户直接注册账号</div>
                        </div>
                        <label class="switch-ui">
                            <input type="checkbox" id="sys-allow-reg" ${config.allowOpenRegistration !== false ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="form-group" style="display:flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size:14px; color:var(--text);">强制要求邀请码</div>
                            <div style="font-size:11px; color:#888;">注册时必须填写有效的邀请码</div>
                        </div>
                        <label class="switch-ui">
                            <input type="checkbox" id="sys-require-invite" ${config.requireInvitation ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="form-group">
                        <label>超级用户邀请码总量配额</label>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input type="number" id="sys-su-quota" value="${config.superUserInviteQuota || 10}" style="flex:1;">
                            <span style="font-size:11px; color:#888;">(累积生成上限)</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 区块 3: 安全与时间 -->
            <div id="sys-pane-security" class="hub-pane ${defaultTab === 'security' ? 'active' : ''}">
                <div class="admin-config-section">
                    <h4 style="font-size:12px; color:#888; text-transform:uppercase; margin: 0 0 10px 0;"><i class="ri-shield-check-line"></i> 安全防护策略</h4>
                    <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
                        <div class="form-group">
                            <label>登录重试上限</label>
                            <input type="number" id="sys-login-max" value="${sec.maxLoginAttempts}">
                        </div>
                        <div class="form-group">
                            <label>登录锁定 (分)</label>
                            <input type="number" id="sys-login-lock" value="${sec.loginLockoutMin}">
                        </div>
                    </div>
                    <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                        <div class="form-group">
                            <label>IP 每小时注册限额</label>
                            <input type="number" id="sys-reg-max" value="${sec.maxRegisterPerHour}">
                        </div>
                        <div class="form-group">
                            <label>注册封禁时长 (时)</label>
                            <input type="number" id="sys-reg-lock" value="${sec.registerLockoutHours}">
                        </div>
                    </div>
                    
                    <h4 style="font-size:12px; color:#888; text-transform:uppercase; margin: 15px 0 10px 0;"><i class="ri-notification-3-line"></i> 敏感操作即时告警</h4>
                    <div class="form-group" style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div>
                            <div style="font-size:14px; color:var(--text);">即时告警推送</div>
                            <div style="font-size:11px; color:#888;">管理员修改配置、变动权限、重置密码或销号时即时发送 TG 及邮件通知</div>
                        </div>
                        <label class="switch-ui">
                            <input type="checkbox" id="sys-instant-alert" ${config.enableAdminInstantAlert ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    
                    <h4 style="font-size:12px; color:#888; text-transform:uppercase; margin: 15px 0 10px 0;"><i class="ri-time-line"></i> 系统时区控制</h4>
                    <div class="form-group">
                        <label>系统信息显示时区</label>
                        <select id="sys-timezone" style="width:100%; height:38px; padding:0 10px; background:var(--glass); color:var(--text); border:1px solid var(--glass-border); border-radius:6px; outline:none; box-sizing:border-box;">
                            <option value="Asia/Shanghai" ${config.systemTimezone === 'Asia/Shanghai' || !config.systemTimezone ? 'selected' : ''}>北京时间 (Asia/Shanghai - UTC+8)</option>
                            <option value="UTC" ${config.systemTimezone === 'UTC' ? 'selected' : ''}>格林威治时间 (UTC - UTC+0)</option>
                            <option value="America/New_York" ${config.systemTimezone === 'America/New_York' ? 'selected' : ''}>纽约时间 (America/New_York - UTC-5/UTC-4)</option>
                            <option value="Europe/London" ${config.systemTimezone === 'Europe/London' ? 'selected' : ''}>伦敦时间 (Europe/London - UTC+0/UTC+1)</option>
                            <option value="Asia/Tokyo" ${config.systemTimezone === 'Asia/Tokyo' ? 'selected' : ''}>东京时间 (Asia/Tokyo - UTC+9)</option>
                            <option value="Europe/Paris" ${config.systemTimezone === 'Europe/Paris' ? 'selected' : ''}>巴黎时间 (Europe/Paris - UTC+1/UTC+2)</option>
                        </select>
                        <p style="font-size: 11px; opacity: 0.6; margin-top: 5px;">说明：此参数控制系统所有卡片创建时间、日志和同步状态等时间戳的显示时区。</p>
                    </div>
                </div>
            </div>

            <!-- 区块 4: 角色授权 (Task UM.8.4 & Task AC.3) -->
            <div id="sys-pane-roles" class="hub-pane ${defaultTab === 'roles' ? 'active' : ''}">
                <div class="admin-config-section">
                    <div style="font-size:12px; color:#f1c40f; margin-bottom:12px; background:rgba(241,196,15,0.1); padding:8px; border-radius:6px; line-height:1.4; display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="ri-error-warning-line"></i> 提示：只有首席管理员 (Root) 可提拔 Admin。</span>
                        <span id="admin-quota-badge" style="background:#f1c40f; color:#000; padding:2px 8px; border-radius:10px; font-weight:bold; font-size:11px;">名额加载中...</span>
                    </div>
                    <div class="form-group">
                        <input type="text" id="sys-role-search-kw" placeholder="输入用户名搜索以调整权限..." oninput="handleSysRoleSearch(this.value)">
                    </div>
                    <div id="sys-role-search-results" style="max-height: 250px; overflow-y: auto;">
                        <div style="text-align:center; padding:20px; color:#666; font-size:13px;">请输入关键字开始搜索...</div>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        confirmBtn.style.display = 'block';
        confirmBtn.innerText = "应用全站参数";
        confirmBtn.onclick = () => saveSystemConfig();
    } catch (e) {
        if (typeof window.hideLoader === 'function') window.hideLoader();
        if (typeof window.showToast === 'function') window.showToast("加载系统参数失败", "#e74c3c");
    }
};

// Task 14.1: 系统参数 Tab 切换逻辑
window.switchSysTab = (tab) => {
    document.querySelectorAll('#edit-modal .hub-tab').forEach(el => {
        el.classList.toggle('active', 
            (tab === 'brand' && el.innerText.includes('品牌')) ||
            (tab === 'policy' && el.innerText.includes('策略')) ||
            (tab === 'security' && (el.innerText.includes('安全') || el.innerText.includes('防护'))) ||
            (tab === 'roles' && el.innerText.includes('角色'))
        );
    });
    document.querySelectorAll('#edit-modal .hub-pane').forEach(el => {
        el.classList.remove('active');
    });
    const target = document.getElementById(`sys-pane-${tab}`);
    if (target) target.classList.add('active');
};

// Task UM.8.4: 角色授权搜索逻辑
window.handleSysRoleSearch = utils_debounce(async (kw) => {
    const resultsDiv = document.getElementById('sys-role-search-results');
    if (!kw.trim()) {
        resultsDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#666; font-size:13px;">请输入关键字开始搜索...</div>';
        return;
    }
    
    resultsDiv.innerHTML = '<div style="text-align:center; padding:20px;"><div class="global-spinner" style="width:20px; height:20px; border-width:2px; margin:0 auto;"></div></div>';
    
    try {
        const res = await fetch(`/api/admin/users?keyword=${encodeURIComponent(kw)}&pageSize=50`, {
            headers: { 'Authorization': window.sysToken }
        });
        const data = await res.json();
        
        if (data.users && data.users.length > 0) {
            const isRoot = (window.currentUser?.id === '1' || window.currentUser?.uid === 10001);
            const adminCount = data.adminCount || 0;
            const quotaBadge = document.getElementById('admin-quota-badge');
            if (quotaBadge) {
                quotaBadge.innerText = `管理员名额: ${adminCount} / 5`;
                quotaBadge.style.background = adminCount >= 5 ? '#e74c3c' : '#f1c40f';
                quotaBadge.style.color = adminCount >= 5 ? '#fff' : '#000';
            }

            resultsDiv.innerHTML = `
                <table class="admin-table">
                    <tbody>
                        ${data.users.map(u => {
                            const isAdminFull = adminCount >= 5 && u.role !== 'admin';
                            const hasEmail = !!u.email;
                            const hasTg = !!u.telegram_chat_id;
                            const hasChannel = hasEmail || hasTg;
                            
                            let channelText = '';
                            if (hasEmail && hasTg) {
                                channelText = `<span style="font-size:11px; opacity:0.6; margin-left:6px;">(${utils_escapeHTML(u.email)} | TG:${utils_escapeHTML(u.telegram_chat_id)})</span>`;
                            } else if (hasEmail) {
                                channelText = `<span style="font-size:11px; opacity:0.6; margin-left:6px;">(${utils_escapeHTML(u.email)})</span>`;
                            } else if (hasTg) {
                                channelText = `<span style="font-size:11px; opacity:0.6; margin-left:6px;">(TG:${utils_escapeHTML(u.telegram_chat_id)})</span>`;
                            } else {
                                channelText = `<span style="font-size:11px; opacity:0.4; margin-left:6px; color: #f1c40f;" title="请让该用户在右上角个人资料中心绑定邮箱或TG Chat ID以启用通知功能">(未配置通知通道，请去个人资料绑定)</span>`;
                            }
                            return `
                                <tr style="border-bottom: 1px solid var(--glass-border);">
                                    <td style="padding:10px 5px;">
                                        <b>${utils_escapeHTML(u.username)}</b> ${channelText}<br>
                                        <small style="opacity:0.5">${u.uid}</small>
                                        
                                        <!-- 通知授权开关 -->
                                        <div style="display:flex; gap:12px; margin-top:6px; font-size:11px;">
                                            <label style="display:flex; align-items:center; gap:4px; ${!hasChannel ? 'opacity:0.4; cursor:not-allowed;' : 'cursor:pointer;'}"
                                                   title="${!hasChannel ? '无法勾选：该用户尚未在个人资料中心绑定邮箱或Telegram Chat ID' : '允许或取消向该用户发送紧急系统故障告警'}">
                                                <input type="checkbox" 
                                                       ${u.is_alert_receiver ? 'checked' : ''} 
                                                       ${!hasChannel ? 'disabled' : ''} 
                                                       onchange="toggleUserNotification('${u.id}', 'alert', this.checked)"> 
                                                <span>紧急告警</span>
                                            </label>
                                            <label style="display:flex; align-items:center; gap:4px; ${!hasChannel ? 'opacity:0.4; cursor:not-allowed;' : 'cursor:pointer;'}"
                                                   title="${!hasChannel ? '无法勾选：该用户尚未在个人资料中心绑定邮箱或Telegram Chat ID' : '允许或取消向该用户发送每日系统审计日报'}">
                                                <input type="checkbox" 
                                                       ${u.is_digest_receiver ? 'checked' : ''} 
                                                       ${!hasChannel ? 'disabled' : ''} 
                                                       onchange="toggleUserNotification('${u.id}', 'digest', this.checked)"> 
                                                <span>审计日报</span>
                                            </label>
                                        </div>
                                    </td>
                                    <td style="text-align:right; padding:10px 5px; vertical-align:top;">
                                        <select onchange="updateUserRoleConfirm('${u.id}', this.value)" style="width:auto; height:32px; padding:0 10px;">
                                            <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                                            <option value="super_user" ${u.role === 'super_user' ? 'selected' : ''}>Super User</option>
                                            ${(isRoot || u.role === 'admin') ? `
                                                <option value="admin" ${u.role === 'admin' ? 'selected' : ''} 
                                                    ${(!isRoot || isAdminFull) ? 'disabled' : ''}>
                                                    Admin ${isAdminFull ? '(名额已满)' : ''}
                                                </option>` : ''}
                                        </select>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        } else {
            resultsDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">未找到用户</div>';
        }
    } catch (e) {
        resultsDiv.innerHTML = `<div style="text-align:center; padding:20px; color:#e74c3c;">加载失败: ${e.message}</div>`;
    }
}, 400);

window.updateUserRoleConfirm = async (userId, newRole) => {
    if (typeof window.requireAdminAuth !== 'function') return;
    const adminPassword = await window.requireAdminAuth(`正在将该用户角色变更为 [${newRole.toUpperCase()}]`);
    if (!adminPassword) return;

    if (window.SyncUI) {
        await window.SyncUI.perform('USER_MANAGE', async () => {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole, adminPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "授权失败");
            if (typeof window.showToast === 'function') window.showToast("角色已成功变更", "#2ecc71");
        });
    }
};

window.toggleUserNotification = async (userId, type, checked) => {
    if (typeof window.requireAdminAuth !== 'function') return;
    const adminPassword = await window.requireAdminAuth("正在修改接收通知权限");
    if (!adminPassword) {
        // 复位状态
        const kwInput = document.getElementById('sys-role-search-kw');
        if (kwInput) handleSysRoleSearch(kwInput.value);
        return;
    }

    try {
        const body = {
            userId,
            adminPassword
        };
        if (type === 'alert') body.isAlertReceiver = checked;
        if (type === 'digest') body.isDigestReceiver = checked;

        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': window.sysToken
            },
            body: JSON.stringify(body)
        });
        const result = await res.json();
        if (res.ok) {
            if (typeof window.showToast === 'function') window.showToast("通知安全授权修改成功！", "#27ae60");
        } else {
            if (typeof window.showToast === 'function') window.showToast(result.error || "授权修改失败", "#e74c3c");
            // 复位状态
            const kwInput = document.getElementById('sys-role-search-kw');
            if (kwInput) handleSysRoleSearch(kwInput.value);
        }
    } catch (e) {
        if (typeof window.showToast === 'function') window.showToast("连接服务器失败，请检查网络", "#e74c3c");
        // 复位状态
        const kwInput = document.getElementById('sys-role-search-kw');
        if (kwInput) handleSysRoleSearch(kwInput.value);
    }
};

window.saveSystemConfig = async () => {
    const payload = {
        siteTitle: document.getElementById('sys-site-title').value.trim(),
        faviconUrl: document.getElementById('sys-favicon-url').value.trim(),
        seoKeywords: document.getElementById('sys-seo-keywords').value.trim(),
        seoDescription: document.getElementById('sys-seo-desc').value.trim(),
        allowOpenRegistration: document.getElementById('sys-allow-reg').checked,
        requireInvitation: document.getElementById('sys-require-invite').checked,
        enableAdminInstantAlert: document.getElementById('sys-instant-alert').checked,
        superUserInviteQuota: parseInt(document.getElementById('sys-su-quota').value) || 10,
        systemTimezone: document.getElementById('sys-timezone').value,
        security: {
            maxLoginAttempts: parseInt(document.getElementById('sys-login-max').value),
            loginLockoutMin: parseInt(document.getElementById('sys-login-lock').value),
            maxRegisterPerHour: parseInt(document.getElementById('sys-reg-max').value),
            registerLockoutHours: parseInt(document.getElementById('sys-reg-lock').value)
        }
    };

    if (window.SyncUI) {
        await window.SyncUI.perform('ADMIN_CONFIG', async () => {
            const res = await fetch('/api/admin/site-config', {
                method: 'POST',
                headers: { 
                    'Authorization': window.sysToken,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                // Task 13.4: 立即重新拉取并应用最新的站点配置 (标题、SEO、Favicon 等)
                if (typeof window.initSiteConfig === 'function') {
                    window.initSiteConfig(); 
                }
                if (typeof window.closeAllModals === 'function') {
                    window.closeAllModals();
                }
            } else {
                const data = await res.json();
                throw new Error(data.error || "下发失败");
            }
        });
    }
};
