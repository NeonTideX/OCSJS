import { build, context } from 'esbuild';
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'dist');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (pkg.version !== '1.0.0') throw new Error('The V1 release version must stay 1.0.0');
const platformBundle = await build({ entryPoints: [path.join(root, 'src/platforms.ts')], bundle: true, write: false, platform: 'node', format: 'esm' });
const { PLATFORMS } = await import(`data:text/javascript;base64,${Buffer.from(platformBundle.outputFiles[0].contents).toString('base64')}`);
const hosts = [...new Set(PLATFORMS.flatMap(platform => platform.hosts))];
const css = await readFile(path.join(root, 'src/ui/style.css'), 'utf8');
const repo = 'https://github.com/NeonTideX/OCSJS';
const makeMetadata = common => [
  '// ==UserScript==',
  `// @name         OCSJS V1${common ? ' - Custom Providers' : ''}`,
  `// @namespace    ${repo}`,
  `// @version      ${pkg.version}`,
  '// @description  Independent course playback, document reading, question search and answer review.',
  '// @author       NeonTideX', '// @license      GPL-3.0-or-later',
  `// @homepageURL  ${repo}`, `// @supportURL   ${repo}/issues`,
  `// @downloadURL  ${repo}/releases/latest/download/ocs${common ? '.common' : ''}.user.js`,
  `// @updateURL    ${repo}/releases/latest/download/ocs${common ? '.common' : ''}.meta.js`,
  ...hosts.map(host => `// @match        *://*.${host}/*`),
  ...['GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_listValues', 'GM_xmlhttpRequest', 'GM_registerMenuCommand'].map(grant => `// @grant        ${grant}`),
  ...['self', 'localhost', '127.0.0.1', ...(common ? ['*'] : [])].map(host => `// @connect      ${host}`),
  '// @run-at       document-idle', '// ==/UserScript=='
].join('\n');
await mkdir(output, { recursive: true });
const writeArtifacts = async () => {
  const result = await build({
    entryPoints: [path.join(root, 'src/main.ts')], bundle: true, write: false, format: 'iife',
    platform: 'browser', target: ['es2022'], charset: 'ascii', legalComments: 'inline',
    define: { __VERSION__: JSON.stringify(pkg.version), __STYLE__: JSON.stringify(css) }, metafile: true
  });
  const code = result.outputFiles[0].text;
  const externals = Object.values(result.metafile.outputs).flatMap(item => item.imports).filter(item => item.external);
  if (externals.length) throw new Error('The userscript must bundle every runtime dependency');
  const files = [];
  for (const common of [false, true]) {
    const name = `ocs${common ? '.common' : ''}`;
    const metadata = makeMetadata(common);
    await writeFile(path.join(output, `${name}.user.js`), `${metadata}\n\n${code}`);
    await writeFile(path.join(output, `${name}.meta.js`), `${metadata}\n`);
    files.push(`${name}.user.js`, `${name}.meta.js`);
  }
  for (const file of ['LICENSE', 'THIRD_PARTY_LICENSES/OCSJS-MIT.txt', 'THIRD_PARTY_LICENSES/THIRD_PARTY_NOTICES.md']) {
    await copyFile(path.join(root, file), path.join(output, path.basename(file))); files.push(path.basename(file));
  }
  const sums = await Promise.all(files.sort().map(async file => `${createHash('sha256').update(await readFile(path.join(output, file))).digest('hex')}  ${file}`));
  await writeFile(path.join(output, 'SHA256SUMS'), `${sums.join('\n')}\n`);
  console.log(`Built OCSJS V1: ${Buffer.byteLength(code)} runtime bytes, ${hosts.length} domain patterns, no external runtime imports.`);
};
await writeArtifacts();
if (process.argv.includes('--watch')) {
  const watcher = await context({ entryPoints: [path.join(root, 'src/main.ts')], bundle: true, write: false,
    plugins: [{ name: 'userscript-output', setup(api) { api.onEnd(async result => { if (!result.errors.length) await writeArtifacts(); }); } }]
  });
  await watcher.watch();
  console.log('Watching TypeScript source. Restart the watcher after editing CSS or platform metadata.');
}
