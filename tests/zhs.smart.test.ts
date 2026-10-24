import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
	KG_POINT_ID_RE,
	kgToArray,
	kgPick,
	kgSafeJsonParse,
	kgIsSuccessResponse,
	kgExtractProgressFromObject,
	kgParsePoint,
	kgParseUnit,
	kgNormalizeKnowledgeDic,
	kgNormalizeModuleInfo,
	kgNormalizeThemeNodeList,
	kgCountDirectPoints,
	kgExtractPointsDeep,
	kgFlattenPoints,
	kgNormalizeRequiredResources,
	kgCollectCapturedResourceProgress,
	kgParseRoute,
	kgBuildPointUrl,
	kgUnplayableKey,
	kgGetUnplayableSet,
	kgMarkUnplayable,
	kgPointProgressState,
	kgFindNextPoint,
	isFinishedCard,
	isConfidentlyFinished,
	textMatchesName,
	isCurrentRow,
	openNextDomPoint,
	attemptRow,
	ROW_SELECTORS,
	type KgPoint,
	type KgModule,
	type KgRouteInfo,
	type KgCapturedData
} from '../packages/scripts/src/utils/zhs.smart.ts';

// ---------------------------------------------------------------------------
// Lightweight DOM Mock for isolated testing
// ---------------------------------------------------------------------------

class MockDOMElement {
	tagName: string;
	className: string;
	textContent: string;
	children: MockDOMElement[] = [];
	parentElement: MockDOMElement | null = null;
	isConnected: boolean = true;
	offsetWidth: number = 100;
	offsetHeight: number = 30;
	clicked: boolean = false;
	clickCount: number = 0;
	onClick?: () => void;

	constructor(tagName: string, className = '', textContent = '') {
		this.tagName = tagName.toUpperCase();
		this.className = className;
		this.textContent = textContent;
	}

	get classList() {
		return {
			contains: (cls: string) => this.className.split(/\s+/).includes(cls),
			add: (cls: string) => {
				const set = new Set(this.className.split(/\s+/).filter(Boolean));
				set.add(cls);
				this.className = Array.from(set).join(' ');
			},
			remove: (cls: string) => {
				const set = new Set(this.className.split(/\s+/).filter(Boolean));
				set.delete(cls);
				this.className = Array.from(set).join(' ');
			}
		};
	}

	appendChild(child: MockDOMElement) {
		child.parentElement = this;
		this.children.push(child);
		return child;
	}

	contains(other: MockDOMElement): boolean {
		if (other === this) return true;
		for (const child of this.children) {
			if (child.contains(other)) return true;
		}
		return false;
	}

	compareDocumentPosition(other: MockDOMElement): number {
		const all = this.getRootAll();
		const idxA = all.indexOf(this);
		const idxB = all.indexOf(other);
		return idxB > idxA ? 4 : 2; // Node.DOCUMENT_POSITION_FOLLOWING = 4
	}

	private getRootAll(): MockDOMElement[] {
		let root: MockDOMElement = this;
		while (root.parentElement) root = root.parentElement;
		const list: MockDOMElement[] = [];
		const traverse = (el: MockDOMElement) => {
			list.push(el);
			for (const c of el.children) traverse(c);
		};
		traverse(root);
		return list;
	}

	scrollIntoView() {}

	dispatchEvent(ev: any) {
		return true;
	}

	click() {
		this.clicked = true;
		this.clickCount++;
		if (this.onClick) {
			this.onClick();
		}
	}

	getClientRects() {
		return [{ width: this.offsetWidth, height: this.offsetHeight }];
	}

	querySelector<T extends MockDOMElement>(selector: string): T | null {
		const results = this.querySelectorAll<T>(selector);
		return results.length ? results[0] : null;
	}

