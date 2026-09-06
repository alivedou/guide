import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(__dirname, '../..');
export const TEST_TMP = path.join(REPO_ROOT, 'tests', '.tmp');
export const TEST_SECRET = 'cfnav-test-jwt-secret-do-not-use-in-prod';
export const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures');
export const BASELINE_FILE = path.join(FIXTURES, 'baseline', 'contract.json');
