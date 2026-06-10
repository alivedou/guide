-- ==========================================
-- 🚀 高度自定义高颜值导航网站 - 完整 D1 数据库结构
-- ==========================================
-- 💡 数据库初始化方法（任选其一）：
--
-- 方法一（逐条粘贴，推荐）：
--   1. 登录 Cloudflare 控制台 -> Workers & Pages -> D1
--   2. 选中你的 cloudnav-db 数据库 -> 点击 Console 选项卡
--   3. 逐条复制下面每条 CREATE TABLE 语句，粘贴到 Console 执行
--      （提示：D1 Console 不支持一次性全量执行，需逐条操作）
--
-- 方法二（wrangler CLI）：
--   npx wrangler d1 execute cloudnav-db --remote --file=./schema.sql
--
-- 💡 超级管理员：初始化后在前端注册第一个账号，系统自动将其设为管理员。
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
    telegram_chat_id TEXT,         -- Telegram Chat ID
    temp_password_hash TEXT,       -- 临时密码哈希
    temp_password_expires_at DATETIME,  -- 临时密码过期时间
    is_temp_password_active BOOLEAN DEFAULT 0  -- 临时密码是否激活
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
    is_shared BOOLEAN DEFAULT 0,              -- 是否开启主页公开分享
    share_slug TEXT,                          -- 主页公开分享个性尾缀 (Slug)
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_share_slug ON user_settings(share_slug);

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
