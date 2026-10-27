import { endpoint, parseProviders } from './config';
import { abortError } from './task';
import type { Provider } from './types';

export function waitForProviders(popup: Window, connectUrl: string, signal: AbortSignal, timeoutMs = 120000): Promise<Provider[]> {
  const origin = endpoint(connectUrl).origin;
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      settled = true;
      clearTimeout(timer); clearInterval(poller);
      window.removeEventListener('message', receive);
      window.removeEventListener('pagehide', abort);
      signal.removeEventListener('abort', abort);
      try { popup.close(); } catch { /* The user can close an inaccessible popup. */ }
    };
    const fail = (error: Error) => { if (!settled) { cleanup(); reject(error); } };
    const abort = () => fail(abortError());
    const receive = (event: MessageEvent) => {
      if (settled || event.source !== popup || event.origin !== origin) return;
      const data = event.data as { type?: unknown; version?: unknown; config?: unknown } | null;
      if (!data || !['ocsjs-providers', 'ocs-answerer-config'].includes(String(data.type)) || data.version !== 1) return;
      try {
        const providers = parseProviders(typeof data.config === 'string' ? JSON.parse(data.config) : data.config);
        cleanup(); resolve(providers);
      } catch { fail(new Error('Provider configuration is invalid; use declarative JSON without executable handlers')); }
    };
    const timer = setTimeout(() => fail(new Error('Provider connection timed out')), timeoutMs);
    const poller = setInterval(() => { if (popup.closed) fail(new Error('Provider window was closed')); }, 250);
    window.addEventListener('message', receive);
    window.addEventListener('pagehide', abort, { once: true });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
