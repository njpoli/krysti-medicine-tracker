import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'public');
const files = (await readdir(source)).sort();
const contents = new Map(await Promise.all(files.map(async name => [name, await readFile(join(source, name))])));
const hash = createHash('sha256');
for (const [name, data] of contents) hash.update(name).update(data);
const version = hash.digest('hex').slice(0, 16);
const directory = join(root, 'dist', 'assets', version);
await mkdir(directory, { recursive: true });
for (const [name, data] of contents) {
  if (name !== 'index.html') await writeFile(join(directory, name), data);
}
// All relative ES module imports now resolve inside the same versioned directory.
const html = contents.get('index.html').toString()
  .replace('href="./style.css"', `href="./assets/${version}/style.css"`)
  .replace('src="./app.js"', `src="./assets/${version}/app.js"`);
await writeFile(join(root, 'dist', 'index.html'), html);
console.log(`Built Pages assets: ${version}`);