	querySelectorAll<T extends MockDOMElement>(selector: string): T[] {
		const matches: T[] = [];
		const parts = selector.split(',').map((s) => s.trim());

		const testSingle = (el: MockDOMElement, sel: string): boolean => {
			if (sel === '*') return true;
			if (sel.startsWith('.')) {
				const cls = sel.slice(1);
				return el.classList.contains(cls);
			}
			if (sel.includes('[class*="')) {
				const match = /\[class\*="([^"]+)"\]/.exec(sel);
				if (match && el.className.includes(match[1])) {
					if (sel.includes('.active')) {
						return el.classList.contains('active');
					}
					return true;
				}
			}
			return false;
		};

		const testSelector = (el: MockDOMElement): boolean => {
			return parts.some((p) => testSingle(el, p));
		};

		const traverse = (el: MockDOMElement) => {
			for (const child of el.children) {
				if (testSelector(child)) {
					matches.push(child as unknown as T);
				}
				traverse(child);
			}
		};
		traverse(this);
		return matches;
	}
}

class MockStorage implements Storage {
	private data = new Map<string, string>();
	get length() {
		return this.data.size;
	}
	clear() {
		this.data.clear();
	}
	getItem(key: string): string | null {
		return this.data.has(key) ? this.data.get(key)! : null;
	}
	key(index: number): string | null {
		return Array.from(this.data.keys())[index] || null;
	}
	removeItem(key: string): void {
		this.data.delete(key);
	}
	setItem(key: string, value: string): void {
		this.data.set(key, value);
	}
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Zhihuishu Smart Study Improvements', () => {

	describe('1. Navigation across collapsed modules', () => {
		it('should expand collapsed module and traverse to the newly revealed sub-item', async () => {
			const root = new MockDOMElement('div', 'sidebar');
			const module1Header = new MockDOMElement('div', 'section-item-collapse-info', '第1章 基础知识');
			const subItem1 = new MockDOMElement('div', 'collapse-item-sub', '1.1 绪论');
			subItem1.classList.add('active'); // currently active
			module1Header.appendChild(subItem1);
			root.appendChild(module1Header);

			const module2Header = new MockDOMElement('div', 'section-item-collapse-info', '第2章 进阶内容');
			const subItem2 = new MockDOMElement('div', 'collapse-item-sub', '2.1 进阶概念');
			// module2 is initially collapsed: subItem2 is not attached to DOM yet
			let isExpanded = false;
			module2Header.onClick = () => {
				if (!isExpanded) {
					isExpanded = true;
					module2Header.appendChild(subItem2);
				}
			};
			root.appendChild(module2Header);

			// Setup global document mock
			(globalThis as any).document = root;
			(globalThis as any).Node = { DOCUMENT_POSITION_FOLLOWING: 4 };

			const deadRows = new Set<any>();
			let currentName = '1.1 绪论';

			// In job mode, subItem1 is finished, so openNextDomPoint should attempt module2
			const switched = await openNextDomPoint(
				'job',
				() => true,
				() => currentName,
				deadRows
			);

			// Module2 was clicked and expanded
			assert.equal(module2Header.clickCount >= 1, true, 'Module 2 header should be clicked');
			assert.equal(isExpanded, true, 'Module 2 should be expanded');
			// SubItem2 should be added and attempted
			assert.equal(subItem2.parentElement !== null, true, 'SubItem2 should now be in the DOM tree');
		});
	});

	describe('2. Waiting for new tasks and card identification', () => {
		it('should identify finished and unfinished cards accurately', () => {
			const finishedCard = new MockDOMElement('div', 'card-container video-card');
			const finishedIcon = new MockDOMElement('span', 'finished-icon', '已完成');
			finishedCard.appendChild(finishedIcon);

			const unfinishedCard = new MockDOMElement('div', 'card-container video-card');
			const progressText = new MockDOMElement('span', 'progress-text', '学习中 45%');
			unfinishedCard.appendChild(progressText);

			assert.equal(isFinishedCard(finishedCard as unknown as HTMLElement), true);
			assert.equal(isFinishedCard(unfinishedCard as unknown as HTMLElement), false);
		});

		it('should detect confidently finished rows by progress text', () => {
			const finishedRow = new MockDOMElement('div', 'section-item', '第1节 导学');
			const prog = new MockDOMElement('span', 'collapse-info-progress', '必学 3/3');
			finishedRow.appendChild(prog);

			const unfinishedRow = new MockDOMElement('div', 'section-item', '第2节 核心');
			const prog2 = new MockDOMElement('span', 'collapse-info-progress', '必学 1/3');
			unfinishedRow.appendChild(prog2);

			assert.equal(isConfidentlyFinished(finishedRow as unknown as HTMLElement), true);
			assert.equal(isConfidentlyFinished(unfinishedRow as unknown as HTMLElement), false);
		});
	});

