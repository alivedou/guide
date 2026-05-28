-- 邀请码表
CREATE TABLE IF NOT EXISTS invitation_codes (
    code TEXT PRIMARY KEY,
    creator_id TEXT,
    used_by TEXT,
    status TEXT DEFAULT 'unused', -- unused, used
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME,
    FOREIGN KEY(creator_id) REFERENCES users(id),
    FOREIGN KEY(used_by) REFERENCES users(id)
);
