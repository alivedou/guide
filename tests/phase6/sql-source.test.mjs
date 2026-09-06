import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { PATCH_SQL } from '../../nav-main/shared/schema-patch.js';
import { REPO_ROOT } from '../helpers/paths.mjs';
import { extractStatements, normalizeSql, parseCreateTables } from '../helpers/sql-parse.mjs';
import { renderSqlFiles } from '../scripts/generate-sql.mjs';

const INIT = fs.readFileSync(path.join(REPO_ROOT, 'migrations/0000_init.sql'), 'utf8');
const SCHEMA = fs.readFileSync(path.join(REPO_ROOT, 'sql/schema.sql'), 'utf8');
const UPGRADE = fs.readFileSync(path.join(REPO_ROOT, 'sql/schema.upgrade.sql'), 'utf8');

describe('phase 6 SQL single source (P6-1, P6-2)', () => {
  it('P6-1: CREATE table and column names match between 0000_init.sql and sql/schema.sql', () => {
    const fromInit = parseCreateTables(INIT);
    const fromSchema = parseCreateTables(SCHEMA);
    assert.deepEqual(Object.keys(fromSchema).sort(), Object.keys(fromInit).sort());
    for (const name of Object.keys(fromInit)) {
      assert.deepEqual(fromSchema[name], fromInit[name], `columns differ for ${name}`);
    }
  });

  it('P6-2: sql/schema.upgrade.sql statements match PATCH_SQL (whitespace ignored)', () => {
    const fromFile = extractStatements(UPGRADE).map(normalizeSql);
    const fromPatch = PATCH_SQL.map(normalizeSql);
    assert.deepEqual(fromFile, fromPatch);
  });

  it('sql/ files match npm run sql:generate output', () => {
    const rendered = renderSqlFiles();
    for (const [name, body] of Object.entries(rendered)) {
      const onDisk = fs.readFileSync(path.join(REPO_ROOT, 'sql', name), 'utf8');
      assert.equal(onDisk, body, `${name} is stale; run npm run sql:generate`);
    }
  });

  it('authority SQL never DROP users / categories / items', () => {
    const blob = [INIT, PATCH_SQL.join('\n'), SCHEMA, UPGRADE].join('\n');
    assert.doesNotMatch(blob, /DROP\s+TABLE\s+(IF\s+EXISTS\s+)?(users|categories|items)\b/i);
  });
});
