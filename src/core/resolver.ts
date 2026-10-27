import type { Question, Resolution } from './types';
import { booleanValue, letterIndices, normalize, similarity, splitAnswer } from './text';

const miss = (reason = 'No reliable match'): Resolution => ({ finish: false, indices: [], values: [], confidence: 0, reason });
const hit = (indices: number[], confidence = 1): Resolution => ({ finish: true, indices, values: [], confidence, reason: confidence === 1 ? 'Exact match' : 'Text similarity' });

export function rankOptions(answers: string[], options: string[]): number[] {
  return options.map(option => Math.max(0, ...answers.map(answer => similarity(normalize(answer), normalize(option)))));
}

export function disambiguate(options: string[], ratings: number[], threshold = 0.6): number[] {
  const retained: number[] = [];
  const candidates = options.map((_, i) => i).sort((a, b) => ratings[b]! - ratings[a]! || a - b);
  for (const index of candidates) {
    if (!retained.some(other => similarity(normalize(options[index]!), normalize(options[other]!)) > threshold)) retained.push(index);
  }
  return retained.sort((a, b) => a - b);
}

export function resolve(question: Question, rawAnswers: string[]): Resolution {
  const { type, options, blanks } = question;
  const groups = rawAnswers.map(answer => splitAnswer(answer)).filter(group => group.length > 0);
  if (!groups.length) return miss('No answers available');
  if (type === 'completion') {
    if (blanks < 1) return miss('No editable fields');
    for (const values of groups) {
      if (values.length === blanks || blanks === 1) return { ...hit([]), values: blanks === 1 ? [values.join(' ')] : values };
    }
    return miss('Answer count does not match the editable fields');
  }
  if (!options.length) return miss('No options available');
  if (type === 'judgement') {
    for (const answer of groups.flat()) {
      const value = booleanValue(answer);
      if (value === undefined) continue;
      const index = options.findIndex(option => booleanValue(option) === value);
      if (index >= 0) return hit([index]);
    }
    return miss();
  }
  const normalized = options.map(normalize);
  if (type === 'single') {
    const answers = groups.flat().map(normalize).filter(Boolean);
    for (const answer of answers) {
      const exact = normalized.flatMap((option, i) => option && answer === option ? [i] : []);
      if (exact.length === 1) return hit(exact);
      if (exact.length > 1) return miss('Identical option texts require review');
    }
    // Prefer the longest option contained by a complete answer.
    for (const answer of answers) {
      const candidates = normalized.map((option, i) => ({ option, i })).filter(({ option }) => option && answer.includes(option)).sort((a, b) => b.option.length - a.option.length);
      if (candidates.length && (candidates.length === 1 || candidates[0]!.option.length > candidates[1]!.option.length)) return hit([candidates[0]!.i], 0.9);
    }
    for (const answer of rawAnswers) {
      const indices = letterIndices(answer, options.length);
      if (indices.length === 1) return hit(indices);
    }
    const combined = groups.filter(g => g.length > 1).map(g => normalize(g.join('')));
    const exactCombined = normalized.findIndex(option => option && combined.includes(option));
    if (exactCombined >= 0) return hit([exactCombined]);
    const scores = rankOptions(groups.flat(), options).map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score);
    const best = scores[0]!;
    // Split fragments must cover the whole option, rather than a partial slogan or sentence.
    if (groups.some(g => g.length > 1)) return miss('Fragmented answer does not fully cover an option');
    if (best.score > 0.6 && best.score - (scores[1]?.score ?? 0) >= 0.08) return hit([best.index], best.score);
    return miss('Ambiguous or incomplete option match');
  }
  for (const group of groups) {
    const letters = letterIndices(group.join(''), options.length);
    if (letters.length) return hit(letters);
    const answers = group.map(normalize).filter(Boolean);
    const exact = normalized.map((option, i) => ({ option, i })).filter(({ option }) => option && answers.includes(option));
    // Exact answers are independent; similar but explicitly named options must both survive.
    if (exact.length) {
      const matched = new Set(exact.map(({ option }) => option));
      if (answers.every(answer => matched.has(answer))) return hit(exact.map(({ i }) => i));
    }
    const ratings = rankOptions(group, options);
    const candidates = options.map((_, i) => i).filter(i => {
      const option = normalized[i]!;
      return option && answers.some(answer => answer === option || answer.includes(option)) || ratings[i]! > 0.6;
    });
    const retained = disambiguate(candidates.map(i => options[i]!), candidates.map(i => ratings[i]!)).map(i => candidates[i]!);
    if (retained.length) return hit(retained, Math.min(...retained.map(i => ratings[i]!)));
  }
  return miss();
}
