import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { applySchemaPatches } from '../../nav-main/shared/schema-patch.js';
import { ROOT_DIR, DB_PATH } from './config.js';

const db = new Database(DB_PATH);

const checkTables = () => {
    try {
        const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
        if (!row) {
            console.log('[DB] Core tables missing, performing auto-initialization...');
            const initSql = path.join(ROOT_DIR, 'migrations', '0000_init.sql');
            if (fs.existsSync(initSql)) {
                db.exec(fs.readFileSync(initSql, 'utf-8'));
                console.log('[DB] 0000_init.sql applied successfully.');
            }
        }
    } catch (e) {
        console.error('[DB] Auto-check failed:', e.message);
    }
};
checkTables();

const migrationsDir = path.join(ROOT_DIR, 'migrations');
if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).sort();
    files.forEach(file => {
        if (file.endsWith('.sql')) {
            console.log(`[DB] Processing migration: ${file}`);
            try {
                db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
            } catch (e) {
                if (e.message.includes('duplicate column name') || e.message.includes('already exists')) {
                    console.log(`[DB] Migration ${file} already applied or partially applied (skipped duplicate)`);
                } else {
                    console.error(`[DB] Migration ${file} failed:`, e.message);
                }
            }
        }
    });
}

try {
    await applySchemaPatches((sql) => {
        db.exec(sql);
    });
    try {
        db.exec("UPDATE users SET has_invite = 1 WHERE id IN (SELECT used_by FROM invitation_codes WHERE used_by IS NOT NULL)");
    } catch (patchErr) {
        console.warn('[DB] Retroactive invite patch skipped:', patchErr.message);
    }
} catch (e) {
    console.warn('[DB] Auto-patch skipped:', e.message);
}

export { db };
