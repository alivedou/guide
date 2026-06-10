-- 公告已读状态表 (Task 6.22)
CREATE TABLE IF NOT EXISTS announcement_read_states (
    user_id TEXT,
    announcement_id INTEGER,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, announcement_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);
