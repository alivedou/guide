import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import Database from 'better-sqlite3';
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

async function waitForServer(url, timeoutMs = 40000) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status) return;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Wrangler did not start: ${lastErr?.message || 'timeout'}`);
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function applyInitToLocalD1(persistDir) {
  const initSql = fs.readFileSync(path.join(REPO_ROOT, 'migrations', '0000_init.sql'), 'utf8');
  const files = walkFiles(persistDir).filter(
    (f) => f.includes(`${path.sep}d1${path.sep}`) && f.endsWith('.sqlite') && !f.endsWith('metadata.sqlite')
  );
  let patched = 0;
  for (const file of files) {
    try {
      const db = new Database(file);
      const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
      if (!row) {
        db.exec(initSql);
        patched += 1;
      }
      db.close();
    } catch {
      /* not a D1 db */
    }
  }
  return { files: files.length, patched };
}

export async function startWranglerPreview({ runId = 'cf' } = {}) {
  const paths = resetTestData(`wrangler-${runId}`);
  const persistDir = path.join(paths.root, 'persist');
  fs.mkdirSync(persistDir, { recursive: true });
  const port = await getFreePort();
  const inspectorPort = await getFreePort();

  const child = spawn(
    'npx',
    [
      'wrangler',
      'pages',
      'dev',
      'public',
      '--kv=nav',
      '--d1=DB',
      '--compatibility-date=2024-05-28',
      '--compatibility-flag',
      'nodejs_compat',
      '--persist-to',
      persistDir,
      '--port',
      String(port),
      '--ip',
      '127.0.0.1',
      '--inspector-port',
      String(inspectorPort),
      '--binding',
      `JWT_SECRET=${TEST_SECRET}`,
      '--show-interactive-dev-session',
      'false'
    ],
    {
      cwd: path.join(REPO_ROOT, 'nav-main'),
      env: {
        ...process.env,
        JWT_SECRET: TEST_SECRET,
        WRANGLER_SEND_METRICS: 'false',
        CI: 'true'
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    }
  );

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
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '_schema_touch', password: 'touch-pass-1' })
    }).catch(() => {});
    const start = Date.now();
    while (Date.now() - start < 12000) {
      const r = applyInitToLocalD1(persistDir);
      if (r.files > 0) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    applyInitToLocalD1(persistDir);
  } catch (e) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
    throw new Error(`${e.message}\n--- wrangler output ---\n${output}`);
  }

  return {
    baseUrl,
    port,
    persistDir,
    paths,
    child,
    output: () => output,
    async stop() {
      if (child.exitCode !== null) return;
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
      await new Promise((resolve) => {
        const t = setTimeout(() => {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            child.kill('SIGKILL');
          }
          resolve();
        }, 2500);
        child.once('exit', () => {
          clearTimeout(t);
          resolve();
        });
      });
    }
  };
}
