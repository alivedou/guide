import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it, before, after } from 'node:test';
import { startTestServer } from '../helpers/server.mjs';
import { runContractSuite, publicContract } from '../helpers/contract-run.mjs';
import { BASELINE_FILE } from '../helpers/paths.mjs';

function freezeForCompare(results) {
  const copy = JSON.parse(JSON.stringify(results));
  if (copy['A-10']) {
    const st = copy['A-10'].status;
    copy['A-10'] = {
      ok: st === 200 || st === 500,
      hasImage: st === 200 ? !!copy['A-10'].hasImage : false,
    };
  }
  return copy;
}

describe('baseline contract', () => {
  let srv;
  let actual;

  before(async () => {
    srv = await startTestServer({ runId: 'contract' });
    actual = publicContract(await runContractSuite(srv.baseUrl));
  });

  after(async () => {
    if (srv) await srv.stop();
  });

  it('has a committed snapshot (run npm run test:capture if missing)', () => {
    assert.ok(fs.existsSync(BASELINE_FILE), `missing ${BASELINE_FILE}`);
  });

  it('matches frozen snapshot (A-10 Bing network allowed 200 or 500)', () => {
    const snapshot = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    assert.deepEqual(freezeForCompare(actual), freezeForCompare(snapshot));
  });

  it('D-1 homepage 200 with shell', () => {
    assert.equal(actual['D-1'].status, 200);
    assert.equal(actual['D-1'].htmlHasShell, true);
  });

  it('A-1 guest config 200 with default categories', () => {
    assert.equal(actual['A-1'].status, 200);
    assert.equal(actual['A-1'].hasCategories, true);
    assert.ok(actual['A-1'].categoryNames.includes('社交'));
  });

  it('A-2 anonymous POST /api/config is 401', () => {
    assert.equal(actual['A-2'].status, 401);
  });

  it('A-3 empty login is 400 ERR_MISSING_USERNAME', () => {
    assert.equal(actual['A-3'].status, 400);
    assert.equal(actual['A-3'].code, 'ERR_MISSING_USERNAME');
  });

  it('A-4 first register becomes admin', () => {
    assert.equal(actual['A-4'].status, 200);
    assert.equal(actual['A-4'].role, 'admin');
  });

  it('A-5 login returns JWT', () => {
    assert.equal(actual['A-5'].status, 200);
    assert.equal(actual['A-5'].hasToken, true);
  });

  it('A-6 authed GET config 200', () => {
    assert.equal(actual['A-6'].status, 200);
    assert.equal(actual['A-6'].role, 'admin');
  });

  it('A-7 authed POST config persists a category', () => {
    assert.equal(actual['A-7'].status, 200);
    assert.equal(actual['A-7'].hasContractCategory, true);
    assert.equal(actual['A-7'].hasBookmark, true);
  });

  it('A-8 wrong password is 401', () => {
    assert.equal(actual['A-8'].status, 401);
  });

  it('A-11 announcements 200', () => {
    assert.equal(actual['A-11'].status, 200);
  });

  it('A-12 anonymous admin users is 403', () => {
    assert.equal(actual['A-12'].status, 403);
  });

  it('Q-1 normal user 13 categories is 403 and DB unchanged', () => {
    assert.equal(actual['Q-1'].registerRole, 'user');
    assert.equal(actual['Q-1'].overStatus, 403);
    assert.equal(actual['Q-1'].overCode, 'ERR_QUOTA_EXCEEDED');
    assert.equal(actual['Q-1'].unchanged, true);
  });

  it('I-1 export strips identity fields', () => {
    assert.equal(actual['I-1'].hasIdentity, false);
  });

  it('I-2 import remaps category and item ids', () => {
    assert.equal(actual['I-2'].catIdsChanged, true);
    assert.equal(actual['I-2'].itemIdsChanged, true);
    assert.equal(actual['I-2'].catCount, 2);
    assert.equal(actual['I-2'].itemCount, 2);
  });
});
