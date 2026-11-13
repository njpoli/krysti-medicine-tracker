import { medicines, recoveryDay, statusFor, validateEntry } from './medicine.js';
import { config } from './config.js';
import { createCloudStore } from './cloud.js';
let cloud, client, signedIn = false, generation = 0, refreshing = false;
let activeUserId, lastSynced = 0;
const $ = id => document.getElementById(id);
const key = 'krysti-medicines-v1';
let state = { start: '', entries: [] }, shared = false, selected, busy = false, ready = false;
const dateTime = value => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function notice(message = '') { $('notice').textContent = message; $('notice').hidden = !message; }
for (let hour = 1; hour <= 12; hour++) $('taken-hour').add(new Option(String(hour), String(hour)));
for (let minute = 0; minute < 60; minute++) $('taken-minute').add(new Option(String(minute).padStart(2, '0'), String(minute)));
function selectedTime() {
  if (!$('taken-date').value) return new Date(NaN);
  const hour = Number($('taken-hour').value) % 12 + ($('taken-period').value === 'PM' ? 12 : 0);
  return new Date(`${$('taken-date').value}T${String(hour).padStart(2, '0')}:${String($('taken-minute').value).padStart(2, '0')}:00`);
}
function previewTime() {
  const at = selectedTime();
  $('time-preview').textContent = Number.isFinite(at.getTime())
    ? `Recording ${at.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`
    : 'Choose a date and time.';
}
function selectTimeShortcut(minutes = null) {
  document.querySelectorAll('[data-minutes]').forEach(button => {
    button.setAttribute('aria-pressed', String(minutes !== null && button.dataset.minutes === String(minutes)));
  });
}
function setTakenTime(date, shortcut = 0) {
  const localDate = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  $('taken-date').max = localDate(new Date());
  $('taken-date').value = localDate(date);
  $('taken-hour').value = String(date.getHours() % 12 || 12);
  $('taken-minute').value = String(date.getMinutes());
  $('taken-period').value = date.getHours() >= 12 ? 'PM' : 'AM';
  selectTimeShortcut(shortcut);
  previewTime();
}
$('time-shortcuts').onclick = event => {
  const button = event.target.closest('[data-minutes]');
  if (button) setTakenTime(new Date(Date.now() - Number(button.dataset.minutes) * 60000), Number(button.dataset.minutes));
};
for (const id of ['taken-date', 'taken-hour', 'taken-minute', 'taken-period']) $(id).addEventListener('input', () => { selectTimeShortcut(); previewTime(); });
async function api(path = '', method = 'GET', body) {
  const response = await fetch(`./api/state${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Could not reach shared storage. No change was saved. Please retry.');
  return response.json();
}
function render() {
  $('day').textContent = recoveryDay(state.start) > 0 ? recoveryDay(state.start) : '—';
  if (document.activeElement !== $('start')) $('start').value = state.start;
  $('medicines').innerHTML = medicines.map(m => {
    const status = statusFor(m, state.entries, state.start);
    return `<article class="medicine"><p class="kind">${m.kind}${m.days ? ' · first 3 days' : ''}</p><h2>${m.name}</h2><p class="dose">${m.dose}</p><span class="last-label">Last recorded dose</span><div class="last-time">${status.last ? dateTime(status.last.at) : 'Not logged yet'}</div><div class="status ${status.tone}">${escape(status.label)}</div><button data-log="${m.id}">+ Log dose</button></article>`;
  }).join('');
  const entries = state.entries.filter(e => $('filter').value === 'all' || e.medicine === $('filter').value).sort((a, b) => b.at.localeCompare(a.at));
  $('history').innerHTML = entries.length ? entries.map(e => `<article class="entry"><time datetime="${escape(e.at)}">${dateTime(e.at)}</time><div class="details"><strong>${escape(medicines.find(m => m.id === e.medicine)?.name || e.medicine)}</strong><p>${escape(e.dose)}</p>${e.note ? `<p>${escape(e.note)}</p>` : ''}</div><button class="secondary" data-delete="${escape(e.id)}" aria-label="Remove ${escape(e.medicine)} dose at ${escape(dateTime(e.at))}">Remove</button></article>`).join('') : '<p class="empty">A fresh start.<br>Your recorded doses will appear here.</p>';
}
async function mutate(action, payload) {
  if (!ready) throw new Error('The log has not loaded. Reload before saving changes.');
  if (refreshing) throw new Error('The shared log is refreshing. Please try again in a moment.');
  if (busy) throw new Error('A save is already in progress. Please wait.');
  busy = true;
  try {
    if (cloud) {
      const current = generation;
      await cloud.mutate(action, payload);
      // A successful write must not be presented as a failed save if the following read fails.
      if (current !== generation) return;
      if (action === 'entry') $('dose-dialog').close();
      try { const next = await cloud.load(); if (current === generation) state = next; }
      catch { notice('Change saved, but the updated log could not load. Refresh before recording another dose.'); ready = false; return; }
      if (current !== generation) return;
    }
    else if (shared) state = await api(action === 'entry' ? '/entries' : action === 'delete' ? `/entries/${payload.id}` : '', action === 'delete' ? 'DELETE' : action === 'entry' ? 'POST' : 'PATCH', payload);
    else {
      const next = JSON.parse(localStorage.getItem(key) || JSON.stringify(state));
      if (action === 'entry') next.entries.push({ ...payload, id: crypto.randomUUID() });
      if (action === 'delete') next.entries = next.entries.filter(e => e.id !== payload.id);
      if (action === 'settings') next.start = payload.start;
      localStorage.setItem(key, JSON.stringify(next));
      state = next;
    }
    notice(); render();
  } finally { busy = false; }
}
function openDose(id) {
  if (!ready) return notice('The log has not loaded. Reload before recording a dose.');
  selected = medicines.find(m => m.id === id);
  $('dose-form').reset();
  $('dialog-title').textContent = `Log ${selected.name}`;
  $('instructions').textContent = selected.instructions;
  if (selected.source) {
    const link = document.createElement('a');
    link.href = selected.source; link.textContent = ' Official product label';
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    $('instructions').append(link);
  }
  const status = statusFor(selected, state.entries, state.start);
  $('dose-warning').textContent = status.tone === 'waiting' ? `The recorded ${selected.hours}-hour interval has not elapsed. Check the time and discharge instructions before recording another dose.` : status.tone === 'ended' ? 'The initial course has ended. Only record doses actually taken; check any continued use with the care team.' : !state.start ? 'Set your day-1 date to track the initial course.' : '';
  if (status.last && !selected.hours && new Date(status.last.at).toDateString() === new Date().toDateString()) $('dose-warning').textContent = 'A dose of this medicine is already recorded today. Check the log before adding another.';
  $('dose').innerHTML = selected.doses.map(d => `<option>${d}</option>`).join('');
  setTakenTime(new Date());
  $('form-error').textContent = '';
  $('dose-dialog').showModal();
}
$('medicines').addEventListener('click', e => { const button = e.target.closest('[data-log]'); if (button) openDose(button.dataset.log); });
$('close').onclick = () => $('dose-dialog').close();
$('filter').onchange = render;
$('settings').onsubmit = async e => {
  e.preventDefault();
  if (recoveryDay($('start').value) < 1) return notice('Day 1 cannot be in the future.');
  try { await mutate('settings', { start: $('start').value }); } catch (error) { notice(error.message); }
};
$('dose-form').onsubmit = async e => {
  e.preventDefault();
  const at = selectedTime();
  const entry = { medicine: selected.id, dose: $('dose').value, at: Number.isFinite(at.getTime()) ? at.toISOString() : '', note: $('note').value.trim() };
  if (!validateEntry(entry)) { $('form-error').textContent = 'Enter a valid dose and time that is not in the future.'; return; }
  $('save-dose').disabled = true;
  try { await mutate('entry', entry); $('dose-dialog').close(); } catch (error) { $('form-error').textContent = error.message; } finally { $('save-dose').disabled = false; }
};
$('history').onclick = async e => {
  const button = e.target.closest('[data-delete]');
  if (!button || !confirm('Remove this dose from the log? This will also update the last-dose time.')) return;
  try { await mutate('delete', { id: button.dataset.delete }); } catch (error) { notice(error.message); }
};
$('export').onclick = () => {
  if (!ready) return notice('The log has not loaded. Reload before exporting.');
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `medicine-log-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('filter').insertAdjacentHTML('beforeend', medicines.map(m => `<option value="${m.id}">${m.name}</option>`).join(''));
async function refreshCloud() {
  if (refreshing || busy || !signedIn) return;
  if (ready && Date.now() - lastSynced < 15000) return;
  refreshing = true;
  const current = generation;
  try {
    const next = await cloud.load();
    if (current !== generation) return;
    state = next; ready = true; lastSynced = Date.now(); $('tracker-content').hidden = false;
    $('connection').textContent = '● Supabase · connected'; notice(); render();
  } catch (error) {
    if (current !== generation) return;
    ready = false; $('connection').textContent = '● Supabase · not synced';
    notice(`Cannot load shared log. Check connection and account membership. ${error.message}`);
  } finally {
    refreshing = false;
    if (current !== generation && signedIn) setTimeout(refreshCloud, 0);
  }
}
function sessionChanged(session) {
  const userId = session?.user?.id || null;
  // Supabase can confirm the same session again when a tab regains focus.
  // Only a change of identity should clear data or close an open dose form.
  if (activeUserId === userId) return;
  activeUserId = userId; lastSynced = 0;
  generation++; signedIn = Boolean(session); ready = false;
  state = { start: '', entries: [] }; render();
  $('dose-dialog').close(); $('tracker-content').hidden = true;
  $('auth-panel').hidden = signedIn; $('logout').hidden = !signedIn;
  $('connection').textContent = signedIn ? '● Supabase · loading' : '● Signed out';
  notice();
  if (signedIn) setTimeout(refreshCloud, 0);
}
if (config.mode === 'supabase') {
  $('connection').textContent = '● Supabase setup';
  $('storage').textContent = 'Shared log stored in Supabase. Your sign-in session is remembered on this browser.';
  try {
    if (!config.supabaseUrl || !config.supabasePublishableKey) throw new Error('Add your Supabase project URL and publishable key to public/config.js. Follow the README setup steps.');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl)) throw new Error('Use your https://PROJECT.supabase.co project URL.');
    if (config.supabasePublishableKey.startsWith('sb_secret_')) throw new Error('Use a publishable key, never a secret key.');
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm');
    client = createClient(config.supabaseUrl, config.supabasePublishableKey);
    cloud = createCloudStore(client);
    client.auth.onAuthStateChange((event, session) => { if (event !== 'TOKEN_REFRESHED') sessionChanged(session); });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    sessionChanged(data.session);
  } catch (error) { notice(error.message); }
  $('login-form').onsubmit = async event => {
    event.preventDefault(); $('login-button').disabled = true; $('auth-error').textContent = '';
    try {
      const { error } = await client.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
      if (error) throw error;
      $('password').value = '';
    } catch (error) { $('auth-error').textContent = error.message; }
    finally { $('login-button').disabled = false; }
  };
  $('logout').onclick = async () => {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) notice(`Could not sign out: ${error.message}`);
    else sessionChanged(null);
  };
  setInterval(() => { if (!document.hidden) refreshCloud(); }, 15000);
  window.addEventListener('focus', () => setTimeout(refreshCloud, 0));
} else if (['local-server', 'browser'].includes(config.mode)) {
shared = config.mode === 'local-server';
$('tracker-content').hidden = false;
$('connection').textContent = shared ? '● Shared server' : '● This browser only';
$('storage').textContent = shared ? 'Saved on your server. Refreshes every 5 seconds.' : 'Saved in this browser only. Other phones have separate logs. Export before clearing browser data.';
try {
  state = shared ? await api() : JSON.parse(localStorage.getItem(key) || JSON.stringify(state));
  if (!Array.isArray(state.entries)) throw new Error('Stored log is unreadable.');
  ready = true;
} catch (error) { notice(`Unable to load the log: ${error.message}`); document.querySelectorAll('button').forEach(b => b.disabled = true); }
render();
setInterval(async () => {
  if (busy || !shared) { if (!shared) render(); return; }
  try { state = await api(); ready = true; document.querySelectorAll('button').forEach(b => b.disabled = false); $('connection').textContent = '● Shared server · connected'; render(); }
  catch { $('connection').textContent = '● Disconnected · log may be stale'; }
}, 5000);
window.addEventListener('storage', e => { if (!shared && e.key === key) { try { state = JSON.parse(e.newValue); render(); } catch { notice('Browser storage changed unexpectedly. Reload to reconnect.'); } } });
} else notice('Unknown storage mode. Check public/config.js.');
