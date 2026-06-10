-- 增加分享设置列
ALTER TABLE user_settings ADD COLUMN is_shared BOOLEAN DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN share_slug TEXT;
-- 增加唯一性索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_share_slug ON user_settings(share_slug);
