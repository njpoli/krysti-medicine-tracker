import http from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateEntry } from './public/medicine.js';
const root = fileURLToPath(new URL('.', import.meta.url));
const dataDir = process.env.DATA_DIR || join(root, 'data');
mkdirSync(dataDir, { recursive: true });
const file = join(dataDir, 'log.json');
let state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { start: '', entries: [] };
function save(next) {
  writeFileSync(`${file}.tmp`, JSON.stringify(next, null, 2));
  renameSync(`${file}.tmp`, file);
  state = next;
}
const assets = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/medicine.js': ['medicine.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
assets['/config.js'] = ['config.js', 'text/javascript'];
assets['/cloud.js'] = ['cloud.js', 'text/javascript'];
assets['/history.js'] = ['history.js', 'text/javascript'];
const server = http.createServer(async (req, res) => {
  const reply = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.startsWith('/api/')) {
      if (req.method === 'GET' && path === '/api/state') return reply(200, state);
      if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) return reply(405, { error: 'Method not allowed' });
      // Browser mutations must originate from the same host, including through Tailscale Serve.
      if (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host || !req.headers['content-type']?.startsWith('application/json')) return reply(403, { error: 'Same-origin JSON required' });
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 8192) return reply(413, { error: 'Request too large' }); }
      const body = JSON.parse(raw || '{}');
      if (req.method === 'POST' && path === '/api/state/entries') {
        if (!validateEntry(body)) return reply(400, { error: 'Invalid dose' });
        const entry = { id: randomUUID(), medicine: body.medicine, dose: body.dose, at: new Date(body.at).toISOString(), note: body.note };
        save({ ...state, entries: [...state.entries, entry] });
      } else if (req.method === 'PATCH' && path === '/api/state') {
        if (typeof body.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.start) || !Number.isFinite(Date.parse(body.start)) || new Date(body.start).toISOString().slice(0, 10) !== body.start) return reply(400, { error: 'Invalid date' });
        save({ ...state, start: body.start });
      } else if (req.method === 'DELETE' && /^\/api\/state\/entries\/[a-f0-9-]+$/.test(path)) {
        save({ ...state, entries: state.entries.filter(e => e.id !== path.split('/').pop()) });
      } else return reply(404, { error: 'Not found' });
      return reply(200, state);
    }
    if (req.method !== 'GET' || !assets[path]) return reply(404, { error: 'Not found' });
    const [name, type] = assets[path];
    let content = readFileSync(join(root, 'public', name), 'utf8');
    if (name === 'index.html') content = content.replace('<head>', '<head><meta name="shared-server" content="true">');
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
    res.end(content);
  } catch (error) { console.error(error.message); reply(500, { error: 'Unable to complete request' }); }
});
server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`Medicine tracker: http://127.0.0.1:${server.address().port}`));
