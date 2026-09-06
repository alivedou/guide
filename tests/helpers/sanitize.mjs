import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { REPO_ROOT } from './paths.mjs';

export function loadSanitize() {
  const file = path.join(REPO_ROOT, 'nav-main/public/assets/js/import-export-sanitize.js');
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = {
    window: {},
    Math,
    Date,
  };
  vm.runInNewContext(code, sandbox, { filename: 'import-export-sanitize.js' });
  if (!sandbox.window.ImportExportSanitize) {
    throw new Error('ImportExportSanitize was not attached to window');
  }
  return sandbox.window.ImportExportSanitize;
}
