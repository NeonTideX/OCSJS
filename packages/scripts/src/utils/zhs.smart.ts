const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function waitFor<T>(
	predicate: () => T,
	opts?: { timeout_seconds?: number; check_period_ms?: number }
): Promise<T> {
	return new Promise<T>((resolve) => {
		let timeout: any;
		const interval = setInterval(() => {
			const result = predicate();
			if (result) {
				clearInterval(interval);
				if (timeout) clearTimeout(timeout);
				resolve(result);
			}
		}, opts?.check_period_ms || 1000);

		if (opts?.timeout_seconds) {
			timeout = setTimeout(() => {
				clearInterval(interval);
				resolve(undefined as any);
			}, (opts?.timeout_seconds || 10) * 1000);
		}
	});
}

/**
 * Knowledge point ID regular expression (6 to 22 numeric digits).
 */
export const KG_POINT_ID_RE = /^\d{6,22}$/;

/**
 * Session storage key prefix for unplayable or skimmed knowledge points.
 */
export const KG_UNPLAYABLE_KEY = 'ocs-smart-study-unplayable';

/**
 * Gateway API base URLs for Zhihuishu Smart Study (Knowledge Graph).
 */
export const KG_API_BASE = 'https://kg-ai-run.zhihuishu.com/run/gateway/t/stu';
export const KG_API_BASE_COMMON = 'https://kg-ai-run.zhihuishu.com/run/gateway/t/common';

/**
 * CSS selectors representing chapter/unit/module rows in the sidebar.
 */
export const ROW_SELECTORS = [
	'.section-item-collapse-info',
	'.collapse-item-sub',
	'.section-item',
	'.chapter-item'
];

/**
 * Known property pairs representing [finishedCount, totalCount] in backend responses.
 */
export const KG_PROGRESS_PAIRS: [string, string][] = [
	['finishedResourceCount', 'resourceCount'],
	['finishResourceCount', 'resourceCount'],
	['finishedCount', 'totalCount'],
	['finishCount', 'totalCount'],
	['learnedCount', 'totalCount'],
	['studiedCount', 'totalCount'],
	['doneCount', 'totalCount']
];

export interface KgRouteInfo {
	courseId: string;
	classId: string;
	nodeUid: string;
}

export interface KgPoint {
	pointId: string;
	pointName: string;
	moduleId?: string;
	moduleName?: string;
	unitId?: string;
	unitName?: string;
	required?: number;
	finished?: number;
}

export interface KgUnit {
	unitId: string;
	unitName: string;
	points: KgPoint[];
}

export interface KgModule {
	moduleId: string;
	moduleName: string;
	units: KgUnit[];
}

export interface KgResourceItem {
	resourcesUid: string;
	resourcesName: string;
	studyStatus: number | null;
	resourcesDataType: number | null;
	resourcesSyncType?: number | null;
}

export interface KgTrafficEntry {
	url: string;
	method: string;
	body: string;
	json: any;
	time: number;
}

export interface KgCapturedData {
	traffic: KgTrafficEntry[];
	requestHeaders: Record<string, Record<string, string>>;
	encryptedSeen: boolean;
	plainSeen: boolean;
}

export interface KgCryptoPair {
	pageWin: any;
	encFn: (payload: any, key: any) => string;
	keyFn: (keyType: number) => any;
	keyPromise?: Promise<any>;
}

// ---------------------------------------------------------------------------
// Normalizers and general utility functions
// ---------------------------------------------------------------------------

export function kgToArray<T>(value: any): T[] {
	return Array.isArray(value) ? value : [];
}

export function kgPick<T>(obj: any, keys: string[], fallback: T): T {
	if (!obj || typeof obj !== 'object') {
		return fallback;
	}
	for (const key of keys) {
		const val = obj[key];
		if (val !== undefined && val !== null && val !== '') {
			return val as T;
		}
	}
	return fallback;
}

