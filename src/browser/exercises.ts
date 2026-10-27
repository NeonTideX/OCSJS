import type { Platform, Result, Settings } from '../core/types';
import { resolve } from '../core/resolver';
import { Task, concurrent, delay } from '../core/task';
import { ProviderEngine } from '../core/providers';
import { questionKey } from '../core/text';
import { clickReady, documents, queryAll, visible } from './dom';
import { findQuestions, type BoundQuestion } from './questions';

export class ExerciseController {
  readonly task = new Task();
  results: Result[] = [];
  private documentIds = new WeakMap<Document, number>();
  private documentCounter = 0;
  private revision = 0;
  constructor(private doc: Document, private platform: Platform, private settings: () => Settings, private engine: ProviderEngine,
    private changed: () => void, private report: (message: string) => void) {}
  get selectors() { return { ...this.platform.selectors, ...this.settings().customSelectors }; }
  start(): void {
    this.task.start(); this.results = []; this.revision++;
    const signal = this.task.signal;
    const revision = this.revision;
    const run = async () => {
      if (signal.aborted) return;
      const locks = this.doc.defaultView?.navigator.locks;
      if (locks) await locks.request('ocsjs.v1.exercises', { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('Another page on this origin is already running exercises.');
        await this.loop(signal);
      });
      else await this.loop(signal);
    };
    void run().then(() => { if (revision === this.revision) this.task.complete(); }).catch(error => {
      if (signal.aborted) return;
      this.task.fail(); this.report(error instanceof Error ? error.message : 'Exercise task failed');
    });
  }
  stop(): void { this.task.stop(); this.revision++; this.changed(); }
  invalidate(): void {
    this.stop(); this.results = []; this.changed();
  }
  private async loop(signal: AbortSignal): Promise<void> {
    const processed = new Set<string>();
    let idle = 0;
    let lastNext = '';
    while (!signal.aborted) {
      await this.task.checkpoint(signal);
      const settings = structuredClone(this.settings());
      const docs = documents(this.doc);
      if (docs.some(doc => queryAll(doc, this.selectors.captcha).some(visible))) { this.task.pause(); this.report('Complete page verification, then resume exercises.'); continue; }
      const detected: { bound: BoundQuestion; id: string }[] = [];
      for (const doc of docs) {
        if (!this.documentIds.has(doc)) this.documentIds.set(doc, ++this.documentCounter);
        for (const bound of findQuestions(doc, this.selectors, settings)) {
          const id = `${this.documentIds.get(doc)}:${bound.id}`;
          if (!processed.has(id)) { processed.add(id); detected.push({ bound, id }); }
        }
      }
      if (!detected.length) {
        if (++idle >= 6) { this.report('No new questions detected. Results remain available for review.'); return; }
        await delay(500, signal); continue;
      }
      idle = 0;
      const batch = detected.map(({ bound, id }) => {
        const result: Result = { id, question: bound.question, state: 'waiting', answers: [], locate: () => bound.root.scrollIntoView({ block: 'center', behavior: 'smooth' }) };
        this.results.push(result); return { bound, result };
      });
      this.changed();
      await concurrent(batch, settings.concurrency, async ({ bound, result }) => {
        await this.task.checkpoint(signal);
        result.state = 'searching'; this.changed();
        try {
          let providerFailed = false;
          result.answers = await this.engine.search(bound.question, settings, signal, (name, message) => {
            providerFailed = true; this.report(`${name}: ${message}`);
          });
          await this.task.checkpoint(signal);
          if (!bound.alive()) throw new Error('Question changed during search; restart on the current page');
          result.resolution = resolve(bound.question, result.answers.map(answer => answer.answer));
          result.state = 'review';
          result.apply = () => {
            if (signal.aborted) throw new Error('This result belongs to a stopped session. Restart exercises.');
            bound.apply(result.resolution!); result.state = 'applied'; this.changed();
          };
          if (settings.autoApply && result.resolution.finish) result.apply();
          if (!result.answers.length && providerFailed) { result.error = 'All available providers failed or returned no answer'; result.state = 'error'; }
        } catch (error) {
          signal.throwIfAborted();
          result.state = 'error'; result.error = error instanceof Error ? error.message : 'Question processing failed';
        }
        this.changed();
      }, signal);
      await this.task.checkpoint(signal);
      if (settings.autoSave && settings.saveSelector && batch.every(item => item.result.state === 'applied')) {
        const owners = new Set(batch.map(item => item.bound.root.ownerDocument));
        owners.forEach(doc => clickReady(doc, settings.saveSelector));
        this.report('Clicked the configured save control. Check the platform for persistence.');
      }
      if (settings.advanceQuestions && settings.autoApply && batch.every(item => item.result.state === 'applied')) {
        const marker = batch.map(item => questionKey(item.bound.question)).join();
        if (marker !== lastNext && settings.questionNextSelector) {
          const doc = batch[batch.length - 1]!.bound.root.ownerDocument;
          if (clickReady(doc, settings.questionNextSelector)) { lastNext = marker; await delay(1000, signal); }
        }
      }
    }
  }
}
