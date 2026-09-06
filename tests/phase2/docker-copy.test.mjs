import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { REPO_ROOT } from '../helpers/paths.mjs';

describe('phase 2 docker copy', () => {
  it('P2-4 Dockerfile copies src/ and keeps server.js as CMD', () => {
    const docker = fs.readFileSync(path.join(REPO_ROOT, 'Dockerfile'), 'utf8');
    assert.match(docker, /COPY\s+src\/\s+\.\/src\//);
    assert.match(docker, /COPY\s+server\.js\s+\.\//);
    assert.match(docker, /COPY\s+nav-main\/\s+\.\/nav-main\//);
    assert.match(docker, /COPY\s+migrations\/\s+\.\/migrations\//);
    assert.match(docker, /CMD\s+\[\s*"node"\s*,\s*"server\.js"\s*\]/);
  });

  it('package.json main still points at server.js', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    assert.equal(pkg.main, 'server.js');
  });
});
