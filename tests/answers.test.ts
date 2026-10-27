import { test } from 'node:test';
import assert from 'node:assert/strict';
import cases from './cases.json';
import { resolve, disambiguate, rankOptions } from '../src/core/resolver';
import { normalize, splitAnswer, letterIndices } from '../src/core/text';
import type { Question } from '../src/core/types';

const question = (type: Question['type'], options: string[] = [], blanks = 0): Question => ({ title: 'Test question', type, options, blanks, images: [] });
for (const type of ['single', 'multiple', 'judgement'] as const) {
  cases[type].forEach((entry, index) => test(`Historical ${type} case ${index + 1}`, () => {
    const answer = resolve(question(type, entry.opts), [entry.a]);
    assert.deepEqual(answer.finish ? answer.indices.map(i => i + 1) : [], entry.expect);
  }));
}
cases.disambiguation.forEach((entry, index) => test(`Historical disambiguation case ${index + 1}`, () => {
  const ratings = rankOptions(splitAnswer(entry.a), entry.opts);
  const candidates = entry.opts.map((_, i) => i).filter(i => ratings[i]! > 0.6);
  const result = disambiguate(candidates.map(i => entry.opts[i]!), candidates.map(i => ratings[i]!));
  assert.deepEqual(result.map(i => candidates[i]! + 1), entry.expect);
}));
cases.completion.forEach((entry, index) => test(`Historical completion case ${index + 1}`, () => {
  const result = resolve(question('completion', [], entry.blanks), entry.a.split(' / '));
  assert.deepEqual(result.values, entry.expect);
}));

test('Choice labels preserve abbreviations and units', () => {
  assert.equal(normalize('TCP/IP'), 'tcpip');
  assert.equal(normalize('16MB'), '16mb');
  assert.equal(normalize('A. Alpha'), 'alpha');
});
test('Letter answers reject duplicates and invalid ranges', () => {
  assert.deepEqual(letterIndices('AA', 4), []);
  assert.deepEqual(letterIndices('AZ', 4), []);
  assert.deepEqual(letterIndices('BAC', 4), []);
});
test('Two explicitly named similar choices remain selected', () => {
  assert.deepEqual(resolve(question('multiple', ['Network', 'Network protocol', 'Database']), ['Network#Network protocol']).indices, [0, 1]);
});
test('Identical choices need review rather than arbitrary selection', () => {
  assert.equal(resolve(question('single', ['Alpha', 'Alpha']), ['Alpha']).finish, false);
});
