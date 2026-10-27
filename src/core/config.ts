import type { Answer, Provider, Selectors, Settings } from './types';

export interface Storage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  keys(): Promise<string[]>;
  remove(key: string): Promise<void>;
}

export const SETTINGS_KEY = 'ocsjs.v1.settings';
export const DEFAULT_SETTINGS: Settings = {
  schema: 1, playbackRate: 1, volume: 0.5, autoResume: true, autoNext: false,
  readDocuments: false, documentSeconds: 15, stopAfterMinutes: 0, mode: 'unfinished',
  concurrency: 2, requestIntervalMs: 1000, timeoutMs: 15000, retries: 1,
  cacheEnabled: true, autoApply: false, autoSave: false, saveSelector: '',
  advanceQuestions: false, questionNextSelector: '', unlockCopy: false,
  minimized: false, providers: [], bank: [], glyphMap: {}, customSelectors: {}, connectUrl: ''
};

export function createStorage(): Storage {
  if (typeof GM_getValue !== 'function' || typeof GM_setValue !== 'function') {
    throw new Error('OCSJS requires userscript storage. Install with Tampermonkey or ScriptCat.');
  }
  return {
    get: async key => GM_getValue!(key),
    set: async (key, value) => { GM_setValue!(key, value); },
    keys: async () => typeof GM_listValues === 'function' ? GM_listValues() : [],
    remove: async key => { if (typeof GM_deleteValue === 'function') GM_deleteValue(key); }
  };
}

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function endpoint(value: string): URL {
  const url = new URL(value);
  if (url.username || url.password) throw new Error('Use headers for credentials, rather than URL credentials');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('Endpoints require HTTPS or loopback HTTP');
  return url;
}

export function parseProviders(value: unknown): Provider[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('Providers must be an array of at most 20 entries');
  const ids = new Set<string>();
  return value.map((raw, index) => {
    if (!record(raw)) throw new Error(`Invalid provider at index ${index}`);
    if ('handler' in raw || Object.values(record(raw.data) ? raw.data : {}).some(v => record(v) && 'handler' in v)) {
      throw new Error('Executable legacy handlers are unsupported. Convert them to JSON paths; see docs/PROVIDERS.md.');
    }
    if (typeof raw.url !== 'string' || typeof raw.name !== 'string' || !raw.name.trim()) throw new Error('Every provider needs a name and URL');
    endpoint(raw.url.replace(/\$\{[^}]+\}/gu, 'value'));
    const id = typeof raw.id === 'string' ? raw.id : `provider-${index + 1}`;
    if (!id || ids.has(id)) throw new Error('Provider IDs must be unique and nonempty');
    ids.add(id);
    const headers: Record<string, string> = Object.create(null) as Record<string, string>;
    if (raw.headers !== undefined && !record(raw.headers)) throw new Error('Provider headers must be an object');
    for (const [key, entry] of Object.entries(raw.headers ?? {})) {
      if (typeof entry !== 'string' || /[\r\n]/u.test(key + entry)) throw new Error('Invalid provider header');
      headers[key] = entry;
    }
    if (raw.kind !== undefined && raw.kind !== 'json' && raw.kind !== 'openai') throw new Error('Unknown provider kind');
    if (raw.method !== undefined && !['get', 'post', 'GET', 'POST'].includes(String(raw.method))) throw new Error('Only GET and POST search requests are supported');
    if (raw.data !== undefined && !record(raw.data)) throw new Error('Provider data must be an object');
    const getString = (key: string, fallback: string) => {
      if (raw[key] !== undefined && typeof raw[key] !== 'string') throw new Error(`Invalid provider field: ${key}`);
      return typeof raw[key] === 'string' ? raw[key] : fallback;
    };
    return {
      id, name: raw.name.trim(), url: raw.url, enabled: raw.enabled !== false,
      kind: raw.kind === 'openai' ? 'openai' : 'json',
      method: String(raw.method ?? 'POST').toUpperCase() as 'GET' | 'POST', headers,
      data: record(raw.data) ? structuredClone(raw.data) : { title: '${title}', options: '${options}', type: '${type}' },
      resultsPath: getString('resultsPath', ''), questionPath: getString('questionPath', 'question'),
      answerPath: getString('answerPath', 'answer'), model: getString('model', ''), sendImages: raw.sendImages === true
    };
  });
}

function parseBank(value: unknown): Answer[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('The local bank must be an array of at most 10000 answers');
  return value.map(raw => {
    if (!record(raw) || typeof raw.question !== 'string' || typeof raw.answer !== 'string') throw new Error('Local answers need question and answer strings');
    return { question: raw.question, answer: raw.answer, source: typeof raw.source === 'string' ? raw.source : 'Local bank' };
  });
}

