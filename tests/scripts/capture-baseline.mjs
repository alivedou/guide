import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from '../helpers/server.mjs';
import { runContractSuite, publicContract } from '../helpers/contract-run.mjs';
import { BASELINE_FILE } from '../helpers/paths.mjs';

const srv = await startTestServer({ runId: 'capture' });
try {
  const results = publicContract(await runContractSuite(srv.baseUrl));
  fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Wrote ${BASELINE_FILE}`);
  console.log(JSON.stringify(results, null, 2));
} finally {
  await srv.stop();
}
