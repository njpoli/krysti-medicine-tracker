import test from 'node:test';
import assert from 'node:assert/strict';
import { historyPage, localDay } from '../public/history.js';
const entry = (day, hour, medicine = 'tylenol') => ({ medicine, at: new Date(2026, 10, day, hour).toISOString() });
test('history pages use local calendar days, newest first, and preserve selected days', () => {
  const entries = [entry(15, 23), entry(16, 0), entry(16, 12), entry(14, 9)];
  const page = historyPage(entries);
  assert.equal(page.day, '2026-11-16');
  assert.equal(page.entries.length, 2);
  assert.equal(page.entries[0].at, entries[2].at);
  assert.equal(localDay(entries[0].at), '2026-11-15');
  assert.equal(historyPage([...entries, entry(17, 8)], 'all', '2026-11-15').day, '2026-11-15');
  assert.equal(entries[0].at, entry(15, 23).at);
});
test('filtering, deleted days, and empty history have valid pages', () => {
  const entries = [entry(16, 9), entry(15, 9, 'ibuprofen'), entry(14, 9)];
  assert.deepEqual(historyPage(entries, 'ibuprofen').days, ['2026-11-15']);
  assert.equal(historyPage(entries, 'tylenol', '2026-11-15').day, '2026-11-14');
  assert.equal(historyPage([], 'all').day, null);
  assert.equal(historyPage(entries, 'zofran').entries.length, 0);
});
