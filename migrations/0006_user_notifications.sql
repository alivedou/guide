-- Add email column to users table
ALTER TABLE users ADD COLUMN email TEXT;

-- Add notification authorization columns to user_settings table
ALTER TABLE user_settings ADD COLUMN is_alert_receiver BOOLEAN DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN is_digest_receiver BOOLEAN DEFAULT 0;
