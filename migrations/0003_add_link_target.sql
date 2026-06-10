-- Task 36.1: 添加网址跳转模式设置
ALTER TABLE user_settings ADD COLUMN link_target TEXT DEFAULT '_blank';
