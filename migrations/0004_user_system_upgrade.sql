-- 增加友好 UID 字段
ALTER TABLE users ADD COLUMN uid INTEGER;
-- 创建索引以提高查询效率并保证唯一性
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uid ON users(uid);

-- 补充权限描述表（可选，用于存储角色定义，但目前我们可以直接在代码中定义逻辑）
-- 这里我们先为现有用户补充一个初始 UID (如果有的话)
UPDATE users SET uid = 10001 WHERE username = (SELECT username FROM users ORDER BY created_at ASC LIMIT 1);
