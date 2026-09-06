import { sendEmailHelper as sendSharedEmail } from '../../nav-main/shared/alerts.js';
import {
    EMAIL_FROM,
    RESEND_API_KEY,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID
} from './config.js';
import { db } from './db.js';

export async function dispatchInstantAdminAlert(action, details, adminUserId, ip) {
    try {
        const admin = db.prepare('SELECT id, username FROM users WHERE id = ?').get(adminUserId) || { id: adminUserId, username: 'Unknown' };
        const subject = `【CloudNav 安全警报】管理员执行了业务级高危敏感操作`;
        const text = `🚨 系统安全警报：管理员于后台执行了业务级高危敏感操作！\n\n` +
                     `👤 执行管理员: ${admin.username || '未知 (ID: ' + admin.id + ')'}\n` +
                     `🎬 操作行为: ${action}\n` +
                     `📝 详情细节: ${details}\n` +
                     `🌐 来源 IP: ${ip || '[Protected]'}\n` +
                     `🕒 发生时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })} (北京时间)\n\n` +
                     `此消息为实时安全警报，仅派发至授权紧急告警的账户。`;

        console.log(`[Alert] Dispatching secure alert for admin ${admin.username}: action=${action}`);

        if (TELEGRAM_BOT_TOKEN) {
            try {
                const receivers = db.prepare(`
                    SELECT u.telegram_chat_id
                    FROM users u
                    JOIN user_settings s ON u.id = s.user_id
                    WHERE s.is_alert_receiver = 1 AND u.telegram_chat_id IS NOT NULL AND u.telegram_chat_id != ''
                `).all();

                console.log(`[Alert] Found TG alert receivers: ${receivers.length}`);

                const htmlContent = text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");

                if (receivers && receivers.length > 0) {
                    for (const r of receivers) {
                        console.log(`[Alert] Sending TG alert to chat_id: ${r.telegram_chat_id}`);
                        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: r.telegram_chat_id,
                                text: `🚨 <b>${subject}</b>\n\n${htmlContent}`,
                                parse_mode: 'HTML'
                            })
                        }).catch(e => console.error('[TG Instant Alert] failed for', r.telegram_chat_id, e));
                    }
                }
                if (TELEGRAM_CHAT_ID) {
                    console.log(`[Alert] Sending TG alert to global chat_id (TELEGRAM_CHAT_ID): ${TELEGRAM_CHAT_ID}`);
                    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: TELEGRAM_CHAT_ID,
                            text: `🚨 <b>${subject}</b>\n\n${htmlContent}`,
                            parse_mode: 'HTML'
                        })
                    }).catch(e => console.error('[TG Global Instant Alert] failed', e));
                }
            } catch (tgErr) {
                console.error('[TG Alert Setup Error] Failed to process Telegram alerts:', tgErr.message);
            }
        } else {
            console.warn('[Alert] TELEGRAM_BOT_TOKEN is not configured/empty, telegram messaging is skipped.');
        }
    } catch (e) {
        console.error('[Instant Alert Error] Failed to dispatch instant alert:', e.message);
    }
}

export async function sendEmailHelper(recipient, subject, content) {
    return sendSharedEmail(recipient, subject, content, {
        resendApiKey: RESEND_API_KEY,
        emailFrom: EMAIL_FROM,
        mockIfMissing: true
    });
}
