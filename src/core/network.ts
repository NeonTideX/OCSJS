import { endpoint } from './config';
import { abortError, delay } from './task';

export class HttpError extends Error {
  constructor(readonly status: number) { super(`Provider returned HTTP ${status}`); }
}
export interface Request {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}
export type Transport = (request: Request, signal: AbortSignal) => Promise<string>;

export const transport: Transport = async (request, signal) => {
  endpoint(request.url);
  signal.throwIfAborted();
  if (typeof GM_xmlhttpRequest === 'function') {
    return new Promise<string>((resolve, reject) => {
      let settled = false;
      let handle: { abort: () => void } | undefined;
      const finish = (error?: Error, text?: string) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(text ?? '');
      };
      const abort = () => { handle?.abort(); finish(abortError()); };
      signal.addEventListener('abort', abort, { once: true });
      try {
        handle = GM_xmlhttpRequest!({
          url: request.url, method: request.method, headers: request.headers,
          data: request.body, timeout: request.timeoutMs, responseType: 'text', anonymous: true,
          onload: response => {
            if (response.finalUrl) {
              try {
                if (new URL(response.finalUrl).origin !== new URL(request.url).origin) { finish(new Error('Cross-origin provider redirects are unsupported')); return; }
              } catch { finish(new Error('Invalid provider response URL')); return; }
            }
            if (response.status < 200 || response.status >= 300) finish(new HttpError(response.status));
            else if (response.responseText.length > 5_000_000) finish(new Error('Provider response exceeds 5 MB'));
            else finish(undefined, response.responseText);
          },
          onerror: () => finish(new Error('Provider network request failed')),
          ontimeout: () => finish(new DOMException('Provider request timed out', 'TimeoutError')),
          onabort: () => finish(abortError())
        });
      } catch { finish(new Error('Userscript request failed; check manager permissions')); }
      if (signal.aborted) abort();
    });
  }
  const response = await fetch(request.url, {
    method: request.method, headers: request.headers, body: request.body,
    credentials: 'omit', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(request.timeoutMs)])
  });
  if (!response.ok) throw new HttpError(response.status);
  const text = await response.text();
  if (text.length > 5_000_000) throw new Error('Provider response exceeds 5 MB');
  return text;
};

export async function requestWithRetry(request: Request, signal: AbortSignal, retries: number, send = transport): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try { return await send(request, signal); } catch (error) {
      signal.throwIfAborted();
      const transient = error instanceof HttpError && (error.status === 429 || error.status >= 500);
      if (!transient || attempt >= retries) throw error;
      await delay(Math.min(4000, 500 * 2 ** attempt), signal);
    }
  }
}