const numericLimits = {
  playbackRate: [0.25, 16], volume: [0, 1], documentSeconds: [3, 3600], stopAfterMinutes: [0, 1440],
  concurrency: [1, 6], requestIntervalMs: [0, 60000], timeoutMs: [100, 120000], retries: [0, 3]
} as const;
const selectorKeys: (keyof Selectors)[] = ['questions', 'title', 'options', 'blanks', 'chapters', 'active', 'completed', 'next', 'documentNext', 'captcha'];

export function parseSettings(value: unknown): Settings {
  if (!record(value)) throw new Error('Settings must be a JSON object');
  if (value.schema !== undefined && value.schema !== 1) throw new Error('Unsupported settings schema');
  const next = structuredClone(DEFAULT_SETTINGS);
  for (const [key, initial] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in value)) continue;
    if (typeof initial === 'boolean') {
      if (typeof value[key] !== 'boolean') throw new Error(`Expected a boolean: ${key}`);
      Object.assign(next, { [key]: value[key] });
    }
    if (typeof initial === 'string' && key !== 'mode') {
      if (typeof value[key] !== 'string') throw new Error(`Expected a string: ${key}`);
      Object.assign(next, { [key]: value[key] });
    }
  }
  for (const [key, [min, max]] of Object.entries(numericLimits)) {
    const raw = value[key];
    if (raw === undefined) continue;
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < min || raw > max) throw new Error(`Out-of-range setting: ${key}`);
    if (['concurrency', 'retries'].includes(key) && !Number.isInteger(raw)) throw new Error(`Expected an integer: ${key}`);
    Object.assign(next, { [key]: raw });
  }
  if (value.mode !== undefined && !['unfinished', 'all'].includes(String(value.mode))) throw new Error('Invalid study mode');
  if (value.mode) next.mode = value.mode as Settings['mode'];
  if (value.providers !== undefined) next.providers = parseProviders(value.providers);
  if (value.bank !== undefined) next.bank = parseBank(value.bank);
  if (value.customSelectors !== undefined) {
    if (!record(value.customSelectors)) throw new Error('Custom selectors must be an object');
    for (const [key, entry] of Object.entries(value.customSelectors)) {
      if (!selectorKeys.includes(key as keyof Selectors) || typeof entry !== 'string') throw new Error(`Invalid selector: ${key}`);
      next.customSelectors[key as keyof Selectors] = entry;
    }
  }
  if (value.glyphMap !== undefined) {
    if (!record(value.glyphMap) || Object.keys(value.glyphMap).length > 20000) throw new Error('Invalid glyph map');
    for (const [key, entry] of Object.entries(value.glyphMap)) {
      if ([...key].length !== 1 || typeof entry !== 'string') throw new Error('Glyph maps contain single-character keys and string values');
      Object.defineProperty(next.glyphMap, key, { value: entry, enumerable: true, writable: true, configurable: true });
    }
  }
  if (next.connectUrl) endpoint(next.connectUrl);
  return next;
}

export class Config {
  value = structuredClone(DEFAULT_SETTINGS);
  warnings: string[] = [];
  constructor(readonly storage: Storage) {}
  async load(): Promise<Settings> {
    const raw = await this.storage.get(SETTINGS_KEY);
    if (raw !== undefined) {
      // Corrupt saved data stays untouched and is surfaced to the user.
      this.value = parseSettings(raw);
      return this.value;
    }
    const legacy: Record<string, unknown> = {};
    const keys = await this.storage.keys();
    const read = async (names: string[]) => {
      for (const name of names) if (keys.includes(name)) return this.storage.get(name);
      return undefined;
    };
    for (const key of ['playbackRate', 'volume'] as const) {
      const value = await read([`zhs.study.${key}`, `zhs.gxk.study.${key}`, `cx.new.study.${key}`, `icourse.study-v1.${key}`]);
      if (value !== undefined) legacy[key] = Number(value);
    }
    try { this.value = parseSettings(legacy); } catch { this.warnings.push('Legacy playback settings need manual review.'); }
    const wrappers = await read(['common.settings.answererWrappers']);
    if (wrappers !== undefined) this.warnings.push('Legacy answer providers are preserved. Import declarative providers in Settings.');
    return this.value;
  }
  async save(value: unknown): Promise<void> {
    const parsed = parseSettings(value);
    await this.storage.set(SETTINGS_KEY, parsed);
    this.value = parsed;
  }
  export(includeCredentials = false): string {
    const value = structuredClone(this.value);
    if (!includeCredentials) {
      value.providers.forEach(p => {
        p.headers = Object.fromEntries(Object.entries(p.headers).map(([key]) => [key, '<redacted>']));
        const url = endpoint(p.url.replace(/\$\{[^}]+\}/gu, 'value'));
        if (url.search) p.url = `${url.origin}${url.pathname}`;
        p.data = {};
      });
      value.connectUrl = '';
    }
    return JSON.stringify(value, null, 2);
  }
}
