import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { REPO_ROOT } from '../helpers/paths.mjs';

describe('phase 6 docker does not copy sql/ (P6-4)', () => {
  it('P6-4: Dockerfile copies migrations/ and must not COPY sql/', () => {
    const docker = fs.readFileSync(path.join(REPO_ROOT, 'Dockerfile'), 'utf8');
    assert.match(docker, /COPY\s+migrations\/\s+\.\/migrations\//);
    assert.doesNotMatch(docker, /COPY\s+sql\//);
  });
});
