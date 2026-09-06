/**
 * Cloudflare D1 缺列/缺表运行时补丁（增量模块）
 * 解决：老库只用 CREATE IF NOT EXISTS 初始化后，后续新字段不存在导致 no such column
 * 不删表、不改业务逻辑；每条 ALTER 失败（列已存在）则静默跳过。
 */

const PATCH_SQL = [
  // users
  "ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'",
  "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
  "ALTER TABLE users ADD COLUMN uid INTEGER",
  "ALTER TABLE users ADD COLUMN has_invite BOOLEAN DEFAULT 0",
  "ALTER TABLE users ADD COLUMN email TEXT",
  "ALTER TABLE users ADD COLUMN telegram_chat_id TEXT",
  "ALTER TABLE users ADD COLUMN temp_password_hash TEXT",
  "ALTER TABLE users ADD COLUMN temp_password_expires_at DATETIME",
  "ALTER TABLE users ADD COLUMN is_temp_password_active BOOLEAN DEFAULT 0",
  "ALTER TABLE users ADD COLUMN last_login DATETIME",
  // categories / items
  "ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0",
  "ALTER TABLE categories ADD COLUMN is_video BOOLEAN DEFAULT 0",
  "ALTER TABLE categories ADD COLUMN hidden BOOLEAN DEFAULT 0",
  "ALTER TABLE items ADD COLUMN bg_color TEXT",
  "ALTER TABLE items ADD COLUMN sort_order INTEGER DEFAULT 0",
  "ALTER TABLE items ADD COLUMN hidden BOOLEAN DEFAULT 0",
  // user_settings（分享/通知/主题等）
  "ALTER TABLE user_settings ADD COLUMN card_width INTEGER DEFAULT 85",
  "ALTER TABLE user_settings ADD COLUMN zen_mode BOOLEAN DEFAULT 1",
  "ALTER TABLE user_settings ADD COLUMN show_frequent BOOLEAN DEFAULT 1",
  "ALTER TABLE user_settings ADD COLUMN bg_url TEXT",
  "ALTER TABLE user_settings ADD COLUMN hide_bg_mask BOOLEAN DEFAULT 0",
  "ALTER TABLE user_settings ADD COLUMN isolated_view BOOLEAN DEFAULT 0",
  "ALTER TABLE user_settings ADD COLUMN density TEXT DEFAULT 'standard'",
  "ALTER TABLE user_settings ADD COLUMN simple_mode BOOLEAN DEFAULT 0",
  "ALTER TABLE user_settings ADD COLUMN theme_mode TEXT DEFAULT 'auto'",
  "ALTER TABLE user_settings ADD COLUMN link_target TEXT DEFAULT '_blank'",
  "ALTER TABLE user_settings ADD COLUMN is_alert_receiver BOOLEAN DEFAULT 0",
  "ALTER TABLE user_settings ADD COLUMN is_digest_receiver BOOLEAN DEFAULT 0",
  "ALTER TABLE user_settings ADD COLUMN is_shared BOOLEAN DEFAULT 0",
  "ALTER TABLE user_settings ADD COLUMN share_slug TEXT",
  "ALTER TABLE user_settings ADD COLUMN sync_interval INTEGER DEFAULT 7",
  // announcements
  "ALTER TABLE announcements ADD COLUMN creator_id TEXT",
  "ALTER TABLE announcements ADD COLUMN type TEXT DEFAULT 'quiet'",
  "ALTER TABLE announcements ADD COLUMN status TEXT DEFAULT 'published'",
  "ALTER TABLE announcements ADD COLUMN is_top BOOLEAN DEFAULT 0",
  "ALTER TABLE announcements ADD COLUMN expire_at DATETIME",
  // invitation_codes
  "ALTER TABLE invitation_codes ADD COLUMN creator_id TEXT",
  "ALTER TABLE invitation_codes ADD COLUMN used_by TEXT",
  "ALTER TABLE invitation_codes ADD COLUMN status TEXT DEFAULT 'unused'",
  "ALTER TABLE invitation_codes ADD COLUMN used_at DATETIME",
  // 缺表
  `CREATE TABLE IF NOT EXISTS announcement_read_states (
    user_id TEXT,
    announcement_id INTEGER,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, announcement_id)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT,
    details TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uid ON users(uid)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_share_slug ON user_settings(share_slug)"
];

/**
 * @param {D1Database} db
 * @returns {Promise<{ patched: number, errors: string[] }>}
 */
export async function ensureD1Schema(db) {
  if (!db) return { patched: 0, errors: ['no_db'] };
  let patched = 0;
  const errors = [];
  for (const sql of PATCH_SQL) {
    try {
      await db.prepare(sql).run();
      patched += 1;
    } catch (e) {
      const msg = (e && e.message) || String(e);
      // 已存在列/索引：正常
      if (
        /duplicate column/i.test(msg) ||
        /already exists/i.test(msg) ||
        /no such table/i.test(msg) // 表还不存在时 ALTER 失败，应由 0000_init 先建表
      ) {
        continue;
      }
      errors.push(msg.slice(0, 120));
    }
  }
  return { patched, errors };
}
