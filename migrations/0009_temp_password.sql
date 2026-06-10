-- 任务：临时密码安全增强功能
-- 描述：添加临时密码相关字段以防止管理员权限滥用
-- 作者：adou
-- 创建日期：2026-06-10

-- 在 users 表中添加临时密码字段
ALTER TABLE users ADD COLUMN temp_password_hash TEXT;
ALTER TABLE users ADD COLUMN temp_password_expires_at DATETIME;
ALTER TABLE users ADD COLUMN is_temp_password_active BOOLEAN DEFAULT 0;

-- 添加临时密码字段的索引以提高查询效率
CREATE INDEX IF NOT EXISTS idx_users_temp_password_expires ON users(temp_password_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_temp_password_active ON users(is_temp_password_active);