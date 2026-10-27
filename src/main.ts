import { Config, createStorage } from './core/config';
import { AnswerCache, ProviderEngine } from './core/providers';
import { waitForProviders } from './core/connect';
import { detectPlatform } from './platforms';
import { StudyController } from './browser/study';
import { ExerciseController } from './browser/exercises';
import { documents, installCopyAccess } from './browser/dom';
import { Panel } from './ui/panel';

async function boot(): Promise<void> {
  const platform = detectPlatform(location.hostname);
  if (!platform || document.documentElement.hasAttribute('data-ocsjs-v1')) return;
  // A parent runtime owns accessible descendants. Cross-origin frames keep independent controls.
  try {
    if (window.parent !== window && window.parent.document.documentElement.hasAttribute('data-ocsjs-v1')) return;
  } catch { /* An isolated cross-origin frame needs its own runtime. */ }
  document.documentElement.setAttribute('data-ocsjs-v1', 'active');
  const storage = createStorage();
  const config = new Config(storage);
  await config.load();
  const cache = new AnswerCache(storage); await cache.load();
  const engine = new ProviderEngine(cache);
  const lifetime = new AbortController();
  let copyAccess = new AbortController();
  let search = new AbortController();
  let connecting: AbortController | undefined;
  let panel: Panel;
  const report = (message: string) => panel.log(message);
  const study = new StudyController(document, platform, () => config.value, report);
  const work = new ExerciseController(document, platform, () => config.value, engine, () => panel?.resultsChanged(), report);
  const updateCopy = () => {
    copyAccess.abort(); copyAccess = new AbortController();
    if (config.value.unlockCopy) documents(document).forEach(doc => installCopyAccess(doc, copyAccess.signal));
  };
  panel = new Panel(document, platform, {
    config, studyStart: () => study.start(), studyPause: () => study.task.pause(), studyResume: () => study.task.resume(), studyStop: () => study.stop(), studyNext: () => { study.next(); },
    workStart: () => work.start(), workPause: () => work.task.pause(), workResume: () => work.task.resume(), workStop: () => work.stop(),
    save: async settings => {
      await config.save(settings);
      study.stop(); work.invalidate(); search.abort(); connecting?.abort(); search = new AbortController();
      updateCopy(); panel.settingsChanged();
    },
    search: async question => {
      search.abort(); search = new AbortController();
      return engine.search(question, structuredClone(config.value), search.signal, (name, message) => report(`${name}: ${message}`));
    },
    connect: async () => {
      if (!config.value.connectUrl) throw new Error('Set connectUrl in Settings before connecting a provider');
      connecting?.abort(); connecting = new AbortController();
      const url = new URL(config.value.connectUrl); url.searchParams.set('from', location.origin);
      const popup = window.open(url.href, 'ocsjs-provider', 'width=900,height=700');
      if (!popup) throw new Error('Allow the provider popup in your browser');
      const providers = await waitForProviders(popup, config.value.connectUrl, connecting.signal);
      await config.save({ ...config.value, providers });
      work.invalidate(); panel.settingsChanged(); report('Provider configuration received and saved.');
    },
    clearCache: () => cache.clear(), results: () => work.results
  });
  study.task.onChange(state => panel.state('study', state));
  work.task.onChange(state => panel.state('work', state));
  updateCopy();
  config.warnings.forEach(report);
  if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Open OCSJS V1', () => panel.open());
  let href = location.href;
  const routeTimer = setInterval(() => {
    try {
      if (window.parent !== window && window.parent.document.documentElement.hasAttribute('data-ocsjs-v1')) { cleanup(); return; }
    } catch { /* The cross-origin child retains its own session. */ }
    if (location.href === href) return;
    href = location.href;
    const resumeStudy = study.task.state === 'running';
    study.stop(); work.invalidate(); search.abort(); search = new AbortController(); connecting?.abort();
    updateCopy();
    if (resumeStudy) study.start();
    report('Page route changed. Exercise results were cleared.');
  }, 750);
  const cleanup = () => {
    study.stop(); work.invalidate(); search.abort(); connecting?.abort(); copyAccess.abort();
    clearInterval(routeTimer); lifetime.abort(); panel.destroy();
    document.documentElement.removeAttribute('data-ocsjs-v1');
  };
  window.addEventListener('pagehide', cleanup, { once: true, signal: lifetime.signal });
}

function start(): void {
  void boot().catch(() => {
    document.documentElement.removeAttribute('data-ocsjs-v1');
    const notice = document.createElement('div');
    notice.textContent = 'OCSJS V1 could not load its configuration. Existing data was preserved. Check userscript storage and settings.';
    notice.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;padding:15px;background:#30202b;color:white;max-width:420px;font:14px system-ui';
    document.documentElement.append(notice);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
window.addEventListener('pageshow', event => { if (event.persisted) start(); });
