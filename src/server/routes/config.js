import { readConfig, saveConfig, resetConfig } from '../../../nav-main/shared/config-core.js';
import { db } from '../db.js';
import { authenticate } from '../middleware.js';
import { createNodeStoragePort } from '../storage-port.js';

function enrichUser(user) {
  if (user && user.role === 'user' && user.id && user.id !== 'guest') {
    try {
      const dbUser = db.prepare('SELECT has_invite FROM users WHERE id = ?').get(user.id);
      return { ...user, hasInvite: !!(dbUser && dbUser.has_invite === 1), has_invite: dbUser?.has_invite };
    } catch (e) {
      console.error('[Quota] Failed to query user invite status from DB:', e.message);
    }
  }
  return user;
}

export function registerConfigRoutes(app) {
  const port = createNodeStoragePort();

  app.get('/api/config', authenticate, async (req, res) => {
    const data = await readConfig(port, enrichUser(req.user));
    res.json(data);
  });

  app.post('/api/config', authenticate, async (req, res) => {
    const result = await saveConfig(port, enrichUser(req.user), req.body);
    if (!result.ok) {
      if (result.status === 401) return res.status(401).end();
      return res.status(result.status).json({ error: result.error, code: result.code });
    }
    res.json({ success: true });
  });

  app.delete('/api/config', authenticate, async (req, res) => {
    const userId = req.user.id;
    if (userId === 'guest') return res.status(401).end();
    console.log(`[Config] Resetting data for user: ${userId}`);
    const result = await resetConfig(port, enrichUser(req.user));
    if (!result.ok) {
      console.error('[Config] Reset Error:', result.error);
      return res.status(result.status).json({ error: 'Reset failed', details: result.error });
    }
    console.log(`[Config] Reset success and cache cleared for user: ${userId}`);
    res.json({ success: true, message: '已恢复默认配置' });
  });
}
