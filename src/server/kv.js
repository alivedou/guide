import fs from 'fs';
import path from 'path';
import { defaultData, MINIMAL_SAFE_DATA } from '../../nav-main/shared/default-data.js';
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

    const userData = {
        categories: categories.map(c => ({
            ...c,
            id: c.id,
            _isVideo: !!c.is_video,
            hidden: !!c.hidden
        })),
        items: items.map(i => ({
            ...i,
            catId: i.cat_id,
            cat_id: i.cat_id,
            hidden: !!i.hidden
        })),
        settings: settings ? {
            cardWidth: settings.card_width,
            zenMode: !!settings.zen_mode,
            showFrequent: !!settings.show_f_requent,
            bgUrl: settings.bg_url,
            hideBgMask: !!settings.hide_bg_mask,
            isolatedView: !!settings.isolated_view,
            density: settings.density || 'standard',
            simpleMode: !!settings.simple_mode,
            link_target: settings.link_target || '_blank',
            syncInterval: settings.sync_interval !== null && settings.sync_interval !== undefined ? settings.sync_interval : 7,
            themeMode: settings.theme_mode
        } : defaultData.settings,
        lastUpdated: existingLastUpdated || null
    };

    if (settings && settings.show_frequent !== undefined) {
        userData.settings.showFrequent = !!settings.show_frequent;
    }

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
