import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { readFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const script = await readFile(path.join(root, 'dist/ocs.common.user.js'), 'utf8');
const artifactDir = path.join(root, '.artifacts');
await mkdir(artifactDir, { recursive: true });
let executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
if (!executablePath && process.platform === 'win32') {
  for (const candidate of ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']) {
    try { await access(candidate); executablePath = candidate; break; } catch { /* Try the next installed browser. */ }
  }
}
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
let passed = 0;
const checks = [];
const test = async (name, run) => {
  if (process.env.BROWSER_TEST_FILTER && !name.includes(process.env.BROWSER_TEST_FILTER)) return;
  await run(); passed++; checks.push(name); console.log(`PASS ${name}`);
};
const fixtures = [
  ['Chaoxing', 'course.chaoxing.com', 'questionLi', 'mark_name', 'answerBg', 'li'],
  ['Zhihuishu', 'study.zhihuishu.com', 'examPaper_subject', 'subject_describe', 'subject_node', 'label'],
  ['ICVE', 'ai.icve.com.cn', 'q_content', 'divQuestionTitle', 'questionOptions', 'label'],
  ['ZJY', 'zjy2.icve.com.cn', 'subjectDet', 'titleTest', 'optionList', 'div'],
  ['iCourse', 'www.icourse163.org', 'u-questionItem', 'j-title', 'choices', 'li'],
  ['Yuketang', 'www.yuketang.cn', 'subject-item', 'problem-body', 'list-unstyled', 'label']
];
const questionMarkup = (fixture, type = 'single', title = 'Choose Two', selected = false) => {
  const [, , rootClass, titleClass, optionClass, optionTag] = fixture;
  let heading = title;
  if (titleClass === 'subject_describe') heading = `<div>${title}</div>`;
  if (titleClass === 'titleTest') heading = `<span>${title}</span>`;
  if (titleClass === 'j-title') heading = `<span class="j-richTxt">${title}</span>`;
  const option = (word, index) => {
    const classes = [optionClass === 'subject_node' ? 'nodeLab' : '', optionClass === 'questionOptions' ? 'q_option' : ''].filter(Boolean).join(' ');
    const inner = `<input type="${type === 'multiple' ? 'checkbox' : 'radio'}" name="answer" value="${word}" ${selected && index === 0 ? 'checked' : ''}>${word}`;
    if (optionTag === 'label' && optionClass === 'list-unstyled') return `<li><label>${inner}</label></li>`;
    return `<${optionTag} class="${classes}">${inner}</${optionTag}>`;
  };
  return `<div class="${rootClass}" data-type="${type}"><div class="${titleClass}">${heading}</div><ul class="${optionClass}">${['One', 'Two', 'Three'].map(option).join('')}</ul></div>`;
};

async function pageFor({ host = 'course.chaoxing.com', markup = questionMarkup(fixtures[0]), settings = {}, gmResponse, gmDelay = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><head><title>Course fixture</title></head><body><h1>Course fixture</h1>${markup}</body></html>` }));
  await page.addInitScript(({ settings, gmResponse, gmDelay }) => {
    const values = new Map([['ocsjs.v1.settings', settings]]);
    window.GM_getValue = key => values.get(key);
    window.GM_setValue = (key, value) => values.set(key, value);
    window.GM_listValues = () => [...values.keys()];
    window.GM_deleteValue = key => values.delete(key);
    window.GM_registerMenuCommand = () => {};
    window.__requests = 0; window.__aborts = 0;
    window.GM_xmlhttpRequest = details => {
      window.__requests++;
      const timer = setTimeout(() => details.onload({ status: 200, responseText: JSON.stringify(gmResponse ?? { answer: 'B' }), finalUrl: details.url }), gmDelay);
      return { abort() { window.__aborts++; clearTimeout(timer); details.onabort(); } };
    };
  }, { settings: { schema: 1, bank: [{ question: 'Choose Two', answer: 'Two', source: 'Fixture bank' }], ...settings }, gmResponse, gmDelay });
  await page.goto(`https://${host}/course`);
  await page.addScriptTag({ content: script });
  await page.locator('#ocsjs-panel').waitFor();
  return { page, context, errors };
}
async function results(page) {
  await page.getByRole('button', { name: 'Exercises', exact: true }).click();
  await page.getByRole('button', { name: 'Start exercises', exact: true }).click();
  await page.getByRole('button', { name: 'Apply answer', exact: true }).first().waitFor();
}

try {
  for (const fixture of fixtures) await test(`${fixture[0]} adapter extracts and applies a native answer`, async () => {
    const { page, context, errors } = await pageFor({ host: fixture[1], markup: questionMarkup(fixture) });
    try {
      await results(page);
      assert.equal(await page.locator('input:checked').count(), 0, 'Default mode must require review');
      await page.getByRole('button', { name: 'Apply answer', exact: true }).click();
      assert.equal(await page.locator('input:checked').inputValue(), 'Two');
      assert.deepEqual(errors, []);
      if (fixture[0] === 'Chaoxing') await page.screenshot({ path: path.join(artifactDir, 'exercises.png') });
    } finally { await context.close(); }
  });
  await test('Multiple-choice application clears an obsolete selection', async () => {
    const { page, context } = await pageFor({ markup: questionMarkup(fixtures[0], 'multiple', 'Choose Two', true) });
    try { await results(page); await page.getByRole('button', { name: 'Apply answer', exact: true }).click(); assert.deepEqual(await page.locator('input:checked').evaluateAll(nodes => nodes.map(n => n.value)), ['Two']); }
    finally { await context.close(); }
  });
  await test('Stale results cannot modify a changed question', async () => {
    const { page, context } = await pageFor();
    try {
      await results(page); await page.locator('.mark_name').evaluate(node => { node.textContent = 'A different question'; });
      await page.getByRole('button', { name: 'Apply answer', exact: true }).click();
      assert.equal(await page.locator('input:checked').count(), 0);
      await page.getByText('The question changed.', { exact: false }).waitFor();
    } finally { await context.close(); }
  });
  await test('Rich text and text fields dispatch native input events', async () => {
    const markup = '<div data-ocs-question data-type="completion"><p data-ocs-title>Fill fields</p><textarea></textarea><input type="text"></div>';
    const { page, context } = await pageFor({ markup, settings: { bank: [{ question: 'Fill fields', answer: '["Alpha","Beta"]' }] } });
    try {
      await page.evaluate(() => { window.__inputs = 0; document.addEventListener('input', () => window.__inputs++); });
      await results(page); await page.getByRole('button', { name: 'Apply answer', exact: true }).click();
      assert.equal(await page.locator('textarea').inputValue(), 'Alpha'); assert.equal(await page.locator('input[type=text]').inputValue(), 'Beta');
      assert.equal(await page.evaluate(() => window.__inputs), 2);
    } finally { await context.close(); }
  });
  await test('A same-origin iframe is controlled from the parent panel', async () => {
    const escaped = questionMarkup(fixtures[0]).replaceAll('"', '&quot;');
    const { page, context } = await pageFor({ markup: `<iframe style="width:600px;height:300px" srcdoc="${escaped}"></iframe>` });
    try { await results(page); await page.getByRole('button', { name: 'Apply answer', exact: true }).click(); assert.equal(await page.frameLocator('iframe').locator('input:checked').inputValue(), 'Two'); }
    finally { await context.close(); }
  });
  await test('Stopping exercises aborts in-flight userscript requests', async () => {
    const { page, context } = await pageFor({ settings: { bank: [], providers: [{ name: 'Fixture', url: 'https://provider.example/search' }], requestIntervalMs: 0 }, gmDelay: 3000 });
    try {
      await page.getByRole('button', { name: 'Exercises', exact: true }).click(); await page.getByRole('button', { name: 'Start exercises', exact: true }).click();
      await page.waitForFunction(() => window.__requests > 0);
      await page.getByRole('button', { name: 'Stop exercises', exact: true }).click();
      await page.waitForFunction(() => window.__aborts > 0); assert.equal(await page.locator('input:checked').count(), 0);
    } finally { await context.close(); }
  });
  await test('SPA route changes cancel requests and remove stale results', async () => {
    const { page, context } = await pageFor({ settings: { bank: [], providers: [{ name: 'Fixture', url: 'https://provider.example/search' }], requestIntervalMs: 0 }, gmDelay: 3000 });
    try {
      await page.getByRole('button', { name: 'Exercises', exact: true }).click(); await page.getByRole('button', { name: 'Start exercises', exact: true }).click();
      await page.waitForFunction(() => window.__requests > 0); await page.evaluate(() => history.pushState({}, '', '/course/next'));
      await page.waitForFunction(() => window.__aborts > 0); await page.getByText('0 question(s) / 0 applied', { exact: true }).waitFor();
    } finally { await context.close(); }
  });
  await test('Chapter navigation skips finished chapters and stops at the boundary', async () => {
    const markup = '<div data-ocs-chapter class="active">Current</div><div data-ocs-chapter data-completed="true">Finished</div><button data-ocs-chapter id="next">Next unfinished</button>';
    const { page, context } = await pageFor({ markup });
    try {
      await page.evaluate(() => { window.__next = 0; document.querySelector('#next').addEventListener('click', () => window.__next++); });
      await page.getByRole('button', { name: 'Next item', exact: true }).click(); await page.getByRole('button', { name: 'Next item', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__next), 1);
    } finally { await context.close(); }
  });
  await test('The media controller applies rate/volume and pauses its player', async () => {
    const { page, context } = await pageFor({ markup: '<video style="width:300px;height:100px"></video>', settings: { playbackRate: 1.5, volume: 0.25 } });
    try {
      await page.evaluate(() => {
        const video = document.querySelector('video'); let paused = true;
        Object.defineProperty(video, 'paused', { get: () => paused });
        video.play = async () => { paused = false; }; video.pause = () => { paused = true; };
      });
      await page.getByRole('button', { name: 'Start study', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('video').playbackRate === 1.5);
      assert.equal(await page.locator('video').evaluate(video => video.volume), 0.25);
      await page.getByRole('button', { name: 'Pause study', exact: true }).click(); assert.equal(await page.locator('video').evaluate(video => video.paused), true);
    } finally { await context.close(); }
  });
  await test('Verification pauses study without clicking the verification widget', async () => {
    const { page, context } = await pageFor({ markup: '<div data-ocs-captcha>Verification required</div>' });
    try { await page.getByRole('button', { name: 'Start study', exact: true }).click(); await page.getByRole('button', { name: 'Resume study', exact: true }).waitFor(); }
    finally { await context.close(); }
  });
  await test('Provider text is rendered without HTML execution', async () => {
    const { page, context } = await pageFor({ settings: { bank: [{ question: 'Choose Two', answer: '<img src=x onerror="window.pwned=1">' }] } });
    try {
      await page.getByRole('button', { name: 'Exercises', exact: true }).click(); await page.getByRole('button', { name: 'Start exercises', exact: true }).click();
      await page.getByText('Fixture', { exact: false }).count();
      await page.getByText('Local bank: <img src=x onerror="window.pwned=1">', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.pwned), undefined);
    } finally { await context.close(); }
  });
  await test('Panel minimization and English settings remain usable', async () => {
    const { page, context } = await pageFor();
    try {
      await page.getByRole('button', { name: 'Minimize', exact: true }).click();
      await page.getByRole('button', { name: 'Open', exact: true }).click();
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      assert.equal((await page.getByRole('textbox', { name: 'Settings JSON' }).inputValue()).includes('schema'), true);
      await page.screenshot({ path: path.join(artifactDir, 'settings.png') });
    } finally { await context.close(); }
  });
  await test('A two-option radio question is not mistaken for judgement', async () => {
    const markup = '<div data-ocs-question><p data-ocs-title>Choose Two</p><label data-ocs-option><input type="radio" name="x">One</label><label data-ocs-option><input type="radio" name="x">Two</label></div>';
    const { page, context } = await pageFor({ markup });
    try { await results(page); await page.getByText('single / review', { exact: true }).waitFor(); }
    finally { await context.close(); }
  });
  await test('The runtime refuses a page-rejected native selection', async () => {
    const { page, context } = await pageFor();
    try {
      await page.locator('input').evaluateAll(inputs => inputs.forEach(input => input.addEventListener('click', event => event.preventDefault())));
      await results(page); await page.getByRole('button', { name: 'Apply answer', exact: true }).click();
      assert.equal(await page.locator('input:checked').count(), 0);
      await page.getByText('The page rejected the selection. Apply it manually.', { exact: true }).waitFor();
    } finally { await context.close(); }
  });
  await test('Provider connection ignores forged sources and accepts its own popup', async () => {
    const { page, context } = await pageFor({ settings: { connectUrl: 'https://provider.example/connect' } });
    try {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      const popupPromise = page.waitForEvent('popup');
      await page.getByRole('button', { name: 'Connect provider', exact: true }).click();
      const popup = await popupPromise; await popup.waitForLoadState();
      const config = [{ id: 'received', name: 'Received provider', url: 'https://provider.example/search' }];
      await page.evaluate(config => window.postMessage({ type: 'ocsjs-providers', version: 1, config }, location.origin), config);
      assert.equal((await page.getByRole('textbox', { name: 'Settings JSON' }).inputValue()).includes('Received provider'), false);
      await popup.evaluate(config => window.opener.postMessage({ type: 'ocsjs-providers', version: 1, config }, 'https://course.chaoxing.com'), config);
      await page.waitForFunction(() => document.querySelector('#ocsjs-panel').shadowRoot.querySelector('textarea').value.includes('Received provider'));
      if (!popup.isClosed()) await popup.waitForEvent('close');
    } finally { await context.close(); }
  });
  await test('Page lifecycle teardown and BFCache restoration create one fresh panel', async () => {
    const { page, context } = await pageFor();
    try {
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
      assert.equal(await page.locator('#ocsjs-panel').count(), 0);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await page.locator('#ocsjs-panel').waitFor(); assert.equal(await page.locator('#ocsjs-panel').count(), 1);
    } finally { await context.close(); }
  });
  await test('Auto-apply clicks only the explicitly configured save control', async () => {
    const { page, context } = await pageFor({ markup: questionMarkup(fixtures[0]) + '<button id="save">Save draft</button><button id="submit">Submit final</button>', settings: { autoApply: true, autoSave: true, saveSelector: '#save' } });
    try {
      await page.evaluate(() => {
        window.__saved = 0; window.__submitted = 0;
        document.querySelector('#save').addEventListener('click', () => window.__saved++);
        document.querySelector('#submit').addEventListener('click', () => window.__submitted++);
      });
      await results(page); await page.waitForFunction(() => window.__saved === 1);
      assert.equal(await page.evaluate(() => window.__submitted), 0);
    } finally { await context.close(); }
  });
  await test('A duplicate bundle injection leaves the original panel and session intact', async () => {
    const { page, context } = await pageFor();
    try { await page.addScriptTag({ content: script }); assert.equal(await page.locator('#ocsjs-panel').count(), 1); await results(page); }
    finally { await context.close(); }
  });
  await test('Operator-only question changes invalidate old answers', async () => {
    const { page, context } = await pageFor({ markup: questionMarkup(fixtures[0], 'single', '2 + 2'), settings: { bank: [{ question: '2 + 2', answer: 'Two' }] } });
    try {
      await results(page); await page.locator('.mark_name').evaluate(node => { node.textContent = '2 - 2'; });
      await page.getByRole('button', { name: 'Apply answer', exact: true }).click(); assert.equal(await page.locator('input:checked').count(), 0);
    } finally { await context.close(); }
  });
  await test('A delayed play promise cannot restart media after Stop', async () => {
    const { page, context } = await pageFor({ markup: '<video style="width:300px;height:100px"></video>' });
    try {
      await page.evaluate(() => {
        const video = document.querySelector('video'); let paused = true;
        Object.defineProperty(video, 'paused', { get: () => paused });
        video.play = () => new Promise(resolve => { window.__releasePlay = () => { paused = false; resolve(); }; });
        video.pause = () => { paused = true; };
      });
      await page.getByRole('button', { name: 'Start study', exact: true }).click();
      await page.waitForFunction(() => typeof window.__releasePlay === 'function');
      await page.getByRole('button', { name: 'Stop study', exact: true }).click(); await page.evaluate(() => window.__releasePlay());
      await page.waitForFunction(() => document.querySelector('video').paused);
    } finally { await context.close(); }
  });
  console.log(`Browser checks passed: ${passed}. Browser: ${browser.version()}.`);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(artifactDir, 'browser-results.json'), JSON.stringify({ passed, browser: browser.version(), checks }, null, 2));
} finally { await browser.close(); }
