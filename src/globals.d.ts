declare const GM_getValue: ((key: string, fallback?: unknown) => unknown) | undefined;
declare const GM_setValue: ((key: string, value: unknown) => void) | undefined;
declare const GM_deleteValue: ((key: string) => void) | undefined;
declare const GM_listValues: (() => string[]) | undefined;
declare const GM_registerMenuCommand: ((name: string, callback: () => void) => void) | undefined;
declare const GM_xmlhttpRequest: ((details: {
  url: string; method: string; headers: Record<string, string>; data?: string;
  timeout: number; anonymous: boolean; responseType: 'text';
  onload: (response: { status: number; responseText: string; finalUrl?: string }) => void;
  onerror: () => void; ontimeout: () => void; onabort: () => void;
}) => { abort: () => void }) | undefined;
declare const __VERSION__: string;
declare const __STYLE__: string;
