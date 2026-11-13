import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
test('shared server persists concurrent doses, rejects cross-origin writes and protects data files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'medicine-test-'));
  const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '0', DATA_DIR: directory }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timeout')), 10000);
      child.stdout.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
      child.on('error', reject);
    });
    const headers = { 'Content-Type': 'application/json', Origin: base };
    assert.match(await (await fetch(base)).text(), /name="shared-server"/);
    const entry = { medicine: 'aspirin', dose: '1 tablet (325 mg)', at: new Date().toISOString(), note: 'test' };
    const results = await Promise.all([1, 2].map(() => fetch(`${base}/api/state/entries`, { method: 'POST', headers, body: JSON.stringify(entry) })));
    assert.ok(results.every(r => r.status === 200));
    let state = await (await fetch(`${base}/api/state`)).json();
    assert.equal(state.entries.length, 2);
    assert.equal(JSON.parse(await readFile(join(directory, 'log.json'), 'utf8')).entries.length, 2);
    assert.equal((await fetch(`${base}/api/state/entries`, { method: 'POST', headers: { ...headers, Origin: 'https://example.com' }, body: JSON.stringify(entry) })).status, 403);
    assert.equal((await fetch(`${base}/data/log.json`)).status, 404);
    assert.equal((await fetch(`${base}/api/state`, { method: 'PATCH', headers, body: JSON.stringify({ start: '2026-02-30' }) })).status, 400);
    state = await (await fetch(`${base}/api/state/entries/${state.entries[0].id}`, { method: 'DELETE', headers })).json();
    assert.equal(state.entries.length, 1);
  } finally {
    const stopped = once(child, 'exit'); child.kill(); await stopped;
    await rm(directory, { recursive: true, force: true });
  }
});
