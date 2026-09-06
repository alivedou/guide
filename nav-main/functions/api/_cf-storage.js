/**
 * Cloudflare StoragePort。KV 键保持 user_config:<uuid> 与游客 config，不要改成 Node 文件名。
 */
import { defaultData, MINIMAL_SAFE_DATA } from '../../shared/default-data.js';
import { formatCNTime } from '../../shared/time.js';
import { applySchemaPatches } from '../../shared/schema-patch.js';

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
      const dataObj = { ...defaultData, lastUpdated: formatCNTime(new Date()) };
      waitUntil(env.nav.put(kvKey, JSON.stringify(dataObj)));
      return dataObj;
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