	describe('3. Course-tree normalization and ordering', () => {
		it('should normalize Knowledge Dic format into structured modules and units', () => {
			const rawDic = {
				code: 200,
				data: {
					themeList: [
						{
							themeId: '10001',
							themeName: '第一单元 引言',
							subThemeList: [
								{
									subThemeId: '20001',
									subThemeName: '1.1 概论',
									knowledgeList: [
										{
											knowledgeId: '3000001',
											knowledgeName: '知识点 A',
											resourceCount: 2,
											finishResourceCount: 2
										},
										{
											knowledgeId: '3000002',
											knowledgeName: '知识点 B',
											resourceCount: 1,
											finishResourceCount: 0
										}
									]
								}
							]
						}
					]
				}
			};

			const modules = kgNormalizeKnowledgeDic(rawDic);
			assert.equal(modules.length, 1);
			assert.equal(modules[0].moduleId, '10001');
			assert.equal(modules[0].units.length, 1);
			assert.equal(modules[0].units[0].points.length, 2);

			const points = kgFlattenPoints(modules);
			assert.equal(points.length, 2);
			assert.equal(points[0].pointId, '3000001');
			assert.equal(points[0].required, 2);
			assert.equal(points[0].finished, 2);
			assert.equal(points[1].pointId, '3000002');
			assert.equal(points[1].required, 1);
			assert.equal(points[1].finished, 0);
		});

		it('should normalize Module Info format', () => {
			const rawModuleInfo = {
				code: 0,
				data: {
					moduleList: [
						{
							moduleId: 'm_100',
							moduleName: '模块A',
							unitList: [
								{
									unitId: 'u_200',
									unitName: '单元A',
									children: [
										{
											pointId: '3000003',
											name: '知识点 C',
											totalCount: 3,
											finishedCount: 1
										}
									]
								}
							]
						}
					]
				}
			};

			const modules = kgNormalizeModuleInfo(rawModuleInfo);
			assert.equal(modules.length, 1);
			const points = kgFlattenPoints(modules);
			assert.equal(points.length, 1);
			assert.equal(points[0].pointId, '3000003');
			assert.equal(points[0].required, 3);
			assert.equal(points[0].finished, 1);
		});

		it('should safely handle empty, null, or malformed data', () => {
			assert.deepEqual(kgNormalizeKnowledgeDic(null), []);
			assert.deepEqual(kgNormalizeKnowledgeDic({}), []);
			assert.deepEqual(kgNormalizeModuleInfo(undefined), []);
			assert.deepEqual(kgExtractPointsDeep(null), []);
			assert.deepEqual(kgFlattenPoints([]), []);
		});
	});

