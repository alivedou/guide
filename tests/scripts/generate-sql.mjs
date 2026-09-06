/**
 * Generate sql/ from the two authority sources:
 *   migrations/0000_init.sql  → schema.sql + schema.console.sql
 *   nav-main/shared/schema-patch.js PATCH_SQL → schema.upgrade.sql
 *
 * Docker never COPYs sql/. Do not DROP user tables here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATCH_SQL } from '../../nav-main/shared/schema-patch.js';
import { createStatementBodies } from '../helpers/sql-parse.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INIT = path.join(ROOT, 'migrations/0000_init.sql');
const SQL_DIR = path.join(ROOT, 'sql');

const SCHEMA_BANNER = `-- AUTO-GENERATED from migrations/0000_init.sql. Do not edit by hand.
-- Regenerate: npm run sql:generate
-- Runtime authority is migrations/0000_init.sql (copied into Docker).
-- This directory is documentation / Cloudflare console material only.
`;

const UPGRADE_BANNER = `-- AUTO-GENERATED from nav-main/shared/schema-patch.js PATCH_SQL. Do not edit by hand.
-- Regenerate: npm run sql:generate
-- Duplicate column / already exists errors can be ignored.
-- Docker does not package this file; Node/CF apply the same list at runtime.
`;

function withSemi(stmt) {
  const t = stmt.trim().replace(/;+\s*$/, '');
  return `${t};`;
}

export function renderSqlFiles() {
  const init = fs.readFileSync(INIT, 'utf8');
  const creates = createStatementBodies(init).map(withSemi);
  const schema = `${SCHEMA_BANNER}\n${creates.join('\n\n')}\n`;
  const consoleSql = `${SCHEMA_BANNER}-- Cloudflare D1 console: paste this file (or run each CREATE alone if the console rejects a batch).\n\n${creates.join('\n\n')}\n`;
  const upgrade = `${UPGRADE_BANNER}\n${PATCH_SQL.map(withSemi).join('\n\n')}\n`;
  return {
    'schema.sql': schema,
    'schema.console.sql': consoleSql,
    'schema.upgrade.sql': upgrade,
  };
}

export function writeSqlFiles() {
  fs.mkdirSync(SQL_DIR, { recursive: true });
  const files = renderSqlFiles();
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(SQL_DIR, name), body);
  }
  return Object.keys(files);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const names = writeSqlFiles();
  console.log('wrote', names.join(', '));
}
