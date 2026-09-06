import { spawn } from 'node:child_process';
import net from 'node:net';
import { REPO_ROOT, TEST_SECRET } from './paths.mjs';
import { resetTestData } from './reset-db.mjs';

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on('error', reject);
  });
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status) return;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Server did not start in time: ${lastErr?.message || 'timeout'}`);
}

export async function startTestServer({ runId = 'node' } = {}) {
  const paths = resetTestData(runId);
  const port = await getFreePort();
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
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (d) => {
    output += d.toString();
  });
  child.stderr.on('data', (d) => {
    output += d.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(baseUrl);
  } catch (e) {
    child.kill('SIGKILL');
    throw new Error(`${e.message}\n--- server output ---\n${output}`);
  }

  return {
    baseUrl,
    port,
    paths,
    child,
    async stop() {
      if (child.exitCode !== null) return;
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        const t = setTimeout(() => {
          child.kill('SIGKILL');
          resolve();
        }, 3000);
        child.once('exit', () => {
          clearTimeout(t);
          resolve();
        });
      });
    },
  };
}
