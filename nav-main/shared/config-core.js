/**
 * /api/config 领域逻辑。HTTP 信封由 Node / CF 适配器组装。
 * KV 键名不出现在这里：由 StoragePort 实现决定。
 */

import { getQuota } from './quota.js';
import { formatCNTime } from './time.js';
import {
  remapNavIds,
  checkNavQuota,
  buildSaveStatements,
  buildResetStatements,
  newNavId
} from './ids.js';

export function isGuestUser(user) {
  return !user || !user.id || user.id === 'guest';
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeConfigShape(data) {
  const next = data && typeof data === 'object' ? data : { categories: [], items: [] };
  if (next.items) {
    next.items = next.items.map((i) => ({
      ...i,
      catId: i.catId || i.cat_id
    }));
  }
  if (next.categories) {
    next.categories = next.categories.map((c) => ({
      ...c,
      id: c.id,
      _isVideo: c._isVideo ?? !!c.is_video
    }));
  }
  return next;
}

export function configEnvelope(user, dataObj, quota) {
  const guest = isGuestUser(user);
  return {
    ...dataObj,
    isAdmin: user && (user.role === 'admin' || user.role === 'super_user'),
    user: guest ? 'guest' : user.id,
    uid: user && user.uid,
    username: user && user.username,
    role: user && user.role,
    quota,
    lastUpdated: dataObj.lastUpdated || formatCNTime(new Date())
  };
}

/**
 * @param {object} port StoragePort
 * @param {object} user
 */
export async function readConfig(port, user) {
  const guest = isGuestUser(user);
  const quota = getQuota(guest ? null : user);
  let data = guest ? await port.readGuestConfig() : await port.readUserConfig(user.id);
  data = normalizeConfigShape(cloneJson(data || {}));
  if (guest) {
    data.categories = (data.categories || []).filter((c) => !c.hidden);
    data.items = (data.items || []).filter((i) => !i.hidden);
  }
  return configEnvelope(user, data, quota);
}

/**
 * @param {object} port
 * @param {object} user
 * @param {object} body
 */
export async function saveConfig(port, user, body) {
  if (isGuestUser(user)) {
    return { ok: false, status: 401, error: 'Unauthorized', code: 'ERR_UNAUTHORIZED' };
  }

  const payload = body && typeof body === 'object' ? body : {};
  const quota = getQuota(user);
  const quotaCheck = checkNavQuota(payload.categories, payload.items, quota);
  if (!quotaCheck.ok) {
    return { ok: false, status: 403, error: quotaCheck.error, code: quotaCheck.code };
  }

  const remapped = remapNavIds(payload.categories, payload.items, () => port.newId?.() || newNavId());
  const stmts = buildSaveStatements(user.id, remapped, payload.settings);

  try {
    await port.runMany(stmts);
  } catch (e) {
    const msg = (e && e.message) || String(e);
    if (/UNIQUE/i.test(msg)) {
      return {
        ok: false,
        status: 409,
        error: '数据 ID 冲突，请重新导出后再导入，或刷新页面后重试同步',
        code: 'ERR_ID_CONFLICT'
      };
    }
    return { ok: false, status: 500, error: msg || '保存配置失败', code: 'ERR_CONFIG_SAVE' };
  }

  const lastUpdated = formatCNTime(new Date());
  await port.persistSavedConfig(user.id, { remapped, requestBody: payload, lastUpdated });
  return { ok: true, status: 200, remapped, lastUpdated };
}

/**
 * @param {object} port
 * @param {object} user
 */
export async function resetConfig(port, user) {
  if (isGuestUser(user)) {
    return { ok: false, status: 401, error: 'Unauthorized', code: 'ERR_UNAUTHORIZED' };
  }

  const onboarding = await port.loadOnboarding();
  const stmts = buildResetStatements(user.id, onboarding, () => port.newId?.() || newNavId());
  try {
    await port.runMany(stmts);
  } catch (e) {
    return { ok: false, status: 500, error: (e && e.message) || 'Reset failed', code: 'ERR_CONFIG_RESET' };
  }

  await port.persistResetConfig(user.id, onboarding);
  return { ok: true, status: 200 };
}
