-- 为用户增加邀请码注册标识
ALTER TABLE users ADD COLUMN has_invite BOOLEAN DEFAULT 0;

-- 修复历史数据：将已使用邀请码注册的用户标记为 has_invite = 1
UPDATE users SET has_invite = 1 WHERE id IN (SELECT used_by FROM invitation_codes WHERE used_by IS NOT NULL);
