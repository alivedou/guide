-- ==========================================
-- 高度自定义高颜值导航网站 - 完整 D1 数据库结构
-- 【运行时权威源】Docker/server 只加载本文件；控制台材料见 sql/
-- ==========================================
-- 数据库初始化方法（任选其一）：
--
-- 方法一（Cloudflare 控制台，推荐用 sql/schema.console.sql）：
--   1. 登录 Cloudflare 控制台 -> 存储和数据库 -> D1
--   2. 选中 cloudnav-db -> Console
--   3. 粘贴 sql/schema.console.sql 全文执行；失败则按条 CREATE 执行
--
-- 方法二（wrangler CLI）：
--   npx wrangler d1 migrations apply cloudnav-db --remote
--   或: npx wrangler d1 execute cloudnav-db --remote --file=./sql/schema.sql
--
-- 老库缺列升级（CREATE IF NOT EXISTS 不会加列）：
--   控制台逐条执行 sql/schema.upgrade.sql（duplicate column 可忽略）
--
-- 超级管理员：初始化后在前端注册第一个账号，系统自动将其设为管理员。
-- 同步 migrations/0000_init.sql 时请保持与本文件表结构一致。
-- ==========================================

-- 1. 用户主表
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

-- 创建用户 UID 索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uid ON users(uid);

-- 临时密码查询索引
CREATE INDEX IF NOT EXISTS idx_users_temp_password_expires ON users(temp_password_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_temp_password_active ON users(is_temp_password_active);

-- 2. 审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT,
    details TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 分类表
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

-- 4. 网址项目表
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

-- 5. 用户偏好设置
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

-- 6. 公告系统
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

-- 7. 邀请码表
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

-- 8. 公告已读状态表
CREATE TABLE IF NOT EXISTS announcement_read_states (
    user_id TEXT,
    announcement_id INTEGER,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, announcement_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);
