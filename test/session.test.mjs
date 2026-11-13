import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual UI session handler without a real account or patient data.
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const handler = app.slice(app.indexOf('function sessionChanged(session)'), app.indexOf("if (config.mode === 'supabase')"));
test('same-user auth events preserve loaded history and the open form; sign-out clears both', () => {
  const elements = new Map();
  let closes = 0;
  const context = vm.createContext({
    activeUserId: 'user-a', lastSynced: 123, generation: 1, signedIn: true, ready: true,
    state: { entries: [{ id: 'existing' }] },
    $: id => {
      if (!elements.has(id)) elements.set(id, { hidden: false, close: () => closes++ });
      return elements.get(id);
    }, render() {}, notice() {}, refreshCloud() {}, setTimeout() {}
  });
  vm.runInContext(handler, context);
  vm.runInContext("sessionChanged({user: {id: 'user-a'}})", context);
  assert.equal(context.state.entries[0].id, 'existing');
  assert.equal(context.ready, true);
  assert.equal(context.generation, 1);
  assert.equal(closes, 0);
  vm.runInContext('sessionChanged(null)', context);
  assert.equal(context.state.entries.length, 0);
  assert.equal(context.ready, false);
  assert.equal(elements.get('tracker-content').hidden, true);
  assert.equal(closes, 1);
});
