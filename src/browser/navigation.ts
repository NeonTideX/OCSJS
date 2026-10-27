export interface Point { id: string; name: string; required?: number; finished?: number }

export function collectPoints(value: unknown): Point[] {
  const found = new Map<string, Point>();
  const visited = new WeakSet<object>();
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || visited.has(node) || depth > 30) return;
    visited.add(node);
    if (Array.isArray(node)) { node.forEach(item => visit(item, depth + 1)); return; }
    const data = node as Record<string, unknown>;
    const rawId = data.knowledgeId ?? data.pointId ?? data.classId;
    if (typeof rawId === 'string' || typeof rawId === 'number') {
      const id = String(rawId);
      const point: Point = { id, name: String(data.knowledgeName ?? data.pointName ?? data.name ?? data.title ?? id) };
      const total = data.resourceCount ?? data.totalCount;
      const done = data.finishedResourceCount ?? data.finishResourceCount ?? data.finishedCount ?? data.finishCount;
      if (typeof total === 'number' && Number.isFinite(total) && total >= 0) point.required = total;
      if (typeof done === 'number' && Number.isFinite(done) && done >= 0) point.finished = done;
      found.set(id, point);
    }
    Object.values(data).forEach(item => visit(item, depth + 1));
  };
  visit(value, 0);
  return [...found.values()];
}

export function nextPoint(points: Point[], currentId: string, mode: 'unfinished' | 'all', skipped = new Set<string>()): Point | undefined {
  const current = points.findIndex(point => point.id === currentId);
  const after = points.slice(current + 1);
  const candidates = mode === 'all' ? after : [...after, ...points.slice(0, Math.max(0, current))];
  return candidates.find(point => !skipped.has(point.id) && (mode === 'all' || point.required === undefined || point.finished === undefined || point.required <= 0 || point.finished < point.required));
}

export function pointUrl(href: string, id: string): string {
  const url = new URL(href);
  if (/\/learnPage\/[^/]+\/[^/]+/u.test(url.pathname)) url.pathname = url.pathname.replace(/(\/learnPage\/[^/]+\/)\w+/u, `$1${encodeURIComponent(id)}`);
  else {
    if (!url.searchParams.has('classId') && !url.searchParams.has('nodeUid')) throw new Error('Unknown knowledge-point route');
    for (const key of ['classId', 'nodeUid']) if (url.searchParams.has(key)) url.searchParams.set(key, id);
  }
  return url.href;
}
