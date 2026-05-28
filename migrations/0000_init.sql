-- 用户主表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,           -- UUID
    username TEXT UNIQUE NOT NULL, -- 用户名
    password_hash TEXT NOT NULL,   -- SHA-256 密码哈希
    role TEXT DEFAULT 'user',      -- admin, user, super_user
    status TEXT DEFAULT 'active',  -- active, frozen
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- 审计日志 (可选，对应 4.3 需求)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT,
    details TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 分类表 (4.4 CRUD 基础)
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

-- 网址项目表 (4.4 CRUD 基础)
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

-- 用户偏好设置 (4.4 设置项)
CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    card_width INTEGER DEFAULT 85,
    zen_mode BOOLEAN DEFAULT 0,
    show_frequent BOOLEAN DEFAULT 1,
    bg_url TEXT,
    simple_mode BOOLEAN DEFAULT 0,
    open_in_new_tab BOOLEAN DEFAULT 1,
    theme_mode TEXT DEFAULT 'auto',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 公告系统 (4.3 需求)
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id TEXT,
    title TEXT,
    content TEXT,
    type TEXT DEFAULT 'quiet', -- silent, important
    status TEXT DEFAULT 'published', -- draft, published, archived
    is_top BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(creator_id) REFERENCES users(id)
);
