-- AUTO-GENERATED from migrations/0000_init.sql. Do not edit by hand.
-- Regenerate: npm run sql:generate
-- Runtime authority is migrations/0000_init.sql (copied into Docker).
-- This directory is documentation / Cloudflare console material only.

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    uid INTEGER,
    has_invite BOOLEAN DEFAULT 0,
    email TEXT,
    telegram_chat_id TEXT,
    temp_password_hash TEXT,
    temp_password_expires_at DATETIME,
    is_temp_password_active BOOLEAN DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uid ON users(uid);

CREATE INDEX IF NOT EXISTS idx_users_temp_password_expires ON users(temp_password_expires_at);

CREATE INDEX IF NOT EXISTS idx_users_temp_password_active ON users(is_temp_password_active);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT,
    details TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_video BOOLEAN DEFAULT 0,
    hidden BOOLEAN DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    cat_id TEXT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    desc TEXT,
    icon TEXT,
    bg_color TEXT,
    sort_order INTEGER DEFAULT 0,
    hidden BOOLEAN DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(cat_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    card_width INTEGER DEFAULT 85,
    zen_mode BOOLEAN DEFAULT 1,
    show_frequent BOOLEAN DEFAULT 1,
    bg_url TEXT,
    hide_bg_mask BOOLEAN DEFAULT 0,
    isolated_view BOOLEAN DEFAULT 0,
    density TEXT DEFAULT 'standard',
    simple_mode BOOLEAN DEFAULT 0,
    theme_mode TEXT DEFAULT 'auto',
    link_target TEXT DEFAULT '_blank',
    is_alert_receiver BOOLEAN DEFAULT 0,
    is_digest_receiver BOOLEAN DEFAULT 0,
    is_shared BOOLEAN DEFAULT 0,
    share_slug TEXT,
    sync_interval INTEGER DEFAULT 7,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_share_slug ON user_settings(share_slug);

CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id TEXT,
    title TEXT,
    content TEXT,
    type TEXT DEFAULT 'quiet',
    status TEXT DEFAULT 'published',
    is_top BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expire_at DATETIME,
    FOREIGN KEY(creator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS invitation_codes (
    code TEXT PRIMARY KEY,
    creator_id TEXT,
    used_by TEXT,
    status TEXT DEFAULT 'unused',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME,
    FOREIGN KEY(creator_id) REFERENCES users(id),
    FOREIGN KEY(used_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcement_read_states (
    user_id TEXT,
    announcement_id INTEGER,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, announcement_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);
