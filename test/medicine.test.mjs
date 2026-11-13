import test from 'node:test';
import assert from 'node:assert/strict';
import { medicines, recoveryDay, statusFor, validateEntry } from '../public/medicine.js';
test('MiraLAX does not invent a prescribed interval and accepts actual logged dose', () => {
  const med = medicines.find(m => m.id === 'miralax');
  const entry = { medicine: med.id, dose: '17 g', at: new Date().toISOString(), note: '' };
  assert.equal(validateEntry(entry), true);
  assert.equal(validateEntry({ ...entry, dose: 'Dosage unknown' }), true);
  const status = statusFor(med, [entry], '2026-11-12');
  assert.equal(status.next, undefined);
  assert.match(status.label, /Confirm dose/);
});
test('calendar recovery days and three-day course cutoff', () => {
  assert.equal(recoveryDay('2026-11-12', new Date(2026, 10, 13, 1)), 2);
  assert.equal(recoveryDay('', new Date()), null);
  const med = medicines.find(m => m.id === 'ibuprofen');
  assert.equal(statusFor(med, [], '2026-11-12', new Date(2026, 10, 15)).tone, 'ended');
  assert.notEqual(statusFor(med, [], '2026-11-12', new Date(2026, 10, 14)).tone, 'ended');
});
test('latest actual dose anchors interval regardless of insertion order', () => {
  const med = medicines.find(m => m.id === 'tylenol');
  const entries = ['2026-11-13T12:00:00.000Z', '2026-11-13T06:00:00.000Z'].map(at => ({ medicine: med.id, at }));
  const status = statusFor(med, entries, '2026-11-12', new Date('2026-11-13T15:00:00Z'));
  assert.equal(status.next.toISOString(), '2026-11-13T18:00:00.000Z');
  assert.equal(status.tone, 'waiting');
  assert.equal(statusFor(med, entries, '2026-11-12', new Date('2026-11-13T18:00:00Z')).tone, 'elapsed');
});
test('reject invalid doses and future timestamps', () => {
  const entry = { medicine: 'aspirin', dose: '1 tablet (325 mg)', at: new Date().toISOString(), note: '' };
  assert.equal(validateEntry(entry), true);
  assert.equal(validateEntry({ ...entry, dose: '2 tablets' }), false);
  assert.equal(validateEntry({ ...entry, at: new Date(Date.now() + 3600000).toISOString() }), false);
});
