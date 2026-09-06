import { getQuota as resolveQuota } from '../../nav-main/shared/quota.js';
import { db } from './db.js';

export function getQuota(user) {
    if (user && user.role === 'user' && user.id && user.id !== 'guest') {
        try {
            const dbUser = db.prepare('SELECT has_invite FROM users WHERE id = ?').get(user.id);
            return resolveQuota(user, { hasInvite: !!(dbUser && dbUser.has_invite === 1) });
        } catch (e) {
            console.error('[Quota] Failed to query user invite status from DB:', e.message);
        }
    }
    return resolveQuota(user);
}
