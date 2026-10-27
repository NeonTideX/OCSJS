import type { Selectors, Settings } from '../core/types';

export function queryAll<T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] {
  if (!selector.trim()) return [];
  try { return [...root.querySelectorAll<T>(selector)]; }
  catch { throw new Error(`Invalid CSS selector: ${selector}`); }
}

export function visible(element: Element): boolean {
  const win = element.ownerDocument.defaultView;
  if (!win || !element.isConnected || element.closest('[hidden],[inert],#ocsjs-panel')) return false;
  const style = win.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

export function documents(root: Document): Document[] {
  const found: Document[] = [];
  const visit = (doc: Document, depth: number) => {
    if (depth > 8 || found.includes(doc)) return;
    found.push(doc);
    for (const frame of queryAll<HTMLIFrameElement>(doc, 'iframe,frame')) {
      try { if (visible(frame) && frame.contentDocument) visit(frame.contentDocument, depth + 1); }
      catch { /* Cross-origin frames run their own userscript instance. */ }
    }
  };
  visit(root, 0);
  return found;
}

export function readText(element: Element, glyphMap: Settings['glyphMap'] = {}): { text: string; images: string[] } {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('script,style,input,textarea,button,[aria-hidden="true"],.ocsjs-status').forEach(node => node.remove());
  const images: string[] = [];
  for (const image of copy.querySelectorAll('img')) {
    const source = image.getAttribute('data-src') || image.getAttribute('src');
    if (!source) continue;
    try {
      const url = new URL(source, element.ownerDocument.baseURI);
      if (['https:', 'http:'].includes(url.protocol) || (source.length <= 1_000_000 && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/iu.test(source))) {
        images.push(url.href);
        image.replaceWith(` [Image ${images.length}${image.getAttribute('alt') ? `: ${image.getAttribute('alt')}` : ''}] `);
      }
    } catch { /* Invalid image URLs do not affect text extraction. */ }
  }
  const text = [...(copy.textContent ?? '')].map(character => glyphMap[character] ?? character).join('').replace(/\s+/gu, ' ').trim();
  return { text, images };
}

export function setField(field: Element, value: string): void {
  const doc = field.ownerDocument;
  const win = doc.defaultView!;
  if (field.tagName === 'IFRAME') {
    let body: HTMLElement | undefined;
    try { body = (field as HTMLIFrameElement).contentDocument?.body; } catch { /* Report below. */ }
    if (!body) throw new Error('The rich-text editor is inaccessible');
    body.textContent = value;
    body.dispatchEvent(new body.ownerDocument.defaultView!.Event('input', { bubbles: true }));
    body.dispatchEvent(new body.ownerDocument.defaultView!.Event('change', { bubbles: true }));
    return;
  }
  if (field.matches('input,textarea')) {
    const prototype = field.tagName === 'INPUT' ? win.HTMLInputElement.prototype : win.HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(field, value); else (field as HTMLInputElement).value = value;
  } else if ((field as HTMLElement).isContentEditable) field.textContent = value;
  else throw new Error('Unsupported editable field');
  field.dispatchEvent(new win.Event('input', { bubbles: true }));
  field.dispatchEvent(new win.Event('change', { bubbles: true }));
  field.dispatchEvent(new win.Event('blur', { bubbles: true }));
}

export function isSelected(option: Element): boolean {
  const input = option.matches('input') ? option as HTMLInputElement : option.querySelector<HTMLInputElement>('input');
  return input?.checked === true || option.matches('.is-checked,.checked,.selected,[aria-checked="true"]');
}

export function selectOption(option: HTMLElement, desired: boolean, multiple: boolean): void {
  const selected = isSelected(option);
  if (selected === desired || (!multiple && !desired)) return;
  const input = option.matches('input') ? option : option.querySelector<HTMLInputElement>('input:not([disabled])');
  // Native radio/checkbox activation updates both DOM state and framework change handlers.
  if (input) {
    input.click();
    if ((input as HTMLInputElement).checked !== desired) throw new Error('The page rejected the selection. Apply it manually.');
  } else option.click();
}

export function completed(element: Element, selectors: Selectors): boolean {
  if (element.matches(selectors.completed) || element.querySelector(selectors.completed)) return true;
  const text = element.textContent ?? '';
  const fraction = text.match(/(\d+)\s*\/\s*(\d+)/u);
  if (fraction && Number(fraction[2]) > 0) return Number(fraction[1]) >= Number(fraction[2]);
  return /(?:100\s*%|\u5DF2\u5B8C\u6210|\u5DF2\u5B66\u5B8C|\u5DF2\u5B66\u4E60)/u.test(text);
}

export function active(element: Element, selectors: Selectors): boolean {
  return element.matches(selectors.active) || !!element.querySelector(selectors.active);
}

export function clickReady(root: ParentNode, selector: string): boolean {
  const element = queryAll<HTMLElement>(root, selector).find(node => visible(node) && !node.matches(':disabled,[aria-disabled="true"],.disabled'));
  if (!element) return false;
  element.click(); return true;
}

export function installCopyAccess(doc: Document, signal: AbortSignal): void {
  const style = doc.createElement('style');
  style.textContent = 'body :not(input):not(textarea){user-select:text!important;-webkit-user-select:text!important}';
  doc.head.append(style);
  const allow = (event: Event) => event.stopImmediatePropagation();
  for (const name of ['copy', 'cut', 'paste', 'contextmenu', 'selectstart']) doc.addEventListener(name, allow, { capture: true, signal });
  signal.addEventListener('abort', () => style.remove(), { once: true });
}

export function download(doc: Document, name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = doc.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
