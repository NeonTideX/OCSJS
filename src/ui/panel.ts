import type { Answer, Platform, Question, Result, TaskState } from '../core/types';
import type { Config } from '../core/config';
import { download } from '../browser/dom';

export interface PanelActions {
  config: Config;
  studyStart: () => void; studyPause: () => void; studyResume: () => void; studyStop: () => void; studyNext: () => void;
  workStart: () => void; workPause: () => void; workResume: () => void; workStop: () => void;
  save: (settings: unknown) => Promise<void>;
  search: (question: Question) => Promise<Answer[]>;
  connect: () => Promise<void>;
  clearCache: () => Promise<void>;
  results: () => Result[];
}

function element<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

export class Panel {
  readonly host: HTMLDivElement;
  private root: ShadowRoot;
  private output: HTMLElement;
  private status: HTMLElement;
  private body: HTMLElement;
  private editor?: HTMLTextAreaElement;
  private activeTab = 'Study';
  private logs: { time: string; message: string }[] = [];
  private studyState: TaskState = 'idle';
  private workState: TaskState = 'idle';
  private minimized = false;
  constructor(private doc: Document, platform: Platform, private actions: PanelActions) {
    this.host = element(doc, 'div'); this.host.id = 'ocsjs-panel';
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = element(doc, 'style'); style.textContent = __STYLE__;
    const frame = element(doc, 'section', '', 'panel');
    const header = element(doc, 'header');
    const title = element(doc, 'strong', `OCSJS V1`);
    const toggle = this.button('Minimize', () => this.toggle(), 'minimize');
    header.append(title, element(doc, 'span', platform.name, 'platform'), toggle);
    const navigation = element(doc, 'nav');
    for (const name of ['Study', 'Exercises', 'Search', 'Settings', 'Logs']) {
      const button = this.button(name, () => { this.activeTab = name; this.render(); });
      button.dataset.tab = name; navigation.append(button);
    }
    this.status = element(doc, 'div', 'Ready', 'status'); this.status.setAttribute('role', 'status');
    this.body = element(doc, 'main'); this.output = element(doc, 'div');
    const footer = element(doc, 'footer');
    const link = element(doc, 'a', 'Documentation'); link.href = 'https://github.com/NeonTideX/OCSJS#readme'; link.target = '_blank'; link.rel = 'noopener noreferrer';
    footer.append(element(doc, 'span', `Independent browser runtime / ${__VERSION__}`), link);
    frame.append(header, navigation, this.status, this.body, footer);
    this.root.append(style, frame); doc.documentElement.append(this.host);
    this.minimized = actions.config.value.minimized;
    this.host.classList.toggle('minimized', this.minimized); this.render();
  }
  private button(text: string, action: () => void | Promise<void>, className = ''): HTMLButtonElement {
    const button = element(this.doc, 'button', text, className); button.type = 'button';
    button.addEventListener('click', () => {
      try { Promise.resolve(action()).catch(error => this.log(error instanceof Error ? error.message : 'Action failed')); }
      catch (error) { this.log(error instanceof Error ? error.message : 'Action failed'); }
    });
    return button;
  }
  private paragraph(text: string): HTMLElement { return element(this.doc, 'p', text); }
  private row(...nodes: Node[]): HTMLElement { const row = element(this.doc, 'div', '', 'row'); row.append(...nodes); return row; }
  private labeled(text: string, input: HTMLElement): HTMLElement {
    const label = element(this.doc, 'label', '', 'field'); label.append(element(this.doc, 'span', text), input); return label;
  }
  private toggle(): void {
    this.minimized = !this.minimized; this.host.classList.toggle('minimized', this.minimized);
    this.root.querySelector('.minimize')!.textContent = this.minimized ? 'Open' : 'Minimize';
    void this.actions.config.save({ ...this.actions.config.value, minimized: this.minimized }).catch(() => this.log('Could not persist the panel state.'));
  }
  open(): void { if (this.minimized) this.toggle(); }
  destroy(): void { this.host.remove(); }
  log(message: string): void {
    this.logs.push({ time: new Date().toLocaleTimeString('en-US'), message });
    this.logs = this.logs.slice(-150); this.status.textContent = message;
    if (this.activeTab === 'Logs') this.renderLogs();
  }
  state(kind: 'study' | 'work', state: TaskState): void {
    if (kind === 'study') this.studyState = state; else this.workState = state;
    this.status.textContent = `Study: ${this.studyState} / Exercises: ${this.workState}`;
    if (this.activeTab === 'Study' || this.activeTab === 'Exercises') this.render();
  }
  resultsChanged(): void { if (this.activeTab === 'Exercises') this.renderResults(); }
  settingsChanged(): void { if (this.editor && this.activeTab === 'Settings') this.editor.value = JSON.stringify(this.actions.config.value, null, 2); }
  private render(): void {
    this.root.querySelectorAll<HTMLButtonElement>('nav button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tab === this.activeTab)));
    this.body.replaceChildren(); this.editor = undefined;
    this.output = element(this.doc, 'div');
    if (this.activeTab === 'Study') {
      this.body.append(this.paragraph('Control media and document reading on this page and accessible frames.'));
      this.body.append(this.row(this.button('Start study', this.actions.studyStart, 'primary'), this.button(this.studyState === 'paused' ? 'Resume study' : 'Pause study', this.studyState === 'paused' ? this.actions.studyResume : this.actions.studyPause), this.button('Stop study', this.actions.studyStop), this.button('Next item', this.actions.studyNext)));
      for (const [key, text, min, max, step] of [
        ['playbackRate', 'Playback speed', 0.25, 16, 0.25], ['volume', 'Volume (0 to 1)', 0, 1, 0.05], ['stopAfterMinutes', 'Stop after minutes (0 disables)', 0, 1440, 1]
      ] as const) {
        const input = element(this.doc, 'input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(this.actions.config.value[key]);
        input.addEventListener('change', () => { void this.actions.save({ ...this.actions.config.value, [key]: Number(input.value) }).catch(error => this.log(String(error))); });
        this.body.append(this.labeled(text, input));
      }
      this.body.append(this.paragraph('Automatic navigation and document reading are off by default. Enable them in Settings. Verification and trusted input may require a page interaction.'));
    } else if (this.activeTab === 'Exercises') {
      this.body.append(this.paragraph('Search detected questions, review the results, then apply answers.'));
      this.body.append(this.row(this.button('Start exercises', this.actions.workStart, 'primary'), this.button(this.workState === 'paused' ? 'Resume exercises' : 'Pause exercises', this.workState === 'paused' ? this.actions.workResume : this.actions.workPause), this.button('Stop exercises', this.actions.workStop), this.button('Export results', () => {
        const results = this.actions.results().map(({ question, answers, resolution, state, error }) => ({ question, answers, resolution, state, error }));
        download(this.doc, 'ocsjs-results.json', JSON.stringify(results, null, 2));
      })));
      this.body.append(this.output); this.renderResults();
    } else if (this.activeTab === 'Search') this.renderSearch();
    else if (this.activeTab === 'Settings') this.renderSettings();
    else { this.body.append(this.output); this.renderLogs(); }
  }
  private renderResults(): void {
    this.output.replaceChildren();
    const results = this.actions.results();
    this.output.append(this.paragraph(`${results.length} question(s) / ${results.filter(r => r.state === 'applied').length} applied`));
    for (const result of results.slice(-200)) {
      const card = element(this.doc, 'article', '', 'result');
      card.append(element(this.doc, 'strong', result.question.title), element(this.doc, 'small', `${result.question.type} / ${result.state}`));
      for (const answer of result.answers) card.append(this.paragraph(`${answer.source}: ${answer.answer}`));
      if (result.error) card.append(this.paragraph(result.error));
      if (result.resolution) card.append(this.paragraph(`${result.resolution.reason} (${Math.round(result.resolution.confidence * 100)}%)`));
      const controls = this.row();
      if (result.locate) controls.append(this.button('Locate', result.locate));
      if (result.resolution?.finish && result.apply) controls.append(this.button('Apply answer', result.apply, 'primary'));
      card.append(controls); this.output.append(card);
    }
  }
  private renderSearch(): void {
    const title = element(this.doc, 'textarea'); title.rows = 3; title.placeholder = 'Question text';
    const options = element(this.doc, 'textarea'); options.rows = 3; options.placeholder = 'One option per line';
    const type = element(this.doc, 'select');
    for (const value of ['single', 'multiple', 'judgement', 'completion']) { const option = element(this.doc, 'option', value); option.value = value; type.append(option); }
    const blanks = element(this.doc, 'input'); blanks.type = 'number'; blanks.min = '1'; blanks.value = '1';
    this.body.append(this.labeled('Question', title), this.labeled('Question type', type), this.labeled('Options', options), this.labeled('Blank count', blanks));
    const search = this.button('Search answers', async () => {
      if (!title.value.trim()) throw new Error('Enter a question first');
      search.disabled = true; this.output.replaceChildren(this.paragraph('Searching...'));
      try {
        const answers = await this.actions.search({ title: title.value.trim(), type: type.value as Question['type'], options: options.value.split('\n').filter(Boolean), images: [], blanks: Number(blanks.value) });
        this.output.replaceChildren(...(answers.length ? answers.map(answer => this.paragraph(`${answer.source}: ${answer.answer}`)) : [this.paragraph('No answer found. Configure a provider or local bank in Settings.')]));
      } finally { search.disabled = false; }
    }, 'primary');
    this.body.append(search, this.output);
  }
  private renderSettings(): void {
    this.body.append(this.paragraph('Advanced settings are JSON. Provider credentials are stored in your userscript manager. See Documentation for schemas and examples.'));
    this.editor = element(this.doc, 'textarea'); this.editor.rows = 18; this.editor.spellcheck = false; this.editor.setAttribute('aria-label', 'Settings JSON');
    this.editor.value = JSON.stringify(this.actions.config.value, null, 2);
    this.body.append(this.editor);
    const file = element(this.doc, 'input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
    const filename = element(this.doc, 'span', 'No file selected');
    file.addEventListener('change', () => {
      const selected = file.files?.[0]; if (!selected) return;
      filename.textContent = selected.name;
      if (selected.size > 5_000_000) { this.log('Settings files must be under 5 MB'); return; }
      void selected.text().then(text => { if (this.editor) this.editor.value = text; }).catch(() => this.log('Could not read settings file'));
    });
    this.body.append(this.row(this.button('Save settings', async () => { await this.actions.save(JSON.parse(this.editor!.value)); this.log('Settings saved.'); }, 'primary'), this.button('Export settings', () => download(this.doc, 'ocsjs-settings.json', this.actions.config.export(false))), this.button('Export with credentials', () => download(this.doc, 'ocsjs-settings-private.json', this.actions.config.export(true)))));
    this.body.append(this.labeled('Import settings (review, then Save)', this.row(this.button('Choose JSON file', () => file.click()), filename)), file);
    this.body.append(this.row(this.button('Connect provider', this.actions.connect), this.button('Clear answer cache', async () => { await this.actions.clearCache(); this.log('Answer cache cleared.'); })));
    this.body.append(this.paragraph('Export settings excludes headers, request data, connection URLs and URL queries. Export with credentials creates a private backup. Saving cancels active sessions.'));
  }
  private renderLogs(): void {
    this.output.replaceChildren(this.button('Clear logs', () => { this.logs = []; this.renderLogs(); }));
    for (const entry of [...this.logs].reverse()) this.output.append(this.paragraph(`${entry.time} ${entry.message}`));
  }
}
