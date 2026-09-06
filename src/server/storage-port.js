import fs from 'fs';
import path from 'path';
import { defaultData } from '../../nav-main/shared/default-data.js';
import { KV_DIR } from './config.js';
import { db } from './db.js';
import { getOnboardingData, syncUserToKV } from './kv.js';

/**
 * Node StoragePort。KV 文件名保持 user_<uuid>.json，不要改成 CF 的 user_config: 前缀。
 */
export function createNodeStoragePort() {
  return {
    newId() {
      return globalThis.crypto.randomUUID();
    },
    async readGuestConfig() {
      return JSON.parse(JSON.stringify(defaultData));
    },
    async readUserConfig(userId) {
      const kvPath = path.join(KV_DIR, `user_${userId}.json`);
      if (fs.existsSync(kvPath)) {
        return JSON.parse(fs.readFileSync(kvPath, 'utf-8'));
      }
      return syncUserToKV(userId);
    },
    async persistSavedConfig(userId, { lastUpdated, requestBody }) {
      const currentData = syncUserToKV(userId);
      currentData.lastUpdated = lastUpdated;
      if (requestBody && requestBody.clicks_history) {
        currentData.clicks_history = requestBody.clicks_history;
      }
      const kvPath = path.join(KV_DIR, `user_${userId}.json`);
      fs.writeFileSync(kvPath, JSON.stringify(currentData, null, 2));
      return currentData;
    },
    async persistResetConfig(userId) {
      const kvPath = path.join(KV_DIR, `user_${userId}.json`);
      if (fs.existsSync(kvPath)) fs.unlinkSync(kvPath);
      return syncUserToKV(userId);
    },
    async loadOnboarding() {
      return getOnboardingData();
    },
    async runMany(stmts) {
      db.transaction(() => {
        for (const { sql, params } of stmts) {
          db.prepare(sql).run(...(params || []));
        }
      })();
    },
    waitUntil() {}
  };
}
