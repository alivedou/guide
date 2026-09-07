import fs from 'fs';
import path from 'path';
import { defaultData, MINIMAL_SAFE_DATA } from '../../nav-main/shared/default-data.js';
import { buildUserNavSnapshot } from '../../nav-main/shared/share-page.js';
import { KV_DIR } from './config.js';
import { db } from './db.js';

export const syncUserToKV = (userId) => {
    console.log(`[KV] Syncing data for user: ${userId}`);
    const categories = db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order ASC, name ASC').all(userId);
    const items = db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY sort_order ASC, title ASC').all(userId);
    const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);

    let existingLastUpdated = null;
    const kvDir = KV_DIR;
    const filePath = path.join(kvDir, `user_${userId}.json`);
    if (fs.existsSync(filePath)) {
        try {
            const oldData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            existingLastUpdated = oldData.lastUpdated;
        } catch (e) {
            console.error('[KV] Error reading existing file for lastUpdated:', e);
        }
    }

    const userData = buildUserNavSnapshot(categories, items, settings, existingLastUpdated);

    if (!fs.existsSync(kvDir)) fs.mkdirSync(kvDir);

    fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));
    console.log(`[KV] Successfully wrote ${categories.length} cats and ${items.length} items to ${filePath}`);
    return userData;
};

export const getOnboardingData = () => {
    if (defaultData && defaultData.categories && defaultData.categories.length > 0) {
        console.log('[Onboarding] Loading template from defaultData.js');
        return defaultData;
    }

    console.warn('[Onboarding] CRITICAL: Using MINIMAL_SAFE_DATA fallback');
    return MINIMAL_SAFE_DATA;
};
