import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
export const ROOT_DIR = path.resolve(path.dirname(__filename), '../..');

export const KV_DIR = process.env.KV_DIR || path.join(ROOT_DIR, 'local_kv');
if (!fs.existsSync(KV_DIR)) fs.mkdirSync(KV_DIR, { recursive: true });

export const DB_PATH = process.env.DB_PATH || path.join(ROOT_DIR, 'local_d1.db');
export const PORT = process.env.PORT || 3000;
export const JWT_SECRET = process.env.JWT_SECRET || 'cloudnav-secret-2026';
export const CRON_SECRET = process.env.CRON_SECRET || 'cloudnav-cron-secret-secure-key';
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
export const EMAIL_FROM = process.env.EMAIL_FROM || 'CloudNav Alerts <alerts@cloudnav.tech>';
export const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
export const secret = new TextEncoder().encode(JWT_SECRET);
