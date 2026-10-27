export type QuestionType = 'single' | 'multiple' | 'judgement' | 'completion';

export interface Question {
  title: string;
  type: QuestionType;
  options: string[];
  images: string[];
  blanks: number;
}

export interface Answer {
  question: string;
  answer: string;
  source: string;
}

export interface Resolution {
  finish: boolean;
  indices: number[];
  values: string[];
  confidence: number;
  reason: string;
}

export interface Provider {
  id: string;
  name: string;
  enabled: boolean;
  kind: 'json' | 'openai';
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  data: Record<string, unknown>;
  resultsPath: string;
  questionPath: string;
  answerPath: string;
  model: string;
  sendImages: boolean;
}

export interface Selectors {
  questions: string;
  title: string;
  options: string;
  blanks: string;
  chapters: string;
  active: string;
  completed: string;
  next: string;
  documentNext: string;
  captcha: string;
}

export interface Platform {
  id: string;
  name: string;
  hosts: string[];
  selectors: Selectors;
}

export interface Settings {
  schema: 1;
  playbackRate: number;
  volume: number;
  autoResume: boolean;
  autoNext: boolean;
  readDocuments: boolean;
  documentSeconds: number;
  stopAfterMinutes: number;
  mode: 'unfinished' | 'all';
  concurrency: number;
  requestIntervalMs: number;
  timeoutMs: number;
  retries: number;
  cacheEnabled: boolean;
  autoApply: boolean;
  autoSave: boolean;
  saveSelector: string;
  advanceQuestions: boolean;
  questionNextSelector: string;
  unlockCopy: boolean;
  minimized: boolean;
  providers: Provider[];
  bank: Answer[];
  glyphMap: Record<string, string>;
  customSelectors: Partial<Selectors>;
  connectUrl: string;
}

export type TaskState = 'idle' | 'running' | 'paused' | 'stopped' | 'complete' | 'error';

export interface Result {
  id: string;
  question: Question;
  answers: Answer[];
  resolution?: Resolution;
  state: 'waiting' | 'searching' | 'review' | 'applied' | 'error';
  error?: string;
  apply?: () => void;
  locate?: () => void;
}