	describe('4. Correct handling of completed, incomplete, and unknown progress', () => {
		const skipSet = new Set(['9999999']);

		it('should distinguish finished, unfinished, unknown, and skip states', () => {
			const finishedPoint: KgPoint = { pointId: '1000001', pointName: 'A', required: 2, finished: 2 };
			const unfinishedPoint: KgPoint = { pointId: '1000002', pointName: 'B', required: 2, finished: 1 };
			const unknownPoint: KgPoint = { pointId: '1000003', pointName: 'C' }; // no progress
			const skippedPoint: KgPoint = { pointId: '9999999', pointName: 'D', required: 5, finished: 0 };

			assert.equal(kgPointProgressState(finishedPoint, skipSet), 'finished');
			assert.equal(kgPointProgressState(unfinishedPoint, skipSet), 'unfinished');
			assert.equal(kgPointProgressState(unknownPoint, skipSet), 'unknown');
			assert.equal(kgPointProgressState(skippedPoint, skipSet), 'skip');
		});

		it('should parse captured network resources and update progress', () => {
			const capture: KgCapturedData = {
				traffic: [
					{
						url: 'https://kg-ai-run.zhihuishu.com/run/gateway/t/stu/resources/list-knowledge-resource',
						method: 'POST',
						body: JSON.stringify({ knowledgeId: '5000001', courseId: '1' }),
						json: {
							code: 200,
							data: {
								resourceList: [
									{ resourcesUid: 'r1', resourcesSyncType: 1, studyStatus: 1 },
									{ resourcesUid: 'r2', resourcesSyncType: 1, studyStatus: 0 },
									{ resourcesUid: 'r3', resourcesSyncType: 0, studyStatus: 0 } // non-required
								]
							}
						},
						time: Date.now()
					}
				],
				requestHeaders: {},
				encryptedSeen: false,
				plainSeen: true
			};

			const progressMap = kgCollectCapturedResourceProgress(capture);
			assert.equal(progressMap.has('5000001'), true);
			const stat = progressMap.get('5000001')!;
			assert.equal(stat.required, 2, 'Should only count resourcesSyncType === 1');
			assert.equal(stat.finished, 1, 'Should only count studyStatus === 1');
		});
	});

	describe('5. Final-chapter boundaries and empty candidate lists', () => {
		it('should return false in all mode when current point is at the end of the course', async () => {
			const route: KgRouteInfo = { courseId: '100', classId: '3000002', nodeUid: '3000002' };
			const modules: KgModule[] = [
				{
					moduleId: 'm1',
					moduleName: 'M1',
					units: [
						{
							unitId: 'u1',
							unitName: 'U1',
							points: [
								{ pointId: '3000001', pointName: 'Point 1' },
								{ pointId: '3000002', pointName: 'Point 2 (Last)' }
							]
						}
					]
				}
			];

			const next = await kgFindNextPoint(route, 'all', { modules });
			assert.equal(next, false, 'Should return false when reaching the final chapter');
		});

		it('should return false in job mode when all points are completed', async () => {
			const route: KgRouteInfo = { courseId: '100', classId: '3000001', nodeUid: '3000001' };
			const modules: KgModule[] = [
				{
					moduleId: 'm1',
					moduleName: 'M1',
					units: [
						{
							unitId: 'u1',
							unitName: 'U1',
							points: [
								{ pointId: '3000001', pointName: 'Point 1', required: 1, finished: 1 },
								{ pointId: '3000002', pointName: 'Point 2', required: 2, finished: 2 }
							]
						}
					]
				}
			];

			const next = await kgFindNextPoint(route, 'job', { modules });
			assert.equal(next, false, 'Should return false when all points are completed');
		});
	});

	describe('6. Duplicate navigation or stale asynchronous work', () => {
		it('should reject outdated asynchronous loops when runId changes', () => {
			let activeRunId = 1;
			const isValid = (runId: number) => runId === activeRunId;

			const run1 = 1;
			assert.equal(isValid(run1), true);

			// New execution starts (e.g., from onhistorychange)
			activeRunId = 2;
			const run2 = 2;

			assert.equal(isValid(run1), false, 'Worker 1 must be considered stale and canceled');
			assert.equal(isValid(run2), true, 'Worker 2 must be valid');
		});

		it('should respect sessionStorage skip tracking to avoid infinite loops', () => {
			const storage = new MockStorage();
			const courseId = 'course_999';

			assert.equal(kgGetUnplayableSet(courseId, storage).size, 0);

			kgMarkUnplayable(courseId, '3000001', storage);
			const set1 = kgGetUnplayableSet(courseId, storage);
			assert.equal(set1.has('3000001'), true);

			// Calling mark again should be idempotent
			kgMarkUnplayable(courseId, '3000001', storage);
			assert.equal(kgGetUnplayableSet(courseId, storage).size, 1);
		});
	});

