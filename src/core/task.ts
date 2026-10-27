import type { TaskState } from './types';

export function abortError(): DOMException { return new DOMException('Task canceled', 'AbortError'); }

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
    const abort = () => { clearTimeout(timer); cleanup(); reject(abortError()); };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export class Task {
  private controller = new AbortController();
  private listeners = new Set<(state: TaskState) => void>();
  state: TaskState = 'idle';
  get signal(): AbortSignal { return this.controller.signal; }
  onChange(listener: (state: TaskState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private set(state: TaskState): void { this.state = state; this.listeners.forEach(listener => listener(state)); }
  start(): void { this.stop(); this.controller = new AbortController(); this.set('running'); }
  pause(): void { if (this.state === 'running') this.set('paused'); }
  resume(): void { if (this.state === 'paused') this.set('running'); }
  stop(): void { this.controller.abort(); if (this.state !== 'idle') this.set('stopped'); }
  complete(): void { if (!this.signal.aborted) this.set('complete'); }
  fail(): void { if (!this.signal.aborted) this.set('error'); }
  async checkpoint(signal = this.signal): Promise<void> {
    signal.throwIfAborted();
    while (this.state === 'paused') await delay(80, signal);
    signal.throwIfAborted();
  }
}

export async function concurrent<T>(items: T[], limit: number, task: (item: T, index: number) => Promise<void>, signal: AbortSignal): Promise<void> {
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      signal.throwIfAborted();
      const index = cursor++;
      await task(items[index]!, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, Math.floor(limit))) }, worker));
}

export class RateGate {
  private nextAt = 0;
  async wait(intervalMs: number, signal: AbortSignal): Promise<void> {
    const now = Date.now();
    const at = Math.max(now, this.nextAt);
    this.nextAt = at + intervalMs;
    await delay(at - now, signal);
  }
}
