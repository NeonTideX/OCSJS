import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Config, DEFAULT_SETTINGS, SETTINGS_KEY, endpoint, parseProviders, parseSettings, type Storage } from '../src/core/config';
import { AnswerCache, ProviderEngine, extractAnswers, jsonPath, template } from '../src/core/providers';
import { Task, concurrent, delay } from '../src/core/task';
import { HttpError, requestWithRetry } from '../src/core/network';
import { detectPlatform, hostnameMatches } from '../src/platforms';
import { collectPoints, nextPoint, pointUrl } from '../src/browser/navigation';
import type { Question } from '../src/core/types';
import { questionKey } from '../src/core/text';

class MemoryStorage implements Storage {
  data = new Map<string, unknown>();
  async get(key: string) { return structuredClone(this.data.get(key)); }
  async set(key: string, value: unknown) { this.data.set(key, structuredClone(value)); }
  async keys() { return [...this.data.keys()]; }
  async remove(key: string) { this.data.delete(key); }
}
const provider = () => parseProviders([{ id: 'test', name: 'Test', url: 'https://provider.example/search' }])[0]!;
const q: Question = { title: 'Question', type: 'single', options: ['One', 'Two'], images: [], blanks: 0 };

test('Settings validate numeric bounds and schema', () => {
  for (const patch of [{ volume: 2 }, { concurrency: 0 }, { concurrency: 1.2 }, { retries: NaN }, { schema: 2 }, { autoNext: 'yes' }]) assert.throws(() => parseSettings(patch));
  assert.equal(parseSettings({ playbackRate: 2 }).playbackRate, 2);
});
test('Defaults are isolated across configuration instances', () => {
  const a = parseSettings({}); a.providers.push(provider());
  assert.equal(parseSettings({}).providers.length, 0);
});
test('Settings reject invalid banks, glyph maps and selector keys', () => {
  assert.throws(() => parseSettings({ bank: [{}] }));
  assert.throws(() => parseSettings({ glyphMap: { abc: 'x' } }));
  assert.throws(() => parseSettings({ customSelectors: { unknown: 'div' } }));
});
test('Provider endpoints require HTTPS or loopback HTTP', () => {
  assert.equal(endpoint('http://127.0.0.1:3000/search').protocol, 'http:');
  for (const url of ['http://remote.example', 'javascript:alert(1)', 'https://user:pass@example.com']) assert.throws(() => endpoint(url));
});
test('Executable handlers and duplicate provider IDs are rejected', () => {
  assert.throws(() => parseProviders([{ ...provider(), handler: 'return x' }]));
  assert.throws(() => parseProviders([{ ...provider(), data: { field: { handler: 'return 1' } } }]));
  assert.throws(() => parseProviders([provider(), provider()]));
});
test('Headers reject line breaks', () => assert.throws(() => parseProviders([{ ...provider(), headers: { Authorization: 'x\r\ny' } }])));
test('Legacy settings migrate without deleting or overwriting stored values', async () => {
  const storage = new MemoryStorage(); await storage.set('zhs.study.playbackRate', '2');
  const config = new Config(storage); await config.load();
  assert.equal(config.value.playbackRate, 2);
  assert.equal(await storage.get('zhs.study.playbackRate'), '2');
  await config.save({ ...config.value, playbackRate: 1.5 });
  const reloaded = new Config(storage); await reloaded.load(); assert.equal(reloaded.value.playbackRate, 1.5);
});
test('Corrupt configuration remains untouched', async () => {
  const storage = new MemoryStorage(); await storage.set(SETTINGS_KEY, { schema: 99 });
  await assert.rejects(new Config(storage).load());
  assert.deepEqual(await storage.get(SETTINGS_KEY), { schema: 99 });
});
test('Failed storage writes preserve the active configuration', async () => {
  const storage = new MemoryStorage(); storage.set = async () => { throw new Error('Quota'); };
  const config = new Config(storage); await assert.rejects(config.save({ volume: 0.2 })); assert.equal(config.value.volume, 0.5);
});
test('Public settings exports omit credential-bearing fields', async () => {
  const config = new Config(new MemoryStorage());
  await config.save({ providers: [{ ...provider(), url: 'https://provider.example?token=secret', headers: { Authorization: 'secret' }, data: { token: 'secret' } }], connectUrl: 'https://provider.example/connect?token=secret' });
  assert.equal(config.export().includes('secret'), false);
  assert.equal(config.export(true).includes('secret'), true);
});
test('JSON paths support arrays and reject prototype access', () => {
  assert.equal(jsonPath({ data: [{ answer: 'A' }] }, 'data[0].answer'), 'A');
  assert.equal(jsonPath({}, 'missing.answer'), undefined);
  assert.throws(() => jsonPath({}, '__proto__.x'));
});
test('Templates recurse without executing configuration', () => {
  assert.deepEqual(template({ a: ['${title}', '${unknown}'], b: 2 }, { title: 'Question' }), { a: ['Question', ''], b: 2 });
});
test('Provider response paths handle nested results and answer arrays', () => {
  const p = { ...provider(), resultsPath: 'data', answerPath: 'value' };
  assert.deepEqual(extractAnswers({ data: [{ value: ['A', 'B'] }] }, p, 'Question'), [{ question: 'Question', answer: '["A","B"]', source: 'Test' }]);
});
test('The answer cache isolates results and evicts oldest entries', async () => {
  const cache = new AnswerCache(undefined, 1);
  await cache.put('one', [{ question: 'Q', answer: 'A', source: 'T' }]);
  const entry = cache.get('one')!; entry[0]!.answer = 'Changed'; assert.equal(cache.get('one')![0]!.answer, 'A');
  await cache.put('two', entry); assert.equal(cache.get('one'), undefined);
});
test('Expired cache entries are ignored', async () => {
  const storage = new MemoryStorage(); await storage.set('ocsjs.v1.answers', [['old', { at: 0, answers: [{ question: 'Q', answer: 'A', source: 'T' }] }]]);
  const cache = new AnswerCache(storage); await cache.load(); assert.equal(cache.get('old'), undefined);
});
test('Search caches are invalidated when provider credentials change', async () => {
  let requests = 0;
  const engine = new ProviderEngine(new AnswerCache(), async () => { requests++; return '{"answer":"A"}'; });
  const settings = parseSettings({ providers: [provider()], requestIntervalMs: 0 });
  await engine.search(q, settings, new AbortController().signal);
  await engine.search(q, settings, new AbortController().signal); assert.equal(requests, 1);
  settings.providers[0]!.headers.Authorization = 'different';
  await engine.search(q, settings, new AbortController().signal); assert.equal(requests, 2);
});
test('A response for another question cannot resolve the current question', async () => {
  const engine = new ProviderEngine(new AnswerCache(), async () => '{"question":"Different","answer":"A"}');
  assert.deepEqual(await engine.search(q, parseSettings({ providers: [provider()], requestIntervalMs: 0 }), new AbortController().signal), []);
});
test('Local answers work without providers or network requests', async () => {
  const engine = new ProviderEngine(new AnswerCache(), async () => { throw new Error('Must not request'); });
  assert.equal((await engine.search(q, parseSettings({ bank: [{ question: 'Question', answer: 'A' }] }), new AbortController().signal))[0]!.answer, 'A');
});
test('GET templates encode reserved URL characters', async () => {
  let requested = '';
  const engine = new ProviderEngine(new AnswerCache(), async request => { requested = request.url; return '{"answer":"A"}'; });
  await engine.search({ ...q, title: 'A & B?' }, parseSettings({ providers: [{ ...provider(), url: 'https://provider.example?q=${title}', method: 'GET', data: {} }], requestIntervalMs: 0 }), new AbortController().signal);
  assert.equal(new URL(requested).searchParams.get('q'), 'A & B?');
});
test('Requests retry transient HTTP failures with a bounded budget', async () => {
  let requests = 0;
  const result = await requestWithRetry({ url: provider().url, method: 'GET', headers: {}, timeoutMs: 1000 }, new AbortController().signal, 1, async () => { if (++requests === 1) throw new HttpError(503); return 'ok'; });
  assert.equal(result, 'ok'); assert.equal(requests, 2);
});
test('Authentication errors are never retried', async () => {
  let requests = 0;
  await assert.rejects(requestWithRetry({ url: provider().url, method: 'GET', headers: {}, timeoutMs: 1000 }, new AbortController().signal, 3, async () => { requests++; throw new HttpError(401); }));
  assert.equal(requests, 1);
});
test('Stopping a paused task cancels its outstanding checkpoint', async () => {
  const task = new Task(); task.start(); const signal = task.signal; task.pause();
  const waiting = task.checkpoint(signal); task.stop(); await assert.rejects(waiting, { name: 'AbortError' });
});
test('Restarting a task cannot revive stale work', async () => {
  const task = new Task(); task.start(); const previous = task.signal; task.start();
  await assert.rejects(task.checkpoint(previous)); assert.equal(task.signal.aborted, false);
});
test('Worker concurrency is bounded', async () => {
  let active = 0; let peak = 0;
  await concurrent([1, 2, 3, 4, 5], 2, async () => { peak = Math.max(peak, ++active); await delay(5); active--; }, new AbortController().signal);
  assert.equal(peak, 2);
});
test('Hostname matching respects domain label boundaries', () => {
  assert.equal(hostnameMatches('evilchaoxing.com', 'chaoxing.com'), false);
  assert.equal(detectPlatform('ai.icve.com.cn')?.id, 'icve');
  assert.equal(detectPlatform('zjy2.icve.com.cn')?.id, 'zjy');
  assert.equal(detectPlatform('example.com'), undefined);
});
test('Knowledge-point trees normalize arbitrary nested data and cycles', () => {
  const data: Record<string, unknown> = { list: [{ knowledgeId: 123456, knowledgeName: 'One', resourceCount: 2, finishResourceCount: 1 }] }; data.self = data;
  assert.deepEqual(collectPoints(data), [{ id: '123456', name: 'One', required: 2, finished: 1 }]);
});
test('Unfinished navigation wraps; all mode stops at the final point', () => {
  const points = [{ id: '1', name: 'One', required: 2, finished: 1 }, { id: '2', name: 'Two', required: 2, finished: 2 }];
  assert.equal(nextPoint(points, '2', 'unfinished')?.id, '1');
  assert.equal(nextPoint(points, '2', 'all'), undefined);
  assert.equal(nextPoint(points, '2', 'unfinished', new Set(['1'])), undefined);
});
test('Point routes preserve course, class and unrelated query parameters', () => {
  assert.equal(pointUrl('https://smartcoursestudent.zhihuishu.com/learnPage/88/123456/77?x=1', '654321'), 'https://smartcoursestudent.zhihuishu.com/learnPage/88/654321/77?x=1');
  assert.equal(new URL(pointUrl('https://example.com/study?courseId=1&classId=123456&nodeUid=123456', '654321')).searchParams.get('nodeUid'), '654321');
});
test('Default settings retain review before application', () => assert.equal(DEFAULT_SETTINGS.autoApply, false));
test('Question and cache identities retain mathematical operators', () => {
  assert.notEqual(questionKey({ ...q, title: '2 + 2' }), questionKey({ ...q, title: '2 - 2' }));
  assert.notEqual(questionKey({ ...q, options: ['a < b'] }), questionKey({ ...q, options: ['a > b'] }));
});
test('Local answers cannot cross mathematical question boundaries', async () => {
  const engine = new ProviderEngine(new AnswerCache());
  assert.deepEqual(await engine.search({ ...q, title: '2 - 2' }, parseSettings({ bank: [{ question: '2 + 2', answer: 'A' }] }), new AbortController().signal), []);
});
