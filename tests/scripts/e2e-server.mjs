import { spawn } from 'node:child_process';
import { REPO_ROOT, TEST_SECRET } from '../helpers/paths.mjs';
import { resetTestData } from '../helpers/reset-db.mjs';

const port = process.env.PORT || '43158';
const paths = resetTestData('e2e');

const child = spawn(process.execPath, ['server.js'], {
  cwd: REPO_ROOT,
  env: {
    ...process.env,
    PORT: String(port),
    DB_PATH: paths.db,
    KV_DIR: paths.kv,
    JWT_SECRET: TEST_SECRET,
    NODE_ENV: 'test',
    DEBUG_MODE: 'false',
  },
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 1));
