-- ==========================================
-- 🚀 高度自定义高颜值导航网站 - 完整 D1 数据库结构
-- 适合网页端一键执行或全新安装初始化
-- ==========================================

-- 1. 用户主表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,           -- UUID
    username TEXT UNIQUE NOT NULL, -- 用户名
    password_hash TEXT NOT NULL,   -- SHA-256 密码哈希
    role TEXT DEFAULT 'user',      -- admin, user, super_user
    status TEXT DEFAULT 'active',  -- active, frozen
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    uid INTEGER,                   -- 友好 UID
    has_invite BOOLEAN DEFAULT 0,  -- 是否通过邀请码注册
    email TEXT,                    -- 邮箱
    telegram_chat_id TEXT          -- Telegram Chat ID
);

-- 创建用户 UID 索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uid ON users(uid);

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
    open_in_new_tab BOOLEAN DEFAULT 1,
    theme_mode TEXT DEFAULT 'auto',
    link_target TEXT DEFAULT '_blank',        -- 网址跳转模式
    is_alert_receiver BOOLEAN DEFAULT 0,      -- 是否接收警报
    is_digest_receiver BOOLEAN DEFAULT 0,     -- 是否接收日报
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. 公告系统
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id TEXT,
    title TEXT,
    content TEXT,
    type TEXT DEFAULT 'quiet',       -- silent, important
    status TEXT DEFAULT 'published', -- draft, published, archived
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
    status TEXT DEFAULT 'unused',    -- unused, used
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