export function kgSafeJsonParse(text: string): any {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

export function kgIsSuccessResponse(data: any): boolean {
	if (!data || typeof data !== 'object') {
		return false;
	}
	return data.code === 200 || data.code === 0 || data.success === true;
}

/**
 * Extracts required and finished count from an embedded progress object or string.
 */
export function kgExtractProgressFromObject(
	obj: any,
	depth = 0,
	maxDepth = 8
): { required: number; finished: number } | null {
	if (!obj || typeof obj !== 'object' || depth > maxDepth) {
		return null;
	}

	if (Array.isArray(obj)) {
		for (const item of obj) {
			const found = kgExtractProgressFromObject(item, depth + 1, maxDepth);
			if (found) {
				return found;
			}
		}
		return null;
	}

	for (const key of Object.keys(obj)) {
		const value = obj[key];
		if (typeof value === 'string' && value.includes('必学')) {
			const match = /必学[：:]?\s*(\d+)\s*\/\s*(\d+)/.exec(value);
			if (match) {
				return { required: Number(match[2]), finished: Number(match[1]) };
			}
		}
	}

	for (const pair of KG_PROGRESS_PAIRS) {
		const rawFinished = obj[pair[0]];
		const rawRequired = obj[pair[1]];
		if (rawFinished == null || rawRequired == null) {
			continue;
		}
		const finished = Number(rawFinished);
		const required = Number(rawRequired);
		if (Number.isFinite(finished) && Number.isFinite(required) && required > 0 && finished >= 0) {
			return { required, finished };
		}
	}

	for (const key of Object.keys(obj)) {
		const child = obj[key];
		if (child && typeof child === 'object') {
			const found = kgExtractProgressFromObject(child, depth + 1, maxDepth);
			if (found) {
				return found;
			}
		}
	}

	return null;
}

export function kgParsePoint(p: any): KgPoint {
	const point: KgPoint = {
		pointId: String(kgPick(p, ['knowledgeId', 'pointId', 'id', 'nodeUid'], '')),
		pointName: String(kgPick(p, ['knowledgeName', 'pointName', 'name', 'title'], '未命名知识点'))
	};
	const progress = kgExtractProgressFromObject(p, 0, 3);
	if (progress) {
		point.required = progress.required;
		point.finished = progress.finished;
	}
	return point;
}

export function kgParsePoints(container: any, keys: string[]): KgPoint[] {
	return kgToArray(kgPick(container, keys, [])).map(kgParsePoint);
}

export function kgParseUnit(unit: any, idKeys: string[], nameKeys: string[]): KgUnit {
	return {
		unitId: String(kgPick(unit, idKeys, '')),
		unitName: String(kgPick(unit, nameKeys, '未命名单元')),
		points: kgParsePoints(unit, ['knowledgeList', 'pointList', 'children'])
	};
}

/**
 * Normalizes /knowledge-study/get-course-knowledge-dic response.
 */
export function kgNormalizeKnowledgeDic(raw: any): KgModule[] {
	const root = kgPick(raw, ['data'], raw) || {};
	const themeList = kgToArray(kgPick(root, ['themeList', 'list'], []));
	return themeList.map((theme: any) => {
		const units = kgToArray(
			kgPick(theme, ['subThemeList', 'unitList', 'children'], [])
		).map((unit: any) =>
			kgParseUnit(
				unit,
				['subThemeId', 'unitId', 'id', 'nodeUid', 'themeId', 'catalogId'],
				['subThemeName', 'unitName', 'name', 'title', 'themeName', 'catalogName']
			)
		);
		if (!units.length) {
			units.push({
				unitId: '',
				unitName: '默认单元',
				points: kgParsePoints(theme, ['knowledgeList', 'pointList'])
			});
		}
		return {
			moduleId: String(kgPick(theme, ['themeId', 'moduleId', 'id'], '')),
			moduleName: String(kgPick(theme, ['themeName', 'moduleName', 'name', 'title'], '未命名模块')),
			units
		};
	});
}

/**
 * Normalizes /course/query-module-info response.
 */
export function kgNormalizeModuleInfo(raw: any): KgModule[] {
	const root = kgPick(raw, ['data'], raw) || {};
	return kgToArray(kgPick(root, ['moduleList', 'modules', 'list'], [])).map((mod: any) => ({
		moduleId: String(kgPick(mod, ['moduleId', 'id', 'themeId'], '')),
		moduleName: String(kgPick(mod, ['moduleName', 'name', 'themeName', 'title'], '未命名模块')),
		units: kgToArray(kgPick(mod, ['unitList', 'children', 'subList'], [])).map((unit: any) =>
			kgParseUnit(unit, ['unitId', 'id', 'subThemeId'], ['unitName', 'name', 'subThemeName', 'title'])
		)
	}));
}

/**
 * Normalizes /maptree/get-theme-node-list response.
 */
export function kgNormalizeThemeNodeList(raw: any): KgModule[] {
	const root = kgPick(raw, ['data'], raw) || {};
	const themeList = kgPick(root, ['themeList', 'list', 'data'], []);
	return kgNormalizeKnowledgeDic({ data: { themeList } });
}

/**
 * Counts direct child nodes matching knowledge point ID pattern.
 */
export function kgCountDirectPoints(node: any): number {
	if (!node || typeof node !== 'object') {
		return 0;
	}
	for (const key of Object.keys(node)) {
		const child = node[key];
		if (!Array.isArray(child)) {
			continue;
		}
		const count = child.filter(
			(item: any) =>
				item &&
				typeof item === 'object' &&
				KG_POINT_ID_RE.test(String(kgPick(item, ['knowledgeId', 'pointId', 'classId'], '') || ''))
		).length;
		if (count > 0) {
			return count;
		}
	}
	return 0;
}

/**
 * Recursively extracts leaf points from an arbitrary course tree structure.
 */
export function kgExtractPointsDeep(root: any): KgPoint[] {
	const out: KgPoint[] = [];
	const seen = new Set<string>();
	const pointIdOf = (node: any) => String(kgPick(node, ['knowledgeId', 'pointId', 'classId'], '') || '');

	const walk = (node: any, depth: number, ctx: { moduleName: string; unitName: string }) => {
		if (!node || typeof node !== 'object' || depth > 12 || out.length >= 800) {
			return;
		}
		if (Array.isArray(node)) {
			for (const item of node) {
				walk(item, depth + 1, ctx);
			}
			return;
		}

		const idStr = pointIdOf(node);
		const name = String(
			kgPick(
				node,
				['knowledgeName', 'pointName', 'name', 'title', 'subThemeName', 'unitName', 'themeName'],
				''
			) || ''
		);
		const childPointCount = kgCountDirectPoints(node);

		if (KG_POINT_ID_RE.test(idStr) && name && childPointCount === 0 && !seen.has(idStr)) {
			seen.add(idStr);
			const point: KgPoint = {
				pointId: idStr,
				pointName: name,
				moduleName: ctx.moduleName,
				unitName: ctx.unitName
			};
			const progress = kgExtractProgressFromObject(node, 0, 3);
			if (progress) {
				point.required = progress.required;
				point.finished = progress.finished;
			}
			out.push(point);
		}

		const nextCtx = { moduleName: ctx.moduleName, unitName: ctx.unitName };
		const moduleName = kgPick(node, ['themeName', 'moduleName'], '');
		if (moduleName) {
			nextCtx.moduleName = String(moduleName);
		}
		const unitName = kgPick(node, ['subThemeName', 'unitName'], '');
		if (unitName) {
			nextCtx.unitName = String(unitName);
		}

		for (const key of Object.keys(node)) {
			const child = node[key];
			if (child && typeof child === 'object') {
				walk(child, depth + 1, nextCtx);
			}
		}
	};

	walk(root, 0, { moduleName: '', unitName: '' });
	return out;
}

/**
 * Flattens nested modules into a linear ordered list of points preserving course hierarchy.
 */
export function kgFlattenPoints(modules: KgModule[]): KgPoint[] {
	const out: KgPoint[] = [];
	for (const mod of modules || []) {
		for (const unit of mod.units || []) {
			for (const point of unit.points || []) {
				out.push({
					moduleId: mod.moduleId || '',
					moduleName: mod.moduleName || '',
					unitId: unit.unitId || '',
					unitName: unit.unitName || '',
					pointId: String(point.pointId || ''),
					pointName: point.pointName || '',
					required: point.required,
					finished: point.finished
				});
			}
		}
	}
	return out;
}

/**
 * Normalizes raw resource list from /resources/list-knowledge-resource response.
 */
export function kgGetResourceList(json: any): any[] {
	const data = kgPick(json, ['data'], null);
	const list = kgPick(data, ['resourceList'], kgPick(json, ['resourceList'], []));
	if (!Array.isArray(list)) {
		return [];
	}
	return list
		.map((item: any) => {
			if (!item || typeof item !== 'object') {
				return null;
			}
			const detail = kgPick(item, ['resourcesDetail'], null);
			const merged = { ...(detail && typeof detail === 'object' ? detail : item) };
			if (item.studyStatus !== undefined) {
				merged.studyStatus = item.studyStatus;
			}
			if (item.schedule !== undefined) {
				merged.schedule = item.schedule;
			}
			if (item.studyTotalTime !== undefined) {
				merged.studyTotalTime = item.studyTotalTime;
			}
			if (item.resourcesSyncType !== undefined && merged.resourcesSyncType === undefined) {
				merged.resourcesSyncType = item.resourcesSyncType;
			}
			return merged;
		})
		.filter(Boolean);
}

/**
 * Normalizes required resources (resourcesSyncType === 1).
 */
export function kgNormalizeRequiredResources(json: any): KgResourceItem[] {
	return kgGetResourceList(json)
		.filter((r) => Number(r.resourcesSyncType) === 1)
		.map((r) => ({
			resourcesUid: String(r.resourcesUid || ''),
			resourcesName: String(r.resourcesName || ''),
			studyStatus: r.studyStatus === undefined ? null : Number(r.studyStatus),
			resourcesDataType: r.resourcesDataType === undefined ? null : Number(r.resourcesDataType),
			resourcesSyncType: Number(r.resourcesSyncType)
		}));
}

/**
 * Parses captured network responses to populate known point completion progress.
 */
export function kgCollectCapturedResourceProgress(
	capture: KgCapturedData | null
): Map<string, { required: number; finished: number }> {
	const map = new Map<string, { required: number; finished: number }>();
	if (!capture || !Array.isArray(capture.traffic)) {
		return map;
	}
	for (const entry of capture.traffic) {
		if (!entry || !/list-knowledge-resource/.test(entry.url)) {
			continue;
		}
		let pointId = '';
		if (entry.body) {
			const body = kgSafeJsonParse(entry.body);
			if (body) {
				pointId = String(kgPick(body, ['knowledgeId', 'nodeUid', 'pointId'], '') || '');
			}
			if (!pointId) {
				const match = /knowledgeId["'=:\s]+(\d{6,22})/.exec(entry.body);
				if (match) {
					pointId = match[1];
				}
			}
		}
		if (!pointId && entry.json) {
			pointId = String(
				kgPick(kgPick(entry.json, ['data'], null), ['knowledgeId', 'classId', 'pointId'], '') || ''
			);
		}
		if (!pointId || !KG_POINT_ID_RE.test(pointId) || !entry.json || !kgIsSuccessResponse(entry.json)) {
			continue;
		}
		const resources = kgNormalizeRequiredResources(entry.json);
		if (resources.length) {
			map.set(pointId, {
				required: resources.length,
				finished: resources.filter((resource) => Number(resource.studyStatus) === 1).length
			});
		}
	}
	return map;
}

// ---------------------------------------------------------------------------
// Route parsing and URL construction
// ---------------------------------------------------------------------------

export function kgParseRoute(
	loc: { pathname: string; search: string } = typeof location !== 'undefined'
		? location
		: { pathname: '', search: '' }
): KgRouteInfo | null {
	const seg = loc.pathname.split('/').filter(Boolean);
	const learnIdx = seg.indexOf('learnPage');
	if (learnIdx >= 0 && seg.length >= learnIdx + 4) {
		return { courseId: seg[learnIdx + 1], classId: seg[learnIdx + 2], nodeUid: seg[learnIdx + 3] };
	}
	const singleIdx = seg.indexOf('singleCourse');
	if (singleIdx >= 0 && seg[singleIdx + 1] === 'knowledgeStudy' && seg.length >= singleIdx + 4) {
		return { courseId: seg[singleIdx + 2], classId: seg[singleIdx + 3], nodeUid: seg[singleIdx + 3] };
	}
	const params = new URLSearchParams(loc.search);
	const courseId = params.get('courseId');
	const pointId = params.get('classId') || params.get('knowledgeId') || params.get('pointId');
	if (courseId && pointId) {
		return { courseId, classId: pointId, nodeUid: params.get('nodeUid') || pointId };
	}
	return null;
}

export function kgBuildPointUrl(
	pointId: string,
	route: KgRouteInfo,
	currentUrlStr: string = typeof location !== 'undefined' ? location.href : 'http://localhost'
): string {
	const url = new URL(currentUrlStr);
	const seg = url.pathname.split('/').filter(Boolean);
	const learnIdx = seg.indexOf('learnPage');
	if (learnIdx >= 0 && seg.length >= learnIdx + 4) {
		seg[learnIdx + 2] = String(pointId || '');
		url.pathname = '/' + seg.join('/');
		return url.toString();
	}
	const singleIdx = seg.indexOf('singleCourse');
	if (singleIdx >= 0 && seg[singleIdx + 1] === 'knowledgeStudy' && seg.length >= singleIdx + 4) {
		seg[singleIdx + 2] = route.courseId;
		seg[singleIdx + 3] = String(pointId || '');
		url.pathname = '/' + seg.join('/');
		return url.toString();
	}
	const params = url.searchParams;
	if (params.get('courseId') && (params.get('classId') || params.get('knowledgeId') || params.get('pointId'))) {
		for (const key of ['classId', 'knowledgeId', 'pointId']) {
			if (params.get(key)) {
				params.set(key, String(pointId || ''));
			}
		}
		return url.toString();
	}
	return '';
}

// ---------------------------------------------------------------------------
// Unplayable / skimmed tracking in sessionStorage
// ---------------------------------------------------------------------------

export function kgUnplayableKey(courseId: string): string {
	return KG_UNPLAYABLE_KEY + ':' + (courseId || '');
}

export function kgGetUnplayableSet(
	courseId: string,
	storage: Storage = typeof sessionStorage !== 'undefined' ? sessionStorage : ({} as any)
): Set<string> {
	try {
		if (typeof storage?.getItem !== 'function') {
			return new Set();
		}
		const raw = storage.getItem(kgUnplayableKey(courseId));
		const arr = kgSafeJsonParse(raw || '[]');
		return new Set(Array.isArray(arr) ? arr.map(String) : []);
	} catch {
		return new Set();
	}
}

export function kgMarkUnplayable(
	courseId: string,
	pointId: string,
	storage: Storage = typeof sessionStorage !== 'undefined' ? sessionStorage : ({} as any)
): void {
	if (!courseId || !pointId || typeof storage?.setItem !== 'function') {
		return;
	}
	try {
		const set = kgGetUnplayableSet(courseId, storage);
		set.add(String(pointId));
		storage.setItem(kgUnplayableKey(courseId), JSON.stringify(Array.from(set)));
	} catch {}
}

// ---------------------------------------------------------------------------
// Point progress state evaluation
// ---------------------------------------------------------------------------

export function kgPointProgressState(
	point: KgPoint,
	skipSet: Set<string>
): 'skip' | 'unknown' | 'finished' | 'unfinished' {
	if (skipSet.has(String(point.pointId))) {
		return 'skip';
	}
	if (point.required === undefined || point.finished === undefined) {
		return 'unknown';
	}
	return point.required > 0 && Number(point.finished) < point.required ? 'unfinished' : 'finished';
}

// ---------------------------------------------------------------------------
// Network traffic capture hook
// ---------------------------------------------------------------------------

function rememberHeaders(capture: KgCapturedData, url: string, headers: any): void {
	try {
		if (!url || !headers) return;
		const host = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost').host;
		if (!host || !/zhihuishu|kg-ai-run/.test(host)) return;
		const store = capture.requestHeaders[host] || (capture.requestHeaders[host] = {});

		if (typeof headers.forEach === 'function') {
			headers.forEach((value: any, key: any) => {
				store[String(key).toLowerCase()] = String(value);
			});
		} else if (Array.isArray(headers)) {
			for (const pair of headers) {
				if (pair && pair.length === 2) {
					store[String(pair[0]).toLowerCase()] = String(pair[1]);
				}
			}
		} else if (typeof headers === 'object') {
			for (const key of Object.keys(headers)) {
				store[String(key).toLowerCase()] = String(headers[key]);
			}
		}
	} catch {}
}

function recordTraffic(capture: KgCapturedData, url: string, method: string, body: string, text: string): void {
	try {
		if (!/zhihuishu\.com|kg-ai-run/.test(url)) {
			return;
		}
		if (body && body.includes('secretStr')) {
			capture.encryptedSeen = true;
		} else if (body && body.includes('courseId')) {
			capture.plainSeen = true;
		}
		let json = null;
		if (text && text.length < 2e6 && (text.charAt(0) === '{' || text.charAt(0) === '[')) {
			json = kgSafeJsonParse(text);
		}
		capture.traffic.push({
			url,
			method: String(method || 'GET').toUpperCase(),
			body: typeof body === 'string' ? body.slice(0, 4000) : '',
			json,
			time: Date.now()
		});
		if (capture.traffic.length > 150) {
			capture.traffic.shift();
		}
	} catch {}
}

/**
 * Injects fetch and XHR hooks on the host page window to observe knowledge graph traffic.
 */
export function initSmartNetworkHook(pageWin: any = (typeof window !== 'undefined' ? (window as any).unsafeWindow || window : undefined)): KgCapturedData | null {
	if (!pageWin) {
		return null;
	}
	if (pageWin.__ocsSmartCapture) {
		return pageWin.__ocsSmartCapture;
	}
	const captured: KgCapturedData = {
		traffic: [],
		requestHeaders: {},
		encryptedSeen: false,
		plainSeen: false
	};
	pageWin.__ocsSmartCapture = captured;

	try {
		const rawFetch = pageWin.fetch;
		if (typeof rawFetch === 'function' && !rawFetch.__ocsSmartHooked) {
			const hooked = function (this: any, input: any, init?: any) {
				try {
					const url = typeof input === 'string' ? input : (input && input.url) || '';
					const method = (init && init.method) || (input && input.method) || 'GET';
					const body = init && typeof init.body === 'string' ? init.body : '';
					rememberHeaders(captured, url, init && init.headers);
					const promise = rawFetch.apply(this, arguments);
					promise
						.then((res: any) => {
							try {
								if (!res || typeof res.clone !== 'function') return;
								const ct =
									res.headers && typeof res.headers.get === 'function'
										? String(res.headers.get('content-type') || '')
										: '';
								if (!/json|text/i.test(ct)) return;
								res
									.clone()
									.text()
									.then((t: string) => recordTraffic(captured, url, method, body, t))
									.catch(() => {});
							} catch {}
						})
						.catch(() => {});
					return promise;
				} catch {
					return rawFetch.apply(this, arguments);
				}
			};
			hooked.__ocsSmartHooked = true;
			pageWin.fetch = hooked;
		}
	} catch {}

	try {
		const XHR = pageWin.XMLHttpRequest;
		if (XHR && XHR.prototype && !XHR.prototype.__ocsSmartHooked) {
			const rawOpen = XHR.prototype.open;
			const rawSend = XHR.prototype.send;
			const rawSetHeader = XHR.prototype.setRequestHeader;

			XHR.prototype.open = function (this: any, method: string, url: string) {
				try {
					this.__ocsKG = { method: String(method || 'GET').toUpperCase(), url: String(url || '') };
				} catch {}
				return rawOpen.apply(this, arguments);
			};

			XHR.prototype.setRequestHeader = function (this: any, key: string, value: string) {
				try {
					if (this.__ocsKG) {
						this.__ocsKG.headers = this.__ocsKG.headers || {};
						this.__ocsKG.headers[key] = value;
					}
				} catch {}
				return rawSetHeader.apply(this, arguments);
			};

			XHR.prototype.send = function (this: any, body: any) {
				try {
					if (this.__ocsKG) {
						const url = this.__ocsKG.url;
						rememberHeaders(captured, url, this.__ocsKG.headers);
						const method = this.__ocsKG.method;
						const reqBody = typeof body === 'string' ? body : '';
						this.addEventListener('load', function (this: any) {
							try {
								const text = typeof this.responseText === 'string' ? this.responseText : '';
								recordTraffic(captured, url, method, reqBody, text);
							} catch {}
						});
					}
				} catch {}
				return rawSend.apply(this, arguments);
			};
			XHR.prototype.__ocsSmartHooked = true;
		}
	} catch {}

	return captured;
}

// ---------------------------------------------------------------------------
// Page crypto detection and encrypted request construction
// ---------------------------------------------------------------------------

let cachedCryptoPair: KgCryptoPair | null = null;

export function kgDetectPageCrypto(pageWin?: any): KgCryptoPair | null {
	if (!pageWin && typeof window !== 'undefined') {
		pageWin = (window as any).unsafeWindow || window;
	}
	if (!pageWin) return null;
	if (cachedCryptoPair && cachedCryptoPair.pageWin === pageWin) {
		return cachedCryptoPair;
	}

	const encFn = typeof pageWin.yxyz === 'function' ? pageWin.yxyz : undefined;
	const keyFn =
		typeof pageWin.l0a1b2c === 'function'
			? pageWin.l0a1b2c
			: typeof pageWin.labc === 'function'
			? pageWin.labc
			: undefined;

	if (encFn && keyFn) {
		cachedCryptoPair = { pageWin, encFn, keyFn };
		return cachedCryptoPair;
	}

	return null;
}

export async function kgBuildEncryptedBody(payload: any, cryptoPair: KgCryptoPair, keyType = 6): Promise<{ secretStr: string; date: number }> {
	const { pageWin, encFn, keyFn } = cryptoPair;
	if (!cryptoPair.keyPromise) {
		cryptoPair.keyPromise = Promise.resolve(keyFn.call(pageWin, keyType));
	}
	const key = await cryptoPair.keyPromise;
	if (key == null) {
		throw new Error('Failed to acquire crypto key for type: ' + keyType);
	}
	return {
		secretStr: encFn.call(pageWin, payload, key),
		date: Date.now()
	};
}

export function kgDetectedHeaders(url: string, capture: KgCapturedData | null): Record<string, string> {
	const headers: Record<string, string> = {};
	try {
		if (!capture || !capture.requestHeaders) {
			return headers;
		}
		const host = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost').host;
		const store = capture.requestHeaders[host] || {};
		for (const key of Object.keys(store)) {
			if (/^authorization$|^x-|token|sign|app-|device|channel|platform|client/.test(key)) {
				headers[key] = store[key];
			}
		}
	} catch {}
	return headers;
}

export async function kgRequestWithVariants(
	url: string,
	payloads: any[],
	options?: {
		capture?: KgCapturedData | null;
		cryptoPair?: KgCryptoPair | null;
		fetcher?: (url: string, init: any) => Promise<any>;
	}
): Promise<{ ok: boolean; data: any }> {
	const fetcher =
		options?.fetcher ||
		(typeof fetch !== 'undefined'
			? (u: string, init: any) => fetch(u, init).then((r) => r.json())
			: async () => null);

	const capture = options?.capture || null;
	const cryptoPair = options?.cryptoPair || kgDetectPageCrypto();
	const detectedHeaders = kgDetectedHeaders(url, capture);

	const postJson = async (p: any) => {
		return await fetcher(url, {
			method: 'POST',
			credentials: 'include',
			headers: { 'content-type': 'application/json', ...detectedHeaders },
			body: JSON.stringify(p)
		});
	};

	const postEncrypted = async (p: any) => {
		if (!cryptoPair) {
			throw new Error('No crypto available');
		}
		const encryptedBody = await kgBuildEncryptedBody(p, cryptoPair);
		return await fetcher(url, {
			method: 'POST',
			credentials: 'include',
			headers: {
				accept: 'application/json, text/plain, */*',
				'content-type': 'application/json;charset=UTF-8',
				...detectedHeaders
			},
			body: JSON.stringify(encryptedBody)
		});
	};

	const preferPlain = !!capture?.plainSeen && !capture?.encryptedSeen;
	const attempters = preferPlain && !cryptoPair
		? [postJson]
		: preferPlain
		? [postJson, postEncrypted]
		: cryptoPair
		? [postEncrypted, postJson]
		: [postJson];

	for (const payload of payloads) {
		for (const attempt of attempters) {
			try {
				const data = await attempt(payload);
				if (kgIsSuccessResponse(data)) {
					return { ok: true, data };
				}
			} catch {}
		}
	}

	return { ok: false, data: null };
}

// ---------------------------------------------------------------------------
// Course tree and resource fetching
// ---------------------------------------------------------------------------

let cachedModules: KgModule[] | null = null;
let cachedRawTree: any = null;

export async function kgFetchModules(
	route: KgRouteInfo,
	options?: {
		capture?: KgCapturedData | null;
		cryptoPair?: KgCryptoPair | null;
		requestFn?: (url: string, payloads: any[]) => Promise<{ ok: boolean; data: any }>;
	}
): Promise<{ modules: KgModule[]; raw: any }> {
	if (cachedModules && cachedModules.length) {
		return { modules: cachedModules, raw: cachedRawTree };
	}

	const req =
		options?.requestFn ||
		((url: string, payloads: any[]) =>
			kgRequestWithVariants(url, payloads, { capture: options?.capture, cryptoPair: options?.cryptoPair }));

	const basePayload = { courseId: route.courseId, classId: route.classId, dateFormate: Date.now() };
	const extPayload = { ...basePayload, knowledgeId: route.nodeUid, nodeUid: route.nodeUid };

	const [dicRes, moduleRes, themeRes] = await Promise.all([
		req(KG_API_BASE + '/knowledge-study/get-course-knowledge-dic', [basePayload, extPayload]),
		req(KG_API_BASE_COMMON + '/course/query-module-info', [basePayload, extPayload]),
		req(KG_API_BASE + '/maptree/get-theme-node-list', [basePayload, extPayload])
	]);

	const sources = [
		{ modules: dicRes.ok ? kgNormalizeKnowledgeDic(dicRes.data) : [], raw: dicRes.ok ? dicRes.data : null },
		{ modules: moduleRes.ok ? kgNormalizeModuleInfo(moduleRes.data) : [], raw: moduleRes.ok ? moduleRes.data : null },
		{ modules: themeRes.ok ? kgNormalizeThemeNodeList(themeRes.data) : [], raw: themeRes.ok ? themeRes.data : null }
	];

	let modules: KgModule[] = [];
	let rawTree: any = null;
	for (const source of sources) {
		if (source.modules.length) {
			modules = source.modules;
			rawTree = source.raw;
			break;
		}
	}
	if (!rawTree) {
		const firstRaw = sources.find((s) => s.raw);
		rawTree = firstRaw ? firstRaw.raw : null;
	}

	if (modules.length) {
		cachedModules = modules;
	}
	if (rawTree) {
		cachedRawTree = rawTree;
	}

	return { modules, raw: rawTree };
}

export function kgBuildResourcePayloadVariants(route: KgRouteInfo, pointId: string): any[] {
	const base = { courseId: route.courseId, classId: route.classId, dateFormate: Date.now() };
	const id = String(pointId || '');
	return [
		{ ...base, knowledgeId: id, nodeUid: id },
		{ ...base, knowledgeId: id },
		{ ...base, nodeUid: id }
	];
}

export async function kgFetchPointResources(
	route: KgRouteInfo,
	pointId: string,
	options?: {
		capture?: KgCapturedData | null;
		cryptoPair?: KgCryptoPair | null;
		requestFn?: (url: string, payloads: any[]) => Promise<{ ok: boolean; data: any }>;
	}
): Promise<KgResourceItem[] | null> {
	try {
		const req =
			options?.requestFn ||
			((url: string, payloads: any[]) =>
				kgRequestWithVariants(url, payloads, { capture: options?.capture, cryptoPair: options?.cryptoPair }));

		const res = await req(
			KG_API_BASE + '/resources/list-knowledge-resource',
			kgBuildResourcePayloadVariants(route, pointId)
		);
		if (!res.ok) {
			return null;
		}
		return kgNormalizeRequiredResources(res.data);
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Finding the next point via API
// ---------------------------------------------------------------------------

export async function kgFindNextPoint(
	route: KgRouteInfo,
	switchMode: 'job' | 'all',
	options?: {
		capture?: KgCapturedData | null;
		cryptoPair?: KgCryptoPair | null;
		modules?: KgModule[];
		rawTree?: any;
		storage?: Storage;
		fetchResources?: (route: KgRouteInfo, pointId: string) => Promise<KgResourceItem[] | null>;
	}
): Promise<KgPoint | false | null> {
	let modules = options?.modules;
	let rawTree = options?.rawTree;

	if (!modules) {
		const treeResult = await kgFetchModules(route, { capture: options?.capture, cryptoPair: options?.cryptoPair });
		modules = treeResult.modules;
		rawTree = treeResult.raw;
	}

	let points = kgFlattenPoints(modules).filter((p) => KG_POINT_ID_RE.test(p.pointId));
	if (!points.length && rawTree) {
		points = kgExtractPointsDeep(rawTree);
	}
	if (!points.length) {
		return null;
	}

	const isAll = switchMode === 'all';
	if (!isAll) {
		const capturedProgress = kgCollectCapturedResourceProgress(options?.capture || null);
		for (const point of points) {
			if (point.required === undefined) {
				const cap = capturedProgress.get(String(point.pointId));
				if (cap) {
					point.required = cap.required;
					point.finished = cap.finished;
				}
			}
		}
	}

	const currentIndex = points.findIndex((p) => String(p.pointId) === String(route.classId));

	// All mode: traverse in sequential order without checking completion
	if (isAll) {
		const nextIndex = currentIndex === -1 ? 0 : currentIndex + 1;
		return nextIndex < points.length ? points[nextIndex] : false;
	}

	// Job mode: evaluate completion state and skip finished points
	const skipSet = kgGetUnplayableSet(route.courseId, options?.storage);
	const startIndex = currentIndex === -1 ? 0 : currentIndex + 1;
	const order: number[] = [];
	for (let i = startIndex; i < points.length; i++) {
		order.push(i);
	}
	for (let i = 0; i < startIndex; i++) {
		order.push(i);
	}

	let hadErrors = false;
	const fetchPointRes =
		options?.fetchResources ||
		((r: KgRouteInfo, pid: string) =>
			kgFetchPointResources(r, pid, { capture: options?.capture, cryptoPair: options?.cryptoPair }));

	for (let offset = 0; offset < order.length; offset += 6) {
		const chunk = order.slice(offset, offset + 6);
		let knownUnfinishedIndex = -1;
		const unknowns: number[] = [];

		for (const idx of chunk) {
			const state = kgPointProgressState(points[idx], skipSet);
			if (state === 'skip') {
				continue;
			}
			if (state === 'unknown') {
				unknowns.push(idx);
			} else if (state === 'unfinished' && knownUnfinishedIndex === -1) {
				knownUnfinishedIndex = idx;
			}
		}

		let unknownWinnerIndex = -1;
		if (unknowns.length) {
			const chunkResults = await Promise.all(
				unknowns.map(async (idx) => {
					const pt = points[idx];
					const resources = await fetchPointRes(route, pt.pointId);
					if (!resources) {
						return { status: 'error' as const };
					}
					return { status: 'ok' as const, resources };
				})
			);

			let failedCount = 0;
			for (let k = 0; k < unknowns.length; k++) {
				const out = chunkResults[k];
				if (out.status === 'error') {
					failedCount++;
					hadErrors = true;
					continue;
				}
				if (out.resources.length === 0) {
					continue;
				}
				if (out.resources.some((res) => Number(res.studyStatus) !== 1)) {
					unknownWinnerIndex = unknowns[k];
					break;
				}
			}

			if (failedCount === unknowns.length && unknowns.length > 0) {
				return null;
			}
		}

		const candidates: number[] = [];
		if (knownUnfinishedIndex !== -1) {
			candidates.push(knownUnfinishedIndex);
		}
		if (unknownWinnerIndex !== -1) {
			candidates.push(unknownWinnerIndex);
		}

		if (candidates.length) {
			return points[Math.min(...candidates)];
		}
	}

	return hadErrors ? null : false;
}

// ---------------------------------------------------------------------------
// DOM Fallback Navigation Helpers
// ---------------------------------------------------------------------------

export function isVisible(el: HTMLElement): boolean {
	return (
		!!el &&
		el.isConnected &&
		(el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0)
	);
}

export function isFinishedCard(card: HTMLElement): boolean {
    const statusEl = card.querySelector('.finished-icon');
    const statusText = (statusEl?.textContent || '').trim();

    if (statusText.includes('已完成')) {
        return true;
    }

    if (/^\d+(?:\.\d+)?\s*%$/.test(statusText)) {
        return false;
    }

    const finishedMark = card.querySelector(
        '[class*="finish"],[class*="complete"],[class*="success"],[class*="done"],[class*="checked"]'
    );

    if (finishedMark) {
        const cls = (finishedMark.className || '').toString().toLowerCase();

        if (!/(un|in|no|dis)[a-z-]*(finish|complete|success|done|check)/.test(cls)) {
            return true;
        }
    }

    return false;
}

export function getSelectableCards(root: Document | HTMLElement = typeof document !== 'undefined' ? document : ({} as any)): HTMLElement[] {
	if (typeof root?.querySelectorAll !== 'function') {
		return [];
	}
	const cards = Array.from(root.querySelectorAll<HTMLElement>('[class*="card-container"]'));
	const visible = cards.filter(isVisible);
	return visible.length !== 0 ? visible : cards;
}

export function getRowText(row: HTMLElement): string {
	return (row.textContent || '').replace(/\s+/g, '');
}

export function getRowTitle(row: HTMLElement): string {
	const title = row.querySelector('.title-text, [class*="title"]');
	return ((title ? title.textContent : row.textContent) || '').trim();
}

export function textMatchesName(text: string | null | undefined, name: string | null | undefined): boolean {
	if (!text || !name) return false;
	const a = text.replace(/[\s\-_—·.,:：/／\d]/g, '');
	const b = name.replace(/[\s\-_—·.,:：/／\d]/g, '');
	return !!a && !!b && (a.includes(b) || b.includes(a));
}

export function isCurrentRow(row: HTMLElement, currentName?: string): boolean {
	if (currentName && textMatchesName(getRowTitle(row), currentName)) {
		return true;
	}
	return /(^|[\s-])(active|current|selected|playing)([\s-]|$)/i.test((row.className || '').toString());
}

export function isConfidentlyFinished(row: HTMLElement): boolean {
	const text = getRowText(row);
	const progressEl = row.querySelector('.collapse-info-progress, [class*="progress"]');
	const progressText = progressEl ? progressEl.textContent || '' : text;
	const match = /(\d+)\s*[/／]\s*(\d+)/.exec(progressText);
	if (match && parseInt(match[1], 10) >= parseInt(match[2], 10) && parseInt(match[2], 10) > 0) {
		return true;
	}
	if (/已学完|已完成|100%/.test(text)) {
		return true;
	}
	const mark = row.querySelector(
		'[class*="finish"],[class*="complete"],[class*="success"],[class*="done"],[class*="checked"]'
	);
	if (mark) {
		const cls = (mark.className || '').toString().toLowerCase();
		if (!/(un|in|no|dis)[a-z-]*(finish|complete|success|done|check)/.test(cls)) {
			return true;
		}
	}
	return false;
}

export function getChapterRows(root: Document | HTMLElement = typeof document !== 'undefined' ? document : ({} as any)): HTMLElement[] {
	if (typeof root?.querySelectorAll !== 'function') {
		return [];
	}
	const pool: HTMLElement[] = [];
	for (const selector of ROW_SELECTORS) {
		root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
			if (!pool.includes(el)) {
				pool.push(el);
			}
		});
	}

	const rows = pool.filter((el) => {
		if (!el.isConnected) {
			return false;
		}
		const text = (el.textContent || '').replace(/\s+/g, '');
		if (text.length === 0 || text.length > 60) {
			return false;
		}
		return !pool.some((other) => other !== el && el.contains(other));
	});

	rows.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
	return rows;
}

export function rowsSignature(rows: HTMLElement[]): string {
	return rows
		.map((row) => {
			const text = getRowText(row);
			return text.length > 30 ? text.slice(0, 30) : text;
		})
		.join('\n');
}

export function simulateClick(el: HTMLElement): void {
	try {
		el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
	} catch {}
	el.click();
}

export function getClickTargets(row: HTMLElement): HTMLElement[] {
	const targets = [row];
	const title = row.querySelector<HTMLElement>('.title-text, [class*="title"]');
	if (title && title !== row && !targets.includes(title)) {
		targets.push(title);
	}
	const mainText = getRowTitle(row) || getRowText(row);
	const leaf = Array.from(row.querySelectorAll<HTMLElement>('*')).find(
		(el) => el.children.length === 0 && textMatchesName(el.textContent, mainText)
	);
	if (leaf && !targets.includes(leaf)) {
		targets.push(leaf);
	}
	return targets;
}

export async function attemptRow(
	row: HTMLElement,
	isValid: () => boolean,
	getCurrentPointName: () => string
): Promise<'switched' | 'expanded' | 'dead' | 'skipped'> {
	if (!isValid() || !row || !row.isConnected) {
		return 'skipped';
	}
	const hrefBefore = typeof location !== 'undefined' ? location.href : '';
	const pointBefore = getCurrentPointName();
	const sigBefore = rowsSignature(getChapterRows());
	const countBefore = sigBefore.split('\n').filter(Boolean).length;
	const targets = getClickTargets(row);

	for (let round = 0; round < targets.length; round++) {
		if (!isValid() || !row.isConnected) {
			return 'skipped';
		}
		const target = targets[round];
		if (!target || !target.isConnected) {
			continue;
		}
		try {
			target.scrollIntoView({ block: 'center' });
		} catch {}
		await sleep(200);
		if (!isValid()) {
			return 'skipped';
		}
		simulateClick(target);

		const changed = await waitFor(
			() => {
				if (!isValid()) {
					return 'aborted';
				}
				if (typeof location !== 'undefined' && location.href !== hrefBefore) {
					return 'switched';
				}
				const name = getCurrentPointName();
				if (name && name !== pointBefore && textMatchesName(getRowTitle(row), name)) {
					return 'switched';
				}
				if (rowsSignature(getChapterRows()) !== sigBefore) {
					return 'toggled';
				}
				return undefined;
			},
			{ check_period_ms: 300, timeout_seconds: 6 }
		);

		if (!isValid() || changed === 'aborted') {
			return 'skipped';
		}
		if (changed === 'switched') {
			return 'switched';
		}
		if (changed === 'toggled') {
			const countAfter = rowsSignature(getChapterRows()).split('\n').filter(Boolean).length;
			if (countAfter >= countBefore) {
				return 'expanded';
			}
			// Accidental collapse: re-click to restore
			simulateClick(target);
			const restored = await waitFor(
				() => {
					if (!isValid()) {
						return 'aborted';
					}
					const count = rowsSignature(getChapterRows()).split('\n').filter(Boolean).length;
					return count >= countBefore ? 'restored' : undefined;
				},
				{ check_period_ms: 300, timeout_seconds: 4 }
			);
			if (!isValid() || restored === 'aborted') {
				return 'skipped';
			}
			if (restored === 'restored') {
				return 'expanded';
			}
			return 'dead';
		}
	}

	return 'dead';
}

export async function openNextDomPoint(
	switchMode: 'job' | 'all',
	isValid: () => boolean,
	getCurrentPointName: () => string,
	deadRows: Set<HTMLElement>
): Promise<boolean> {
	const isAll = switchMode === 'all';
	const pointNameAtStart = getCurrentPointName();
	let cursorEl: HTMLElement | undefined;
	let wrapped = false;

	for (let guard = 0; guard < 300; guard++) {
		if (!isValid()) {
			return true;
		}
		const rows = getChapterRows();
		const name = getCurrentPointName();
		let startIndex = 0;

		if (cursorEl) {
			const cursorIndex = rows.indexOf(cursorEl);
			startIndex = cursorIndex === -1 ? 0 : cursorIndex + 1;
		} else if (!wrapped) {
			const currentIndex = rows.findIndex((r) => isCurrentRow(r, name || pointNameAtStart));
			startIndex = currentIndex === -1 ? 0 : currentIndex + 1;
		}

		let target: HTMLElement | undefined;
		for (let idx = startIndex; idx < rows.length; idx++) {
			const row = rows[idx];
			if (row === cursorEl) {
				continue;
			}
			if (name && isCurrentRow(row, name)) {
				continue;
			}
			if (deadRows.has(row)) {
				continue;
			}
			if (!isAll && isConfidentlyFinished(row)) {
				continue;
			}
			target = row;
			break;
		}

		if (!target) {
			if (!isAll && !wrapped) {
				wrapped = true;
				cursorEl = undefined;
				continue;
			}
			return false;
		}

		cursorEl = target;
		const result = await attemptRow(target, isValid, getCurrentPointName);
		if (!isValid()) {
			return true;
		}
		if (result === 'switched') {
			return true;
		}
		if (result === 'dead') {
			deadRows.add(target);
		}
		// If result was 'expanded', loop continues and re-queries rows to click the expanded sub-row!
	}

	return false;
}
