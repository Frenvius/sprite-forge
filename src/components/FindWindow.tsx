import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { isValidSpriteId } from '@/lib/formats/tibia';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAssetData } from '@/usecase/context/AssetDataContext';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { ThingType, ThingCategory, TIBIA_FORMAT_CONFIG } from '@/lib/formats/tibia/types';
import {
	X,
	Edit,
	Copy,
	List,
	Minus,
	Square,
	Upload,
	Trash2,
	Columns,
	Sparkles,
	Download,
	Clipboard,
	LayoutGrid,
	ClipboardPaste
} from 'lucide-react';

import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { CheckerBoard } from './CheckerBoard';
import { ScrollArea } from './ui/scroll-area';
import { SpriteCanvas } from './commons/SpriteCanvas';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from './ui/select';
import { ContextMenu, ContextMenuItem, ContextMenuContent, ContextMenuTrigger } from './ui/context-menu';
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu';

type SimilarityRef = { id: number; category: ThingCategory };

const CATEGORY_BYTE: Record<'all' | ThingCategory, number> = {
	all: 0,
	[ThingCategory.ITEM]: 1,
	[ThingCategory.OUTFIT]: 2,
	[ThingCategory.EFFECT]: 3,
	[ThingCategory.MISSILE]: 4
};

function encodeFindSimilarPayload(
	refs: SimilarityRef[],
	category: 'all' | ThingCategory,
	transparent: boolean,
	thresholdPct: number,
	maxResults: number,
	datPath: string,
	sprPath: string
): Uint8Array {
	const encoder = new TextEncoder();
	const datBytes = encoder.encode(datPath);
	const sprBytes = encoder.encode(sprPath);
	const total = 2 + refs.length * 5 + 4 + 4 + 2 + datBytes.length + 2 + sprBytes.length;
	const buf = new ArrayBuffer(total);
	const view = new DataView(buf);
	const u8 = new Uint8Array(buf);
	let p = 0;
	view.setUint16(p, refs.length, true);
	p += 2;
	for (const r of refs) {
		view.setUint32(p, r.id, true);
		p += 4;
		u8[p++] = CATEGORY_BYTE[r.category];
	}
	u8[p++] = CATEGORY_BYTE[category];
	u8[p++] = transparent ? 1 : 0;
	u8[p++] = Math.max(0, Math.min(100, Math.round(thresholdPct)));
	u8[p++] = 0;
	view.setUint32(p, maxResults, true);
	p += 4;
	view.setUint16(p, datBytes.length, true);
	p += 2;
	u8.set(datBytes, p);
	p += datBytes.length;
	view.setUint16(p, sprBytes.length, true);
	p += 2;
	u8.set(sprBytes, p);
	return u8;
}

type ViewMode = 'list' | 'grid' | 'large' | 'compact';

const VIEW_MODES: ViewMode[] = ['list', 'grid', 'compact', 'large'];

const PROPERTIES: Array<{ display: string; property: string }> = [
	{ display: 'Is Ground', property: 'isGround' },
	{ display: 'Ground Border', property: 'isGroundBorder' },
	{ display: 'Bottom', property: 'isOnBottom' },
	{ display: 'Top', property: 'isOnTop' },
	{ display: 'Has Light', property: 'hasLight' },
	{ display: 'Automap', property: 'miniMap' },
	{ display: 'Has Offset', property: 'hasOffset' },
	{ display: 'Has Elevation', property: 'hasElevation' },
	{ display: 'Equip', property: 'cloth' },
	{ display: 'Market', property: 'isMarketItem' },
	{ display: 'Writable', property: 'writable' },
	{ display: 'Writable Once', property: 'writableOnce' },
	{ display: 'Has Action', property: 'hasDefaultAction' },
	{ display: 'Container', property: 'isContainer' },
	{ display: 'Stackable', property: 'stackable' },
	{ display: 'Force Use', property: 'forceUse' },
	{ display: 'Multi Use', property: 'multiUse' },
	{ display: 'Fluid Container', property: 'isFluidContainer' },
	{ display: 'Fluid', property: 'isFluid' },
	{ display: 'Unpassable', property: 'isUnpassable' },
	{ display: 'Unmovable', property: 'isUnmoveable' },
	{ display: 'Block Missile', property: 'blockMissile' },
	{ property: 'blockPathfind', display: 'Block Pathfinder' },
	{ property: 'noMoveAnimation', display: 'No Move Animation' },
	{ display: 'Pickupable', property: 'pickupable' },
	{ display: 'Hangable', property: 'hangable' },
	{ display: 'Hook East', property: 'isHorizontal' },
	{ display: 'Hook South', property: 'isVertical' },
	{ display: 'Rotatable', property: 'rotatable' },
	{ property: 'dontHide', display: "Don't Hide" },
	{ display: 'Translucent', property: 'isTranslucent' },
	{ display: 'Lying Object', property: 'isLyingObject' },
	{ display: 'Animate Always', property: 'animateAlways' },
	{ display: 'Full Ground', property: 'isFullGround' },
	{ display: 'Ignore Look', property: 'ignoreLook' },
	{ display: 'Wrappable', property: 'wrappable' },
	{ display: 'Unwrappable', property: 'unwrappable' },
	{ display: 'Top effect', property: 'topEffect' },
	{ display: 'Useable', property: 'usable' },
	{ display: 'Has Charges', property: 'hasCharges' },
	{ display: 'Floor Change', property: 'floorChange' },
	{ display: 'Lens Help', property: 'isLensHelp' },
	{ display: 'Is Animation', property: 'isAnimation' }
];

