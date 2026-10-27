import type { Platform, Selectors, Settings } from '../core/types';
import { Task, delay } from '../core/task';
import { active, clickReady, completed, documents, queryAll, visible } from './dom';
import { findQuestions } from './questions';
import { nextPoint } from './navigation';

export class StudyController {
  readonly task = new Task();
  private media = new Set<HTMLMediaElement>();
  private visited = new WeakSet<Element>();
  private lastNavigation = 0;
  private pendingNavigation?: { marker: string; at: number };
  constructor(private doc: Document, private platform: Platform, private settings: () => Settings, private report: (message: string) => void) {
    this.task.onChange(state => {
      if (state === 'paused' || state === 'stopped') this.media.forEach(media => { if (!media.paused) media.pause(); });
    });
  }
  get selectors(): Selectors { return { ...this.platform.selectors, ...this.settings().customSelectors }; }
  start(): void {
    this.task.start(); this.visited = new WeakSet(); this.lastNavigation = 0; this.pendingNavigation = undefined;
    const signal = this.task.signal;
    void this.loop(signal).catch(error => {
      if (signal.aborted) return;
      this.task.fail(); this.report(error instanceof Error ? error.message : 'Study task failed');
    });
  }
  stop(): void { this.task.stop(); this.media.clear(); }
  next(): boolean {
    if (this.pendingNavigation && this.viewMarker() === this.pendingNavigation.marker) {
      this.report('Waiting for the selected course item to open.'); return false;
    }
    const selectors = this.selectors;
    const settings = this.settings();
    const docs = documents(this.doc);
    for (const doc of docs) {
      const candidates = queryAll<HTMLElement>(doc, selectors.chapters).filter(visible);
      const leaves = candidates.filter(node => !candidates.some(other => other !== node && node.contains(other)));
      const index = leaves.findIndex(node => active(node, selectors));
      const points = leaves.map((node, i) => ({ id: String(i), name: '', required: 1, finished: completed(node, selectors) ? 1 : 0 }));
      const skipped = new Set(leaves.flatMap((node, i) => this.visited.has(node) ? [String(i)] : []));
      const point = nextPoint(points, String(index), settings.mode, skipped);
      const target = point ? leaves[Number(point.id)] : undefined;
      if (target) {
        const marker = this.viewMarker();
        this.visited.add(target);
        target.scrollIntoView({ block: 'nearest' }); target.click();
        this.lastNavigation = Date.now();
        this.pendingNavigation = { marker, at: this.lastNavigation };
        this.report('Opened the next course item.'); return true;
      }
    }
    for (const doc of docs) {
      const marker = this.viewMarker();
      if (clickReady(doc, selectors.next)) {
        this.lastNavigation = Date.now(); this.pendingNavigation = { marker, at: this.lastNavigation }; return true;
      }
    }
    this.report('No next item was detected. Expand the course outline or update the chapter selectors.');
    return false;
  }
  private viewMarker(): string {
    return documents(this.doc).map(doc => [doc.URL,
      queryAll(doc, this.selectors.chapters).filter(node => active(node, this.selectors)).map(node => node.textContent).join('|'),
      queryAll<HTMLMediaElement>(doc, 'video,audio').map(media => media.currentSrc || media.getAttribute('src')).join('|')
    ].join(':')).join(';');
  }
  private async loop(signal: AbortSignal): Promise<void> {
    const startedAt = Date.now();
    let documentAt = Date.now();
    let previousDocument = '';
    let lastReport = '';
    let lastAttempt = 0;
    const report = (message: string) => { if (lastReport !== message) { lastReport = message; this.report(message); } };
    while (!signal.aborted) {
      const settings = this.settings();
      if (settings.stopAfterMinutes > 0 && Date.now() - startedAt >= settings.stopAfterMinutes * 60000) { this.stop(); report('Scheduled study stop reached.'); return; }
      await this.task.checkpoint(signal);
      const docs = documents(this.doc);
      if (this.pendingNavigation) {
        if (this.viewMarker() !== this.pendingNavigation.marker) this.pendingNavigation = undefined;
        else if (Date.now() - this.pendingNavigation.at > 15000) {
          this.pendingNavigation = undefined; this.task.pause(); report('Course navigation did not finish. Open the item manually, then resume.'); continue;
        } else { await delay(300, signal); continue; }
      }
      if (docs.some(doc => queryAll(doc, this.selectors.captcha).some(visible))) {
        this.task.pause(); report('Verification is visible. Complete it on the page, then resume.'); continue;
      }
      const players = docs.flatMap(doc => queryAll<HTMLMediaElement>(doc, 'video,audio')).filter(player => !player.closest('#ocsjs-panel') && (visible(player) || player.tagName === 'AUDIO'));
      this.media = new Set(players);
      const player = players.find(item => !item.ended && !item.error);
      if (player) {
        player.playbackRate = settings.playbackRate; player.volume = settings.volume;
        if (settings.volume > 0) player.muted = false;
        // A single session owns one player at a time, including nested same-origin frames.
        players.filter(item => item !== player && !item.paused).forEach(item => item.pause());
        if (player.paused && settings.autoResume && Date.now() - lastAttempt > 3000) {
          lastAttempt = Date.now();
          try {
            await player.play();
            if (signal.aborted || this.task.state !== 'running') player.pause();
            signal.throwIfAborted();
            if (this.task.state === 'running') report('Media playback active.');
          }
          catch { signal.throwIfAborted(); report('Playback needs a page interaction. Press Play on the page, then resume.'); }
          await this.task.checkpoint(signal);
        }
        documentAt = Date.now();
      } else if (players.some(item => item.error)) {
        report('The media player reported an error. Reload or select a different course item.');
      } else if (players.length && players.every(item => item.ended)) {
        if (docs.some(doc => findQuestions(doc, this.selectors, settings).length > 0)) {
          report('This item contains questions. Review them in Exercises, then select Next item.');
          await delay(600, signal); continue;
        }
        if (!settings.autoNext || Date.now() - this.lastNavigation < 3000) { report('Media ended. Next-item navigation is available in the panel.'); }
        else if (!this.next()) { this.task.complete(); return; }
      } else {
        const documentNode = docs.flatMap(doc => queryAll(doc, '.swiper-container,.pdf-viewer,#img.imglook,.document-viewer,.ppt-container,[data-ocs-document]')).find(visible);
        if (documentNode && settings.readDocuments) {
          const marker = `${documentNode.ownerDocument.URL}:${documentNode.textContent}:${documentNode.querySelector('img')?.getAttribute('src')}`;
          if (marker !== previousDocument) { documentAt = Date.now(); previousDocument = marker; }
          if (Date.now() - documentAt > settings.documentSeconds * 1000) {
            documentAt = Date.now();
            if (clickReady(documentNode.ownerDocument, this.selectors.documentNext)) report('Opened the next document page.');
            else if (settings.autoNext && Date.now() - this.lastNavigation > 3000) {
              if (!this.next()) { this.task.complete(); return; }
            } else report('Document reading interval reached.');
          }
        } else report('Waiting for a media player or document. Open a course item on the page.');
      }
      await delay(600, signal);
    }
  }
}
