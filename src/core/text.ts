export const DEFAULT_SEPARATORS = ['===', '###', '---', '#', '|', ';', '\uFF1B'];

export function stripLabel(value: string): string {
  return value.trim()
    .replace(/^[A-Z][.\u3001\uFF0E)\uFF09:\uFF1A\s]+(?=\S)/u, '')
    .replace(/^[A-Z](?=[\u2E80-\u9FFF])/u, '');
}

export function normalize(value: string): string {
  return stripLabel(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function normalizeQuestion(value: string): string {
  // Operators and punctuation distinguish different questions and must survive identity checks.
  return value.normalize('NFKC').toLowerCase().replace(/\s+/gu, '').trim();
}

export function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const pairs = new Map<string, number>();
  for (let i = 0; i < left.length - 1; i++) {
    const pair = left.slice(i, i + 2);
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }
  let matches = 0;
  for (let i = 0; i < right.length - 1; i++) {
    const pair = right.slice(i, i + 2);
    const count = pairs.get(pair) ?? 0;
    if (count > 0) {
      matches++;
      pairs.set(pair, count - 1);
    }
  }
  return 2 * matches / (left.length + right.length - 2);
}

export function isCode(value: string): boolean {
  return /\b(?:function|def|class|public|private|return|const|let|var|int|void|printf|console\.log)\b|#include|=>|\bfor\s*\(/u.test(value)
    && /[;|{}]/u.test(value);
}

export function splitAnswer(value: string, separators = DEFAULT_SEPARATORS): string[] {
  const text = value.trim();
  if (!text) return [];
  try {
    const json: unknown = JSON.parse(text);
    if (Array.isArray(json)) return json.map(String).map(s => s.trim()).filter(Boolean);
  } catch { /* A plain-text answer is valid. */ }
  for (const separator of separators.length ? separators : DEFAULT_SEPARATORS) {
    if (!separator || (isCode(text) && /[;|\uFF1B]/u.test(separator))) continue;
    if (text.includes(separator)) return text.split(separator).map(s => s.trim()).filter(Boolean);
  }
  return [text];
}

export function letterIndices(answer: string, count: number): number[] {
  const text = answer.trim().replace(/[,\uFF0C.\u3002\uFF0E\u3001 #;|]/gu, '');
  if (!/^[A-Z]{1,8}$/u.test(text)) return [];
  const indices = [...text].map(c => c.charCodeAt(0) - 65);
  if (new Set(indices).size !== indices.length || indices.some(i => i >= count)) return [];
  if (indices.some((n, i) => i > 0 && n <= indices[i - 1]!)) return [];
  return indices;
}

const TRUE_WORDS = ['true', 't', 'yes', '1', '\u662F', '\u5BF9', '\u6B63\u786E', '\u786E\u5B9A', '\u5BF9\u7684', '\u662F\u7684', '\u6B63\u786E\u7684', '\u221A', '\u2713'];
const FALSE_WORDS = ['false', 'f', 'no', '0', 'x', '\u975E', '\u5426', '\u9519', '\u9519\u8BEF', '\u9519\u7684', '\u4E0D\u5BF9', '\u4E0D\u6B63\u786E', '\u4E0D\u6B63\u786E\u7684', '\u4E0D\u662F', '\u4E0D\u662F\u7684', '\u00D7'];

export function booleanValue(value: string): boolean | undefined {
  const text = stripLabel(value).trim().toLowerCase();
  if (TRUE_WORDS.includes(text)) return true;
  if (FALSE_WORDS.includes(text)) return false;
  return undefined;
}

export function questionKey(question: { title: string; type: string; options: string[]; blanks: number; images: string[] }): string {
  return JSON.stringify([question.type, normalizeQuestion(question.title), question.options.map(normalizeQuestion), question.blanks, question.images]);
}