export const FindWindow = () => {
	const { data, setData, spriteSize, setOpenedItemId, notifySpritesLoaded } = useAssetData();
	const [selectedCategory, setSelectedCategory] = useState<'all' | ThingCategory>('all');
	const [properties, setProperties] = useState<Record<string, boolean>>(
		PROPERTIES.reduce((acc, prop) => ({ ...acc, [prop.property]: false }), {})
	);
	const [name, setName] = useState('');
	const [spriteIdInput, setSpriteIdInput] = useState('');
	const [searchResults, setSearchResults] = useState<Array<{ id: number; category: ThingCategory }>>([]);
	const [resultThings, setResultThings] = useState<Map<string, ThingType>>(new Map());
	const [isSearching, setIsSearching] = useState(false);
	const [selectedResultId, setSelectedResultId] = useState<null | number>(null);
	const [selectedResultCategory, setSelectedResultCategory] = useState<null | ThingCategory>(null);
	const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
	const [anchorKey, setAnchorKey] = useState<null | string>(null);
	const [viewMode, setViewModeState] = useState<ViewMode>('list');
	const [similarityRefs, setSimilarityRefs] = useState<SimilarityRef[]>([]);
	const [similarityThreshold, setSimilarityThreshold] = useState<number>(70);

	useEffect(() => {
		invoke<null | string>('get_find_list_view_mode')
			.then((mode) => {
				if (mode && VIEW_MODES.includes(mode as ViewMode)) {
					setViewModeState(mode as ViewMode);
				}
			})
			.catch(() => {});
	}, []);

	const setViewMode = useCallback((mode: ViewMode) => {
		setViewModeState(mode);
		invoke('set_find_list_view_mode', { mode }).catch(() => {});
	}, []);
	const parentRef = useRef<HTMLDivElement>(null);

	const [parentWidth, setParentWidth] = useState(0);

	useEffect(() => {
		if (!parentRef.current) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setParentWidth(entry.contentRect.width);
			}
		});
		observer.observe(parentRef.current);
		return () => observer.disconnect();
	}, [parentRef.current]);

	const itemsPerRow = useMemo(() => {
		if (viewMode === 'list') return 1;
		if (viewMode === 'large') return 1;
		if (viewMode === 'grid') return 2;
		if (viewMode === 'compact') {
			const width = parentWidth || 400;
			return Math.max(1, Math.floor(width / 54));
		}
		return 1;
	}, [viewMode, parentWidth]);

	const rowCount = Math.ceil(searchResults.length / itemsPerRow);

	const virtualizer = useVirtualizer({
		overscan: 5,
		count: rowCount,
		getScrollElement: () => parentRef.current,
		estimateSize: () => {
			if (viewMode === 'list') return 40;
			if (viewMode === 'grid') return 54;
			if (viewMode === 'compact') return 74;
			if (viewMode === 'large') return 140;
			return 40;
		}
	});

	const handlePropertyToggle = (property: string) => {
		setProperties((prev) => ({ ...prev, [property]: !prev[property] }));
	};

	const handleFind = useCallback(async () => {
		const datPath = localStorage.getItem('sprite-forge-dat-path');
		if (!datPath) {
			setSearchResults([]);
			return;
		}

		const isSimilarity = similarityRefs.length > 0;
		setIsSearching(true);
		try {
			let bytes: Uint8Array;

			if (isSimilarity) {
				const sprPath = localStorage.getItem('sprite-forge-spr-path');
				if (!sprPath) {
					setSearchResults([]);
					return;
				}
				const transparency = localStorage.getItem('sprite-forge-transparency') === 'true';
				const payload = encodeFindSimilarPayload(
					similarityRefs,
					selectedCategory,
					transparency,
					similarityThreshold,
					0,
					datPath,
					sprPath
				);
				const response: any = await invoke('find_similar_bin', payload);
				bytes =
					response instanceof Uint8Array
						? response
						: Array.isArray(response)
							? new Uint8Array(response)
							: response && response.buffer instanceof ArrayBuffer
								? new Uint8Array(response.buffer, response.byteOffset ?? 0, response.byteLength ?? response.buffer.byteLength)
								: new Uint8Array(response);
			} else {
				const activeProperties: Record<string, boolean> = {};
				const relevantProps = ['hasLight', 'hasOffset', 'animateAlways'];

				for (const [propName, value] of Object.entries(properties)) {
					if (value === true) {
						if (selectedCategory !== 'all' && selectedCategory !== 'item') {
							if (!relevantProps.includes(propName)) {
								continue;
							}
						}
						activeProperties[propName] = true;
					}
				}

				const parsedSpriteId = parseInt(spriteIdInput.trim(), 10);
				const spriteId = !isNaN(parsedSpriteId) && parsedSpriteId > 0 ? parsedSpriteId : null;

				const response: any = await invoke('search_things_bin', {
					limit: 0,
					spriteId,
					path: datPath,
					name: name.trim() || null,
					properties: activeProperties,
					category: selectedCategory === 'all' ? null : selectedCategory
				});

				bytes =
					response instanceof Uint8Array
						? response
						: Array.isArray(response)
							? new Uint8Array(response)
							: response && response.buffer instanceof ArrayBuffer
								? new Uint8Array(response.buffer, response.byteOffset ?? 0, response.byteLength ?? response.buffer.byteLength)
								: new Uint8Array(response);
			}

			const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			let offset = 0;
			const count = view.getUint32(offset, true);
			offset += 4;

			const newResults: Array<{ id: number; category: ThingCategory }> = [];
			const newThings = new Map<string, ThingType>();

			for (let i = 0; i < count; i++) {
				const id = view.getUint32(offset, true);
				offset += 4;
				const catVal = view.getUint8(offset);
				offset += 1;

				let category: ThingCategory;
				switch (catVal) {
					case 1:
						category = ThingCategory.ITEM;
						break;
					case 2:
						category = ThingCategory.OUTFIT;
						break;
					case 3:
						category = ThingCategory.EFFECT;
						break;
					case 4:
						category = ThingCategory.MISSILE;
						break;
					default:
						category = ThingCategory.ITEM;
				}

				const width = view.getUint8(offset);
				offset += 1;
				const height = view.getUint8(offset);
				offset += 1;
				const layers = view.getUint8(offset);
				offset += 1;
				const patternX = view.getUint8(offset);
				offset += 1;
				const patternY = view.getUint8(offset);
				offset += 1;
				const patternZ = view.getUint8(offset);
				offset += 1;
				const frames = view.getUint8(offset);
				offset += 1;

				const spriteCount = view.getUint16(offset, true);
				offset += 2;

				const spriteIndex: number[] = [];
				for (let s = 0; s < spriteCount; s++) {
					spriteIndex.push(view.getUint32(offset, true));
					offset += 4;
				}

				const thing: ThingType = {
					id,
					width,
					height,
					layers,
					frames,
					category,
					patternX,
					patternY,
					patternZ,
					offsetX: 0,
					offsetY: 0,
					spriteIndex,
					lensHelp: 0,
					cloth: false,
					elevation: 0,
					clothSlot: 0,
					loopCount: 0,
					usable: false,
					lightLevel: 0,
					lightColor: 0,
					startFrame: 0,
					isOnTop: false,
					isFluid: false,
					miniMap: false,
					groundSpeed: 0,
					marketName: '',
					isGround: false,
					forceUse: false,
					multiUse: false,
					writable: false,
					hangable: false,
					hasLight: false,
					dontHide: false,
					miniMapColor: 0,
					marketShowAs: 0,
					stackable: false,
					maxTextLength: 0,
					rotatable: false,
					hasOffset: false,
					marketTradeAs: 0,
					defaultAction: 0,
					wrappable: false,
					topEffect: false,
					animationMode: 0,
					isOnBottom: false,
					pickupable: false,
					isVertical: false,
					isLensHelp: false,
					ignoreLook: false,
					marketCategory: 0,
					hasCharges: false,
					isContainer: false,
					floorChange: false,
					unwrappable: false,
					frameDurations: [],
					writableOnce: false,
					isUnpassable: false,
					isUnmoveable: false,
					blockMissile: false,
					isHorizontal: false,
					hasElevation: false,
					isFullGround: false,
					isMarketItem: false,
					blockPathfind: false,
					isTranslucent: false,
					isLyingObject: false,
					animateAlways: false,
					exactSize: spriteSize,
					isGroundBorder: false,
					noMoveAnimation: false,
					marketRestrictLevel: 0,
					isAnimation: frames > 1,
					isFluidContainer: false,
					hasDefaultAction: false,
					marketRestrictProfession: 0
				};

				if (isSimilarity) {
					offset += 1;
				}

				newResults.push({ id, category });
				newThings.set(`${category}-${id}`, thing);
			}

			setResultThings(newThings);
			setSearchResults(newResults);
		} catch (error) {
			console.error('Search failed with error:', error);
			setSearchResults([]);
		} finally {
			setIsSearching(false);
		}
	}, [name, properties, selectedCategory, spriteIdInput, similarityRefs, similarityThreshold]);

	const selectResult = useCallback(
		async (id: number, category: ThingCategory) => {
			const { emit } = await import('@tauri-apps/api/event');
			await emit('select_thing', { id, category });
			setOpenedItemId(id, category);
		},
		[setOpenedItemId]
	);

	const handleSelect = useCallback(() => {
		if (selectedResultId !== null && selectedResultCategory !== null) {
			selectResult(selectedResultId, selectedResultCategory);
		}
	}, [selectedResultId, selectedResultCategory, selectResult]);

	const handleResultClick = useCallback(
		(id: number, category: ThingCategory, e?: React.MouseEvent) => {
			const key = `${category}-${id}`;
			setSelectedResultId(id);
			setSelectedResultCategory(category);

			if (e?.shiftKey && anchorKey) {
				const startIdx = searchResults.findIndex((r) => `${r.category}-${r.id}` === anchorKey);
				const endIdx = searchResults.findIndex((r) => `${r.category}-${r.id}` === key);
				if (startIdx !== -1 && endIdx !== -1) {
					const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
					const next = new Set<string>(e.ctrlKey || e.metaKey ? selectedKeys : []);
					for (let i = lo; i <= hi; i++) {
						const r = searchResults[i];
						next.add(`${r.category}-${r.id}`);
					}
					setSelectedKeys(next);
					return;
				}
			}

			if (e?.ctrlKey || e?.metaKey) {
				setSelectedKeys((prev) => {
					const next = new Set(prev);
					if (next.has(key)) next.delete(key);
					else next.add(key);
					return next;
				});
				setAnchorKey(key);
				return;
			}

			setSelectedKeys(new Set([key]));
			setAnchorKey(key);
		},
		[anchorKey, searchResults, selectedKeys]
	);

	const handleResultDoubleClick = useCallback(
		(id: number, category: ThingCategory) => {
			const key = `${category}-${id}`;
			setSelectedResultId(id);
			setSelectedResultCategory(category);
			setSelectedKeys(new Set([key]));
			setAnchorKey(key);
			selectResult(id, category);
		},
		[selectResult]
	);

	const handleContextMenuTarget = useCallback(
		(id: number, category: ThingCategory) => {
			const key = `${category}-${id}`;
			if (!selectedKeys.has(key)) {
				setSelectedKeys(new Set([key]));
				setAnchorKey(key);
				setSelectedResultId(id);
				setSelectedResultCategory(category);
			}
		},
		[selectedKeys]
	);

	const emitFindAction = useCallback(async (action: string, targets: Array<{ id: number; category: ThingCategory }>) => {
		if (targets.length === 0) return;
		const { emit } = await import('@tauri-apps/api/event');
		const grouped = new Map<ThingCategory, number[]>();
		for (const t of targets) {
			const list = grouped.get(t.category) || [];
			list.push(t.id);
			grouped.set(t.category, list);
		}
		for (const [category, ids] of grouped) {
			await emit('find_action', { ids, action, category });
		}
	}, []);

	const canFindSimilarThing = useCallback((thing: ThingType | undefined) => {
		return !!thing?.spriteIndex?.some((sid) => isValidSpriteId(sid));
	}, []);

	useEffect(() => {
		const loadSprites = async () => {
			if (!data || !data.sprPath || searchResults.length === 0) return;

			const { loadSpriteIds } = await import('@/lib/formats/tibia');
			const idsToLoad: number[] = [];

			for (const result of searchResults) {
				const key = `${result.category}-${result.id}`;
				const thing = resultThings.get(key);
				if (thing && thing.spriteIndex) {
					for (const spriteId of thing.spriteIndex) {
						if (isValidSpriteId(spriteId)) {
							idsToLoad.push(spriteId);
						}
					}
				}
			}

			if (idsToLoad.length > 0) {
				await loadSpriteIds(data.sprPath, idsToLoad, data.transparency, data.sprites);
				notifySpritesLoaded();
			}
		};

		loadSprites();
	}, [searchResults, data, notifySpritesLoaded]);

	useEffect(() => {
		if (!data) {
			const datPath = localStorage.getItem('sprite-forge-dat-path');
			const sprPath = localStorage.getItem('sprite-forge-spr-path');
			const transparency = localStorage.getItem('sprite-forge-transparency') === 'true';
			const spritesCount = parseInt(localStorage.getItem('sprite-forge-sprites-count') || '0');

			if (datPath && sprPath) {
				const minimalData: any = {
					datPath,
					sprPath,
					transparency,
					items: new Map(),
					sprites: new Map(),
					outfits: new Map(),
					effects: new Map(),
					missiles: new Map(),
					version: { value: 0 },
					spritesCount: spritesCount || 999999
				};
				setData(minimalData, {} as any, true);
			}
		}
	}, [data, setData]);

	const handleClear = useCallback(() => {
		setProperties(PROPERTIES.reduce((acc, prop) => ({ ...acc, [prop.property]: false }), {}));
		setName('');
		setSpriteIdInput('');
		setSearchResults([]);
		setResultThings(new Map());
		setSimilarityRefs([]);
		setSelectedResultId(null);
		setSelectedResultCategory(null);
		setSelectedKeys(new Set());
		setAnchorKey(null);
	}, []);

	const handleMinimize = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const appWindow = getCurrentWindow();
		await appWindow.minimize();
	};

	const handleMaximize = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const appWindow = getCurrentWindow();
		await appWindow.toggleMaximize();
	};

	const handleClose = useCallback(
		async (e?: React.MouseEvent) => {
			e?.stopPropagation();
			handleClear();
			const appWindow = getCurrentWindow();
			await appWindow.hide();
		},
		[handleClear]
	);

	useEffect(() => {
		let unlisten: undefined | (() => void);

		const setupListener = async () => {
			const { listen } = await import('@tauri-apps/api/event');
			unlisten = await listen('data_cleared', () => {
				handleClose();
			});
		};

		setupListener();

		return () => {
			if (unlisten) unlisten();
		};
	}, [handleClose]);

	const pendingSpriteIdRef = useRef<null | number>(null);
	useEffect(() => {
		let unlisten: undefined | (() => void);
		const setupListener = async () => {
			const { listen } = await import('@tauri-apps/api/event');
			unlisten = await listen<{ spriteId: number }>('find_by_sprite', (event) => {
				const sid = event.payload?.spriteId;
				if (!sid || sid <= 0) return;
				setProperties(PROPERTIES.reduce((acc, prop) => ({ ...acc, [prop.property]: false }), {}));
				setName('');
				setSelectedCategory('all');
				setSpriteIdInput(String(sid));
				pendingSpriteIdRef.current = sid;
			});
		};
		setupListener();
		return () => {
			if (unlisten) unlisten();
		};
	}, []);

	useEffect(() => {
		if (pendingSpriteIdRef.current !== null && spriteIdInput === String(pendingSpriteIdRef.current)) {
			pendingSpriteIdRef.current = null;
			handleFind();
		}
	}, [spriteIdInput, handleFind]);

	const pendingSimilarityRef = useRef<boolean>(false);

	const applySimilarityRefs = useCallback((refs: SimilarityRef[]) => {
		const cleaned = refs.filter((r) => typeof r.id === 'number' && r.category);
		if (cleaned.length === 0) return;
		setProperties(PROPERTIES.reduce((acc, prop) => ({ ...acc, [prop.property]: false }), {}));
		setName('');
		setSpriteIdInput('');
		const categories = new Set(cleaned.map((r) => r.category));
		setSelectedCategory(categories.size === 1 ? [...categories][0] : 'all');
		setSimilarityRefs(cleaned);
		pendingSimilarityRef.current = true;
	}, []);

	const handleFindSimilarFromResult = useCallback(
		(targets: Array<{ id: number; category: ThingCategory }>) => {
			applySimilarityRefs(targets.map((t) => ({ id: t.id, category: t.category })));
		},
		[applySimilarityRefs]
	);

	useEffect(() => {
		const raw = localStorage.getItem('sprite-forge-pending-find-similar');
		if (!raw) return;
		try {
			const parsed = JSON.parse(raw) as { ts: number; refs: SimilarityRef[] };
			if (Date.now() - parsed.ts < 30_000 && Array.isArray(parsed.refs)) {
				applySimilarityRefs(parsed.refs);
			}
		} catch {
			/* noop */
		}
		localStorage.removeItem('sprite-forge-pending-find-similar');
	}, [applySimilarityRefs]);

	useEffect(() => {
		let unlisten: undefined | (() => void);
		const setupListener = async () => {
			const { listen } = await import('@tauri-apps/api/event');
			unlisten = await listen<{ refs: SimilarityRef[] }>('find_similar', (event) => {
				applySimilarityRefs(event.payload?.refs || []);
			});
		};
		setupListener();
		return () => {
			if (unlisten) unlisten();
		};
	}, [applySimilarityRefs]);

	useEffect(() => {
		if (pendingSimilarityRef.current && similarityRefs.length > 0) {
			pendingSimilarityRef.current = false;
			handleFind();
		}
	}, [similarityRefs, handleFind]);

	const isMac = navigator.userAgent.includes('Mac');

	return (
		<div className="h-screen w-screen flex flex-col bg-background rounded-xl overflow-hidden border border-white/10 shadow-2xl">
			<div
				data-tauri-drag-region
				className="h-8 bg-toolbar-bg border-b border-border/50 flex items-center justify-between px-4 relative flex-shrink-0"
			>
				{isMac ? (
					<>
						<div className="flex items-center gap-2 group">
							<div
								onClick={handleClose}
								onMouseDown={(e) => e.stopPropagation()}
								className="w-3 h-3 rounded-full bg-[#FF5F56] hover:bg-[#FF5F56]/80 cursor-pointer flex items-center justify-center border border-black/10 transition-colors"
							>
								<X className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
							</div>
							<div
								onClick={handleMinimize}
								onMouseDown={(e) => e.stopPropagation()}
								className="w-3 h-3 rounded-full bg-[#FFBD2E] hover:bg-[#FFBD2E]/80 cursor-pointer flex items-center justify-center border border-black/10 transition-colors"
							>
								<Minus className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
							</div>
							<div
								onClick={handleMaximize}
								onMouseDown={(e) => e.stopPropagation()}
								className="w-3 h-3 rounded-full bg-[#27C93F] hover:bg-[#27C93F]/80 cursor-pointer flex items-center justify-center border border-black/10 transition-colors"
							>
								<Square className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
							</div>
						</div>
						<span className="text-sm font-medium absolute left-1/2 -translate-x-1/2">Find</span>
						<div></div>
					</>
				) : (
					<>
						<span className="text-sm font-medium">Find</span>
						<div className="flex items-center gap-1">
							<Button
								size="icon"
								variant="ghost"
								onClick={handleMinimize}
								onMouseDown={(e) => e.stopPropagation()}
								className="h-8 w-8 hover:bg-secondary/50"
							>
								<Minus className="h-4 w-4" />
							</Button>
							<Button
								size="icon"
								variant="ghost"
								onClick={handleMaximize}
								onMouseDown={(e) => e.stopPropagation()}
								className="h-8 w-8 hover:bg-secondary/50"
							>
								<Square className="h-3.5 w-3.5" />
							</Button>
							<Button
								size="icon"
								variant="ghost"
								onClick={handleClose}
								onMouseDown={(e) => e.stopPropagation()}
								className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</>
				)}
			</div>

			<Tabs defaultValue="objects" className="flex-1 flex flex-col overflow-hidden">
				<div className="border-b border-border px-4 flex-shrink-0">
					<TabsList className="h-8 bg-transparent p-0 gap-0">
						<TabsTrigger
							value="objects"
							className="h-8 px-3 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
						>
							Objects
						</TabsTrigger>
					</TabsList>
				</div>

				<TabsContent value="objects" className="flex-1 flex overflow-hidden mt-0 p-2 gap-2">
					<div className="w-72 bg-card rounded-lg shadow-island flex flex-col overflow-hidden flex-shrink-0">
						<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80 flex-shrink-0">
							<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">
								{similarityRefs.length > 0 ? 'Similarity' : 'Filters'}
							</h2>
						</div>

						{similarityRefs.length > 0 && (
							<>
								<div className="p-3 flex-shrink-0 border-b border-border/50">
									<label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
										<Sparkles className="h-3 w-3" />
										<span>Similar to</span>
									</label>
									<div className="flex flex-wrap gap-1">
										{similarityRefs.map((r) => (
											<div
												key={`${r.category}-${r.id}`}
												className="flex items-center gap-1 bg-secondary/80 rounded px-1.5 py-0.5 text-[10px] font-mono"
											>
												<span className="text-foreground">
													{r.category.charAt(0).toUpperCase()}#{r.id}
												</span>
												<button
													className="text-muted-foreground hover:text-destructive"
													onClick={() =>
														setSimilarityRefs((prev) => prev.filter((x) => !(x.id === r.id && x.category === r.category)))
													}
												>
													<X className="h-2.5 w-2.5" />
												</button>
											</div>
										))}
									</div>
								</div>

								<div className="p-3 flex-shrink-0 border-b border-border/50">
									<label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center justify-between">
										<span>Min similarity</span>
										<span className="font-mono text-foreground">{similarityThreshold}%</span>
									</label>
									<Slider
										min={0}
										step={1}
										max={100}
										value={[similarityThreshold]}
										onValueChange={(v) => setSimilarityThreshold(v[0] ?? 70)}
									/>
								</div>
							</>
						)}

						<div className="p-3 flex-shrink-0">
							<label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
								Category
							</label>
							<Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as 'all' | ThingCategory)}>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue placeholder="All" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All</SelectItem>
									{TIBIA_FORMAT_CONFIG.categories.map((cat) => (
										<SelectItem key={cat.id} value={cat.id}>
											{cat.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{similarityRefs.length === 0 && (
							<>
								<div className="px-3 pb-1 flex-shrink-0">
									<label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
										Properties
									</label>
								</div>
								<ScrollArea className="flex-1 px-3">
									<div className="space-y-2 pb-2">
										{PROPERTIES.filter((prop) => {
											if (selectedCategory === 'all' || selectedCategory === 'item') return true;
											const relevantProps = ['hasLight', 'hasOffset', 'animateAlways'];
											return relevantProps.includes(prop.property);
										}).map((prop) => (
											<div key={prop.property} className="flex items-center justify-between">
												<span className="text-xs">{prop.display}</span>
												<Switch
													checked={properties[prop.property] || false}
													onCheckedChange={() => handlePropertyToggle(prop.property)}
												/>
											</div>
										))}
									</div>
								</ScrollArea>

								<div className="p-3 border-t border-border/50 flex-shrink-0">
									<label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
										Name
									</label>
									<Input value={name} placeholder="" className="h-8 text-xs" onChange={(e) => setName(e.target.value)} />
								</div>

								<div className="px-3 pb-3 flex-shrink-0">
									<label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
										Sprite ID
									</label>
									<Input
										placeholder=""
										inputMode="numeric"
										value={spriteIdInput}
										className="h-8 text-xs font-mono"
										onChange={(e) => setSpriteIdInput(e.target.value.replace(/\D/g, ''))}
									/>
								</div>
							</>
						)}
					</div>

					<div className="flex-1 bg-card rounded-lg shadow-island flex flex-col overflow-hidden">
						<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80 flex-shrink-0">
							<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Found</h2>
							{searchResults.length > 0 && (
								<span className="ml-auto text-xs text-muted-foreground font-mono">{searchResults.length}</span>
							)}
							{searchResults.length > 0 && (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button size="icon" variant="ghost" className="h-6 w-6 p-0 ml-2 hover:bg-secondary">
											{viewMode === 'list' && <List className="h-3.5 w-3.5 text-muted-foreground" />}
											{viewMode === 'grid' && <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />}
											{viewMode === 'compact' && <Columns className="h-3.5 w-3.5 text-muted-foreground" />}
											{viewMode === 'large' && <Square className="h-3.5 w-3.5 text-muted-foreground" />}
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => setViewMode('list')}>
											<List className="mr-2 h-4 w-4" />
											<span>List</span>
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => setViewMode('grid')}>
											<LayoutGrid className="mr-2 h-4 w-4" />
											<span>Grid (50/50)</span>
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => setViewMode('compact')}>
											<Columns className="mr-2 h-4 w-4" />
											<span>Compact</span>
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => setViewMode('large')}>
											<Square className="mr-2 h-4 w-4" />
											<span>Large</span>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</div>
						<div className="flex-1 p-2 overflow-hidden flex flex-col">
							{isSearching ? (
								<div className="text-xs text-muted-foreground p-4 text-center">Searching...</div>
							) : searchResults.length === 0 ? (
								<div className="text-xs text-muted-foreground p-4 text-center">
									{similarityRefs.length > 0
										? 'No matches above the similarity threshold'
										: name.trim() === '' && spriteIdInput.trim() === '' && Object.values(properties).every((v) => !v)
											? 'Enter a name, sprite ID or select properties to search'
											: 'No results'}
								</div>
							) : (
								<div ref={parentRef} className="h-full overflow-auto">
									<div
										style={{
											width: '100%',
											position: 'relative',
											height: `${virtualizer.getTotalSize()}px`
										}}
									>
										{virtualizer.getVirtualItems().map((virtualRow) => {
											const rowStartIndex = virtualRow.index * itemsPerRow;
											const rowEndIndex = Math.min(rowStartIndex + itemsPerRow, searchResults.length);
											const rowItems = searchResults.slice(rowStartIndex, rowEndIndex);

											return (
												<div
													key={virtualRow.index}
													data-index={virtualRow.index}
													ref={virtualizer.measureElement}
													className={cn(
														viewMode === 'list' && 'px-2',
														viewMode === 'grid' && 'px-1',
														viewMode === 'compact' && 'px-1',
														viewMode === 'large' && 'px-1'
													)}
													style={{
														top: 0,
														left: 0,
														width: '100%',
														display: 'flex',
														position: 'absolute',
														gap: viewMode === 'compact' ? '2px' : '4px',
														transform: `translateY(${virtualRow.start}px)`
													}}
												>
													{rowItems.map((result) => {
														const key = `${result.category}-${result.id}`;
														const thing = resultThings.get(key);
														const isSelected = selectedKeys.has(key);
														const selectionTargets =
															isSelected && selectedKeys.size > 1
																? searchResults.filter((r) => selectedKeys.has(`${r.category}-${r.id}`))
																: [{ id: result.id, category: result.category }];
														const isMulti = selectionTargets.length > 1;

														return (
															<ContextMenu key={key}>
																<ContextMenuTrigger asChild>
																	<div
																		onClick={(e) => handleResultClick(result.id, result.category, e)}
																		onContextMenu={() => handleContextMenuTarget(result.id, result.category)}
																		onDoubleClick={() => handleResultDoubleClick(result.id, result.category)}
																		style={{
																			width: viewMode === 'list' || viewMode === 'large' ? '100%' : `${100 / itemsPerRow}%`,
																			flex:
																				viewMode === 'list' || viewMode === 'large'
																					? '1'
																					: `0 0 calc(${100 / itemsPerRow}% - ${viewMode === 'compact' ? 2 : 4}px)`
																		}}
																		className={cn(
																			'text-xs rounded cursor-pointer transition-colors',
																			isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
																			viewMode === 'list' && 'p-2 flex items-center gap-2 h-10',
																			viewMode === 'grid' && 'p-1 flex items-center gap-1.5 h-[50px]',
																			viewMode === 'compact' && 'p-0.5 flex flex-col items-center gap-0.5 h-[74px]',
																			viewMode === 'large' && 'p-1 flex items-center gap-1.5 h-[140px]'
																		)}
																	>
																		{thing && (
																			<CheckerBoard
																				className={cn(
																					'flex-shrink-0 border border-border/50 rounded overflow-hidden flex items-center justify-center',
																					viewMode === 'list' && 'w-8 h-8',
																					viewMode === 'grid' && 'w-12 h-12',
																					viewMode === 'compact' && 'w-12 h-12',
																					viewMode === 'large' && 'w-32 h-32'
																				)}
																			>
																				<SpriteCanvas
																					showEmpty
																					thing={thing}
																					renderMode="list"
																					width={thing.width}
																					height={thing.height}
																					scale={
																						viewMode === 'list'
																							? 32 / (Math.max(thing.width, thing.height) * spriteSize)
																							: viewMode === 'grid' || viewMode === 'compact'
																								? 48 / (Math.max(thing.width, thing.height) * spriteSize)
																								: 128 / (Math.max(thing.width, thing.height) * spriteSize)
																					}
																				/>
																			</CheckerBoard>
																		)}
																		<div
																			className={cn(
																				'min-w-0',
																				viewMode === 'list' && 'flex-1 text-left',
																				viewMode === 'grid' && 'flex-1 text-right',
																				viewMode === 'compact' && 'text-center w-full truncate',
																				viewMode === 'large' && 'flex-1 text-right'
																			)}
																		>
																			{viewMode === 'grid' || viewMode === 'large' ? (
																				<div className="text-[11px] text-foreground font-mono font-medium leading-tight">
																					{result.id}
																				</div>
																			) : viewMode === 'compact' ? (
																				<div className="text-[11px] text-foreground font-mono font-medium leading-tight">
																					{result.id}
																				</div>
																			) : (
																				<span>
																					{result.category.charAt(0).toUpperCase() + result.category.slice(1)} #{result.id}
																				</span>
																			)}
																		</div>
																	</div>
																</ContextMenuTrigger>
																<ContextMenuContent>
																	<ContextMenuItem
																		disabled={isMulti}
																		onClick={() => handleResultDoubleClick(result.id, result.category)}
																	>
																		<Edit className="mr-2 h-4 w-4" />
																		<span>Edit</span>
																	</ContextMenuItem>
																	<ContextMenuItem onClick={() => emitFindAction('duplicate', selectionTargets)}>
																		<Copy className="mr-2 h-4 w-4" />
																		<span>{isMulti ? `Duplicate (${selectionTargets.length})` : 'Duplicate'}</span>
																	</ContextMenuItem>
																	<ContextMenuItem
																		disabled={isMulti ? false : !canFindSimilarThing(thing)}
																		onClick={() => handleFindSimilarFromResult(selectionTargets)}
																	>
																		<Sparkles className="mr-2 h-4 w-4" />
																		<span>{isMulti ? `Find Similar (${selectionTargets.length})` : 'Find Similar'}</span>
																	</ContextMenuItem>
																	<ContextMenuItem
																		disabled={isMulti}
																		onClick={() => emitFindAction('copy_properties', selectionTargets)}
																	>
																		<Clipboard className="mr-2 h-4 w-4" />
																		<span>Copy Properties</span>
																	</ContextMenuItem>
																	<ContextMenuItem onClick={() => emitFindAction('paste_properties', selectionTargets)}>
																		<ClipboardPaste className="mr-2 h-4 w-4" />
																		<span>{isMulti ? `Paste Properties (${selectionTargets.length})` : 'Paste Properties'}</span>
																	</ContextMenuItem>
																	<ContextMenuItem onClick={() => emitFindAction('export_sheet', selectionTargets)}>
																		<Download className="mr-2 h-4 w-4" />
																		<span>
																			{isMulti ? `Export Object Sheets (${selectionTargets.length})` : 'Export Object Sheet'}
																		</span>
																	</ContextMenuItem>
																	<ContextMenuItem
																		disabled={isMulti}
																		onClick={() => emitFindAction('import_sheet', selectionTargets)}
																	>
																		<Upload className="mr-2 h-4 w-4" />
																		<span>Import Object Sheet</span>
																	</ContextMenuItem>
																</ContextMenuContent>
															</ContextMenu>
														);
													})}
												</div>
											);
										})}
									</div>
								</div>
							)}
						</div>
					</div>
				</TabsContent>
			</Tabs>

			<div className="px-2 pb-2 flex-shrink-0">
				<div className="h-10 bg-card rounded-lg shadow-island flex items-center justify-between gap-2 px-3">
					<Button
						size="sm"
						variant="outline"
						onClick={handleClear}
						className="h-8 text-xs"
						disabled={
							name.trim() === '' &&
							spriteIdInput.trim() === '' &&
							Object.values(properties).every((v) => !v) &&
							similarityRefs.length === 0 &&
							searchResults.length === 0
						}
					>
						<Trash2 className="h-3.5 w-3.5 mr-1.5" />
						Clear
					</Button>
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							className="h-8 text-xs"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								handleFind();
							}}
							disabled={
								isSearching ||
								(similarityRefs.length === 0 &&
									name.trim() === '' &&
									spriteIdInput.trim() === '' &&
									Object.values(properties).every((v) => !v))
							}
						>
							{isSearching ? 'Searching...' : similarityRefs.length > 0 ? 'Find similar' : 'Find'}
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={handleSelect}
							className="h-8 text-xs"
							disabled={selectedResultId === null}
						>
							Select
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};
