import type { Answer, Provider, Question, Settings } from './types';
import type { Storage } from './config';
import { record } from './config';
import { normalizeQuestion, questionKey } from './text';
import { RateGate } from './task';
import { requestWithRetry, type Transport } from './network';

export function jsonPath(value: unknown, path: string): unknown {
  if (!path || path === '$') return value;
  const parts = path.replace(/^\$\.?/u, '').replace(/\[(\d+)\]/gu, '.$1').split('.');
  let current = value;
  for (const part of parts) {
    if (['__proto__', 'prototype', 'constructor'].includes(part)) throw new Error('Unsafe JSON path');
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function template(value: unknown, variables: Record<string, string>): unknown {
  if (typeof value === 'string') return value.replace(/\$\{(\w+)\}/gu, (_, key: string) => variables[key] ?? '');
  if (Array.isArray(value)) return value.map(item => template(item, variables));
  if (record(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, template(item, variables)]));
  return value;
}

export function extractAnswers(response: unknown, provider: Provider, title: string): Answer[] {
  const selected = jsonPath(response, provider.resultsPath);
  const entries = Array.isArray(selected) ? selected : [selected];
  const result: Answer[] = [];
  for (const entry of entries.slice(0, 100)) {
    if (entry === undefined || entry === null) continue;
    const raw = typeof entry === 'string' ? entry : jsonPath(entry, provider.answerPath);
    if (raw === undefined || raw === null || raw === '') continue;
    const answer = Array.isArray(raw) ? JSON.stringify(raw) : typeof raw === 'object' ? undefined : String(raw);
    if (!answer) continue;
    const question = typeof entry === 'string' ? title : jsonPath(entry, provider.questionPath);
    result.push({ question: typeof question === 'string' ? question : title, answer, source: provider.name });
  }
  return result;
}

interface CacheEntry { at: number; answers: Answer[] }
const CACHE_KEY = 'ocsjs.v1.answers';

export class AnswerCache {
  private entries = new Map<string, CacheEntry>();
  constructor(private storage?: Storage, private maxSize = 300, private ttlMs = 7 * 86400000) {}
  async load(): Promise<void> {
    const raw = await this.storage?.get(CACHE_KEY);
    if (!Array.isArray(raw)) return;
    for (const pair of raw.slice(-this.maxSize)) {
      if (!Array.isArray(pair) || typeof pair[0] !== 'string' || !record(pair[1])) continue;
      const entry = pair[1];
      if (typeof entry.at !== 'number' || entry.at > Date.now() || Date.now() - entry.at >= this.ttlMs || !Array.isArray(entry.answers)) continue;
      if (!entry.answers.every(a => record(a) && typeof a.question === 'string' && typeof a.answer === 'string' && typeof a.source === 'string')) continue;
      this.entries.set(pair[0], entry as unknown as CacheEntry);
    }
  }
  get(key: string): Answer[] | undefined {
    const entry = this.entries.get(key);
    if (!entry || Date.now() - entry.at >= this.ttlMs) { this.entries.delete(key); return undefined; }
    return structuredClone(entry.answers);
  }
  async put(key: string, answers: Answer[]): Promise<void> {
    if (!answers.length) return;
    this.entries.delete(key);
    this.entries.set(key, { at: Date.now(), answers: structuredClone(answers) });
    while (this.entries.size > this.maxSize) this.entries.delete(this.entries.keys().next().value!);
    await this.storage?.set(CACHE_KEY, [...this.entries]);
  }
  async clear(): Promise<void> { this.entries.clear(); await this.storage?.remove(CACHE_KEY); }
}

export class ProviderEngine {
  private gates = new Map<string, RateGate>();
  constructor(private cache: AnswerCache, private send?: Transport) {}
  async search(question: Question, settings: Settings, signal: AbortSignal, onError?: (name: string, message: string) => void): Promise<Answer[]> {
    signal.throwIfAborted();
    const titleKey = normalizeQuestion(question.title);
    const local = titleKey ? settings.bank.filter(entry => normalizeQuestion(entry.question) === titleKey) : [];
    // Hash the full provider configuration so cache invalidation includes tokens without storing them in keys.
    const signature = JSON.stringify(settings.providers);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));
    const fingerprint = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
    const cacheKey = `${fingerprint}:${questionKey(question)}`;
    const cached = settings.cacheEnabled ? this.cache.get(cacheKey) : undefined;
    if (cached) return [...local, ...cached];
    const found: Answer[] = [];
    // Each provider has one rate gate shared across question workers and manual search.
    for (const provider of settings.providers.filter(p => p.enabled)) {
      signal.throwIfAborted();
      let gate = this.gates.get(provider.id);
      if (!gate) { gate = new RateGate(); this.gates.set(provider.id, gate); }
      await gate.wait(settings.requestIntervalMs, signal);
      try { found.push(...await this.query(question, provider, settings, signal)); }
      catch (error) {
        signal.throwIfAborted();
        onError?.(provider.name, error instanceof SyntaxError ? 'Provider returned invalid JSON' : error instanceof Error ? error.message : 'Provider request failed');
      }
    }
    signal.throwIfAborted();
    // Answers for a different question must never silently resolve the current question.
    const relevant = found.filter(answer => normalizeQuestion(answer.question) === titleKey);
    if (settings.cacheEnabled) await this.cache.put(cacheKey, relevant);
    return [...local, ...relevant];
  }
  private async query(question: Question, provider: Provider, settings: Settings, signal: AbortSignal): Promise<Answer[]> {
    const variables = { title: question.title, options: question.options.join('\n'), type: question.type, images: provider.sendImages ? JSON.stringify(question.images) : '[]' };
    const encoded = Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, encodeURIComponent(value)]));
    const url = new URL(template(provider.url, encoded) as string);
    const data = template(provider.data, variables) as Record<string, unknown>;
    let body: string | undefined;
    let method = provider.method;
    if (provider.kind === 'openai') {
      method = 'POST';
      if (!provider.model) throw new Error('Set a model for the OpenAI-compatible provider');
      const prompt = `Answer the following question. Return only the answer; for choices use option letters, and for blanks use a JSON array.\nType: ${question.type}\n${question.title}\n${question.options.map((s, i) => `${String.fromCharCode(65 + i)}. ${s}`).join('\n')}`;
      const content = provider.sendImages && question.images.length
        ? [{ type: 'text', text: prompt }, ...question.images.filter(image => /^https:\/\//u.test(image) || /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/iu.test(image)).map(image => ({ type: 'image_url', image_url: { url: image } }))]
        : prompt;
      body = JSON.stringify({ ...data, model: provider.model, messages: [{ role: 'user', content }], stream: false });
    } else if (method === 'GET') {
      for (const [key, value] of Object.entries(data)) url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    } else {
      const contentType = Object.entries(provider.headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1] ?? 'application/json';
      body = contentType.includes('application/x-www-form-urlencoded')
        ? new URLSearchParams(Object.entries(data).map(([key, value]) => [key, String(value)])).toString()
        : JSON.stringify(data);
    }
    const headers = { ...provider.headers };
    if (method === 'POST' && !Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
    const text = await requestWithRetry({ url: url.href, method, headers, body, timeoutMs: settings.timeoutMs }, signal, settings.retries, this.send);
    const response: unknown = JSON.parse(text);
    if (provider.kind === 'openai') {
      const content = jsonPath(response, 'choices.0.message.content');
      return typeof content === 'string' && content.trim() ? [{ question: question.title, answer: content.trim(), source: provider.name }] : [];
    }
    return extractAnswers(response, provider, question.title);
  }
}