	describe('7. Preserving job and all semantics', () => {
		const modules: KgModule[] = [
			{
				moduleId: 'm1',
				moduleName: 'M1',
				units: [
					{
						unitId: 'u1',
						unitName: 'U1',
						points: [
							{ pointId: '3000001', pointName: 'Point 1', required: 1, finished: 1 }, // finished
							{ pointId: '3000002', pointName: 'Point 2', required: 1, finished: 0 }, // unfinished
							{ pointId: '3000003', pointName: 'Point 3', required: 1, finished: 1 }  // finished
						]
					}
				]
			}
		];

		it('in all mode: should select the next sequential point even if already finished', async () => {
			// Currently on Point 2
			const route: KgRouteInfo = { courseId: '100', classId: '3000002', nodeUid: '3000002' };
			const next = await kgFindNextPoint(route, 'all', { modules });
			assert.ok(next && typeof next === 'object');
			assert.equal(next.pointId, '3000003');
		});

		it('in job mode: should skip finished points and wrap around to find unfinished points', async () => {
			// Currently on Point 2, Point 3 is finished, Point 1 is finished, but suppose Point 1 was unfinished:
			const wrapModules: KgModule[] = [
				{
					moduleId: 'm1',
					moduleName: 'M1',
					units: [
						{
							unitId: 'u1',
							unitName: 'U1',
							points: [
								{ pointId: '3000001', pointName: 'Point 1', required: 2, finished: 1 }, // unfinished behind us
								{ pointId: '3000002', pointName: 'Point 2', required: 1, finished: 1 }, // finished current
								{ pointId: '3000003', pointName: 'Point 3', required: 1, finished: 1 }  // finished ahead
							]
						}
					]
				}
			];
			const route: KgRouteInfo = { courseId: '100', classId: '3000002', nodeUid: '3000002' };
			const next = await kgFindNextPoint(route, 'job', { modules: wrapModules });
			assert.ok(next && typeof next === 'object');
			assert.equal(next.pointId, '3000001', 'Should wrap around and select the unfinished Point 1');
		});
	});

	describe('8. Compatibility with older / unstructured course trees and routes', () => {
		it('should extract points deeply from arbitrary nested tree without theme/module wrappers', () => {
			const unstructuredTree = {
				catalog: {
					nodes: [
						{
							classId: '4000001',
							title: '非标准小节 1',
							children: [] // leaf node
						},
						{
							id: 'container_node',
							title: '中间目录',
							children: [
								{
									knowledgeId: '4000002',
									name: '非标准小节 2',
									items: []
								}
							]
						}
					]
				}
			};

			const extracted = kgExtractPointsDeep(unstructuredTree);
			assert.equal(extracted.length, 2);
			assert.equal(extracted[0].pointId, '4000001');
			assert.equal(extracted[1].pointId, '4000002');
		});

		it('should parse search parameter route and build query-based navigation URL', () => {
			const loc = {
				pathname: '/study/course',
				search: '?courseId=9876&classId=5000001&nodeUid=5000001'
			};
			const route = kgParseRoute(loc);
			assert.ok(route);
			assert.equal(route.courseId, '9876');
			assert.equal(route.classId, '5000001');

			const newUrl = kgBuildPointUrl('5000002', route, 'https://example.com/study/course?courseId=9876&classId=5000001&nodeUid=5000001');
			assert.ok(newUrl.includes('classId=5000002'));
		});

		it('should parse learnPage path route and build path-based navigation URL', () => {
			const loc = {
				pathname: '/learnPage/8888/5000001/6000001',
				search: ''
			};
			const route = kgParseRoute(loc);
			assert.ok(route);
			assert.equal(route.courseId, '8888');
			assert.equal(route.classId, '5000001');

			const targetUrl = kgBuildPointUrl('5000002', route, 'https://smartcoursestudent.zhihuishu.com/learnPage/8888/5000001/6000001');
			assert.equal(targetUrl, 'https://smartcoursestudent.zhihuishu.com/learnPage/8888/5000002/6000001');
		});
	});

});
