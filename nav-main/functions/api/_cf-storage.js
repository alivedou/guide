/**
 * Cloudflare StoragePort。KV 键保持 user_config:<uuid> 与游客 config，不要改成 Node 文件名。
 */
import { defaultData, MINIMAL_SAFE_DATA } from '../../shared/default-data.js';
import { formatCNTime } from '../../shared/time.js';
import { applySchemaPatches } from '../../shared/schema-patch.js';
import { buildUserNavSnapshot } from '../../shared/share-page.js';

export async function assembleUserNavFromD1(env, userId) {
  const cats = await env.DB.prepare(
    'SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order ASC, name ASC'
  )
    .bind(userId)
    .all();
  const items = await env.DB.prepare(
    'SELECT * FROM items WHERE user_id = ? ORDER BY sort_order ASC, title ASC'
  )
    .bind(userId)
    .all();
  const settingsRow = await env.DB.prepare('SELECT * FROM user_settings WHERE user_id = ?')
    .bind(userId)
    .first();
  return buildUserNavSnapshot(cats.results || [], items.results || [], settingsRow);
}

export function createCfStoragePort(env, waitUntil = () => {}) {
  return {
    newId() {
      return globalThis.crypto.randomUUID();
    },
    async readGuestConfig() {
      const dataStr = await env.nav.get('config');
      if (dataStr) return JSON.parse(dataStr);
      return { ...defaultData, lastUpdated: formatCNTime(new Date()) };
    },
    async readUserConfig(userId) {
      const kvKey = `user_config:${userId}`;
      const dataStr = await env.nav.get(kvKey);
      if (dataStr) return JSON.parse(dataStr);
      // 不要把游客默认模板写入 user_config:<uuid>：否则分享页会一直读到未定制的主页
      const fromD1 = await assembleUserNavFromD1(env, userId);
      if ((fromD1.categories && fromD1.categories.length) || (fromD1.items && fromD1.items.length)) {
        return fromD1;
      }
      return { ...defaultData, lastUpdated: formatCNTime(new Date()) };
    },
    async persistSavedConfig(userId, { remapped, requestBody, lastUpdated }) {
      const kvKey = `user_config:${userId}`;
      const syncedData = {
        ...requestBody,
        categories: remapped.categories,
        items: remapped.items,
        lastUpdated
      };
      await env.nav.put(kvKey, JSON.stringify(syncedData));
      return syncedData;
    },
    async persistResetConfig(userId, onboarding) {
      const kvKey = `user_config:${userId}`;
      const resetData = { ...onboarding, lastUpdated: formatCNTime(new Date()) };
      await env.nav.put(kvKey, JSON.stringify(resetData));
      return resetData;
    },
    async loadOnboarding() {
      try {
        const templateStr = await env.nav.get('system:onboarding_template');
        if (templateStr) {
          const parsed = JSON.parse(templateStr);
          if (parsed && parsed.categories) return parsed;
        }
      } catch (e) {
        console.error('[Reset] Template load failed', e);
      }
      if (defaultData && defaultData.categories && defaultData.categories.length > 0) {
        return defaultData;
      }
      return MINIMAL_SAFE_DATA;
    },
    async runMany(stmts) {
      const runBatch = async () => {
        const bound = stmts.map((s) => env.DB.prepare(s.sql).bind(...(s.params || [])));
        const chunkSize = 80;
        for (let i = 0; i < bound.length; i += chunkSize) {
          await env.DB.batch(bound.slice(i, i + chunkSize));
        }
      };
      try {
        await runBatch();
      } catch (batchErr) {
        const msg = (batchErr && batchErr.message) || '';
        if (msg.includes('has no column named') || msg.includes('no such column')) {
          await applySchemaPatches(async (sql) => {
            try {
              await env.DB.prepare(sql).run();
            } catch {
              /* duplicate / missing table */
            }
          });
          await runBatch();
        } else {
          throw batchErr;
        }
      }
    },
    waitUntil
  };
}
