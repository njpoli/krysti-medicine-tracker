import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudStore } from '../public/cloud.js';
function mock(responses) {
  const calls = [];
  const client = { from(table) {
    calls.push(['from', table]);
    const chain = {};
    for (const name of ['select','eq','single','order','range','insert','delete','update']) chain[name] = (...args) => { calls.push([name, ...args]); return chain; };
    chain.then = (resolve, reject) => Promise.resolve(responses.shift()).then(resolve, reject);
    return chain;
  } };
  return { client, calls };
}
test('cloud loader reads all history pages and normalizes timestamps', async () => {
  const row = { id: 'id', at: '2026-11-13T10:00:00+00:00' };
  const { client, calls } = mock([{ data: { start: null } }, { data: Array(500).fill(row) }, { data: [row] }]);
  const state = await createCloudStore(client).load();
  assert.equal(state.entries.length, 501);
  assert.equal(state.start, '');
  assert.equal(state.entries[0].at, '2026-11-13T10:00:00.000Z');
  assert.deepEqual(calls.filter(c => c[0] === 'range'), [['range', 0, 499], ['range', 500, 999]]);
});
test('cloud adapter rejects denied reads and no-op writes', async () => {
  const denied = mock([{ error: { message: 'Access denied' } }]);
  await assert.rejects(createCloudStore(denied.client).load(), /Access denied/);
  const noOp = mock([{ data: [] }]);
  await assert.rejects(createCloudStore(noOp.client).mutate('delete', { id: 'x' }), /No change saved/);
});
test('cloud inserts individual records instead of replacing history', async () => {
  const { client, calls } = mock([{ data: [{ id: 'new' }] }]);
  await createCloudStore(client).mutate('entry', { medicine: 'aspirin', dose: '1 tablet (325 mg)', at: new Date().toISOString(), note: '' });
  assert.equal(calls.find(c => c[0] === 'from')[1], 'dose_entries');
  assert.ok(calls.find(c => c[0] === 'insert')[1].id);
  assert.equal(calls.some(c => c[0] === 'update'), false);
});
