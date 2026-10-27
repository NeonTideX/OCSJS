import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const ignored = new Set(['.git', 'node_modules', 'dist', '.artifacts']);
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file); else files.push(file);
  }
}
await walk(root);
const failures = [];
for (const file of files) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (/\.(?:ts|js|mjs|json|css|md|ya?ml)$/u.test(file)) {
    const text = await readFile(file, 'utf8');
    if (/[\u3400-\u9FFF]/u.test(text)) failures.push(`${relative}: repository content must use English; escape non-English test data and platform tokens`);
    if (relative.startsWith('src/') && /(?:easy-us|docs\.ocsjs\.com|cdn\.ocsjs\.com|localhost:15319|ocs-script-actions|new\s+Function\s*\(|\beval\s*\()/u.test(text)) failures.push(`${relative}: upstream runtime coupling or executable configuration`);
  }
}
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (pkg.version !== '1.0.0') failures.push('package.json: keep the V1 version at 1.0.0');
if (pkg.dependencies && Object.keys(pkg.dependencies).length) failures.push('Runtime dependencies must remain empty');
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`Source audit passed: ${files.length} files, English repository, V1 metadata, independent runtime.`);
