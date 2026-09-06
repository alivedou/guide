/**
 * Cloudflare D1 缺列/缺表运行时补丁（薄适配器）
 * SQL 列表在 ../../shared/schema-patch.js，禁止在这里再抄一份。
 */
import { applySchemaPatches } from '../../shared/schema-patch.js';

/**
 * @param {D1Database} db
 * @returns {Promise<{ patched: number, errors: string[] }>}
 */
export async function ensureD1Schema(db) {
  if (!db) return { patched: 0, errors: ['no_db'] };
  return applySchemaPatches(async (sql) => {
    await db.prepare(sql).run();
  });
}
