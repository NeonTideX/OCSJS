import type { Question, Resolution, Selectors, Settings } from '../core/types';
import { booleanValue, questionKey } from '../core/text';
import { queryAll, readText, selectOption, setField, visible } from './dom';

export interface BoundQuestion {
  id: string;
  question: Question;
  root: HTMLElement;
  options: HTMLElement[];
  fields: Element[];
  alive: () => boolean;
  apply: (resolution: Resolution) => void;
}

function identifyType(root: HTMLElement, options: HTMLElement[], fields: Element[], texts: string[]): Question['type'] {
  const hint = root.getAttribute('data-type') ?? root.querySelector('.item-type,.questionTit,.type')?.textContent ?? '';
  if (/multiple|\u591A\u9009/u.test(hint) || root.querySelector('input[type="checkbox"],.el-checkbox,.ivu-checkbox')) return 'multiple';
  if (/judgement|true.?false|\u5224\u65AD/iu.test(hint) || (texts.length === 2 && texts.every(text => booleanValue(text) !== undefined))) return 'judgement';
  if (/completion|essay|\u586B\u7A7A|\u7B80\u7B54|\u8BBA\u8FF0/iu.test(hint) || (!options.length && fields.length)) return 'completion';
  return 'single';
}

function bind(root: HTMLElement, selectors: Selectors, settings: Settings): BoundQuestion | undefined {
  const titleElements = queryAll(root, selectors.title);
  const titles = titleElements.filter(element => !titleElements.some(other => other !== element && other.contains(element)));
  const parts = titles.map(element => readText(element, settings.glyphMap));
  const title = parts.map(part => part.text).filter(Boolean).join(' ').replace(/^\s*\d+[.\u3001]\s*/u, '').trim();
  if (!title && !parts.some(part => part.images.length)) return undefined;
  const candidates = queryAll<HTMLElement>(root, selectors.options).filter(visible);
  const options = candidates.filter(element => !candidates.some(other => other !== element && other.contains(element)));
  const optionTexts = options.map(option => readText(option, settings.glyphMap));
  const fields = queryAll(root, selectors.blanks).filter(element => visible(element) && !element.closest('.optionList,.choices,.questionOptions li') && !element.matches(':disabled,[readonly]'));
  const type = identifyType(root, options, fields, optionTexts.map(part => part.text));
  const question: Question = {
    title, type, options: type === 'completion' ? [] : optionTexts.map((part, i) => {
      const input = options[i]!.querySelector<HTMLInputElement>('input');
      if (type === 'judgement' && input && ['true', 'false'].includes(input.value)) return input.value;
      return part.text;
    }),
    images: [...new Set([...parts, ...optionTexts].flatMap(part => part.images))],
    blanks: fields.length
  };
  const key = questionKey(question);
  const bound: BoundQuestion = {
    id: key, question, root, options, fields,
    alive: () => {
      if (!root.isConnected || !visible(root)) return false;
      const current = bindSnapshot(root, selectors, settings);
      return current === key;
    },
    apply: resolution => {
      if (!resolution.finish) throw new Error('No resolved answer to apply');
      if (!bound.alive()) throw new Error('The question changed. Search the current question again.');
      if (type === 'completion') {
        if (resolution.values.length !== fields.length) throw new Error('The editable fields changed');
        fields.forEach((field, index) => {
          if (!field.isConnected || !bound.alive()) throw new Error('The editable question changed during application');
          setField(field, resolution.values[index]!);
        });
      } else {
        options.forEach((option, index) => {
          if (!option.isConnected || !bound.alive()) throw new Error('The question changed during selection');
          selectOption(option, resolution.indices.includes(index), type === 'multiple');
        });
      }
    }
  };
  return bound;
}

// Snapshot creation shares the extractor, but never calls the bound alive/apply closures.
function bindSnapshot(root: HTMLElement, selectors: Selectors, settings: Settings): string | undefined {
  return bind(root, selectors, settings)?.id;
}

export function findQuestions(doc: Document, selectors: Selectors, settings: Settings): BoundQuestion[] {
  const candidates = queryAll<HTMLElement>(doc, selectors.questions).filter(visible);
  const roots = candidates.filter(element => !candidates.some(other => other !== element && other.contains(element)));
  return roots.map(root => bind(root, selectors, settings)).filter((value): value is BoundQuestion => value !== undefined);
}
