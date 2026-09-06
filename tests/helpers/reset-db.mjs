import fs from 'node:fs';
import path from 'node:path';
import { TEST_TMP } from './paths.mjs';

export function testPaths(runId = 'node') {
  const root = path.join(TEST_TMP, runId);
  return {
    root,
    db: path.join(root, 'local_d1.db'),
    kv: path.join(root, 'kv'),
  };
}

export function resetTestData(runId = 'node') {
  const { root, kv } = testPaths(runId);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(kv, { recursive: true });
  return testPaths(runId);
}
