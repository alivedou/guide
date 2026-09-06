import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { REPO_ROOT } from '../helpers/paths.mjs';
import { PATCH_SQL } from '../../nav-main/shared/schema-patch.js';

function walkJs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.tmp' || name === '.git' || name === '.wrangler') continue;
      walkJs(full, acc);
    } else if (name.endsWith('.js') || name.endsWith('.mjs')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('phase 1 single source', () => {
  it('QUOTA_CONFIG is only defined in nav-main/shared/quota.js', () => {
    const hits = [];
    for (const file of walkJs(REPO_ROOT)) {
      const rel = path.relative(REPO_ROOT, file);
      if (rel.startsWith('tests/')) continue;
      const src = fs.readFileSync(file, 'utf8');
      if (/QUOTA_CONFIG\s*=/.test(src)) hits.push(rel);
    }
    assert.deepEqual(hits, ['nav-main/shared/quota.js']);
  });

  it('PATCH_SQL is only defined in nav-main/shared/schema-patch.js', () => {
    const hits = [];
    for (const file of walkJs(REPO_ROOT)) {
      const rel = path.relative(REPO_ROOT, file);
      if (rel.startsWith('tests/')) continue;
      const src = fs.readFileSync(file, 'utf8');
      if (/PATCH_SQL\s*=/.test(src)) hits.push(rel);
    }
    assert.deepEqual(hits, ['nav-main/shared/schema-patch.js']);
  });

  it('Node and CF adapters import applySchemaPatches from shared', () => {
    const nodeFiles = [
      path.join(REPO_ROOT, 'server.js'),
      ...walkJs(path.join(REPO_ROOT, 'src/server')),
    ].filter((p) => fs.existsSync(p));
    const nodeHit = nodeFiles.some((file) =>
      /from ['"].*nav-main\/shared\/schema-patch\.js['"]/.test(fs.readFileSync(file, 'utf8'))
    );
    assert.equal(nodeHit, true, 'Node runtime must import shared/schema-patch.js');
    const patch = fs.readFileSync(
      path.join(REPO_ROOT, 'nav-main/functions/api/_d1_schema_patch.js'),
      'utf8'
    );
    assert.match(patch, /from '\.\.\/\.\.\/shared\/schema-patch\.js'/);
    assert.ok(PATCH_SQL.length > 10);
  });

  it('shared modules do not import Node or Worker runtimes', () => {
    const forbidden = [
      'better-sqlite3',
      'express',
      'node:fs',
      'node:path',
      "from 'fs'",
      'from "fs"',
      "from 'path'",
      'from "path"',
    ];
    const dir = path.join(REPO_ROOT, 'nav-main/shared');
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.js')) continue;
      const src = fs.readFileSync(path.join(dir, name), 'utf8');
      for (const token of forbidden) {
        assert.equal(
          src.includes(token),
          false,
          `${name} must not import ${token}`
        );
      }
    }
  });
});
