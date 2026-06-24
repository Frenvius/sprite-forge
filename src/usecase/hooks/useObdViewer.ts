import type { ThingType } from '~/lib/formats/tibia';
import type { ObdRow, ObdStats, ObdThumb, ObdProgress } from '~/lib/formats/tibia/obdViewer';

import React from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

import { useToast } from './use-toast';
import { useTransfer } from '~/usecase/context/TransferContext';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { obdOpen, obdClear, obdQuery, obdStats, obdThumbs, obdGetPaths } from '~/lib/formats/tibia/obdViewer';
import {
	ThingCategory,
	readFileBytes,
	getCategoryMap,
	setCategoryCount,
	extractObdEntries,
	getCategoryStartId,
	TIBIA_FORMAT_CONFIG
} from '~/lib/formats/tibia';

const CELL = 96;
const WINDOW_ROWS = 8;
const THUMB_CAP = 6000;

const nextSpriteBase = (sprites: Map<number, unknown>, spritesCount: number): number => {
	let base = spritesCount + 1;
	for (const id of sprites.keys()) if (id >= base) base = id + 1;
	return base;
};

export const useObdViewer = () => {
	const { toast } = useToast();
	const { obdViewerOpen, closeObdViewer } = useTransfer();
	const { data, updateThing, markAsNewItem, notifyDataChanged, notifySpritesLoaded } = useAssetData();

	const scrollRef = React.useRef<HTMLDivElement>(null);
	const [parentWidth, setParentWidth] = React.useState(0);

	const [category, setCategory] = React.useState(0);
	const [dupOnly, setDupOnly] = React.useState(false);
	const [search, setSearch] = React.useState('');
	const [debouncedSearch, setDebouncedSearch] = React.useState('');

	const [total, setTotal] = React.useState(0);
	const [status, setStatus] = React.useState(0);
	const [stats, setStats] = React.useState<null | ObdStats>(null);
	const [progress, setProgress] = React.useState<null | ObdProgress>(null);

	const [selected, setSelected] = React.useState<Set<number>>(new Set());
	const [busy, setBusy] = React.useState(false);
	const [, setTick] = React.useState(0);

	const metaRef = React.useRef<Map<number, ObdRow>>(new Map());
	const thumbRef = React.useRef<Map<number, null | ObdThumb>>(new Map());
	const tokenRef = React.useRef(0);
	const inflightRef = React.useRef<Set<string>>(new Set());

	const itemsPerRow = Math.max(1, Math.floor((parentWidth || 600) / CELL));

	React.useEffect(() => {
		const t = setTimeout(() => setDebouncedSearch(search), 200);
		return () => clearTimeout(t);
	}, [search]);

	React.useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const ro = new ResizeObserver((entries) => setParentWidth(entries[0].contentRect.width));
		ro.observe(el);
		return () => ro.disconnect();
	}, [obdViewerOpen]);

	const resetCaches = React.useCallback(() => {
		metaRef.current.clear();
		inflightRef.current.clear();
		tokenRef.current++;
	}, []);

	const ensureThumbs = React.useCallback(async (recordIndices: number[]) => {
		const need = recordIndices.filter((ri) => thumbRef.current.get(ri) === undefined);
		if (!need.length) return;
		const token = tokenRef.current;
		for (const ri of need) thumbRef.current.set(ri, null);
		try {
			const thumbs = await obdThumbs(need);
			if (token !== tokenRef.current) return;
			for (const t of thumbs) thumbRef.current.set(t.recordIndex, t);

			if (thumbRef.current.size > THUMB_CAP) {
				const excess = thumbRef.current.size - Math.floor(THUMB_CAP * 0.8);
				let i = 0;
				for (const k of thumbRef.current.keys()) {
					if (i++ >= excess) break;
					thumbRef.current.delete(k);
				}
			}
			setTick((x) => x + 1);
		} catch (e) {
			console.error('obd thumbs failed', e);
		}
	}, []);

	const loadWindow = React.useCallback(
		async (offset: number, limit: number) => {
			if (limit <= 0) limit = 1;
			const token = tokenRef.current;
			const key = `${offset}:${limit}`;
			if (inflightRef.current.has(key)) return;
			inflightRef.current.add(key);
			try {
				const res = await obdQuery({ limit, offset, dupOnly, category, search: debouncedSearch });
				if (token !== tokenRef.current) return;
				setTotal(res.total);
				setStatus(res.status);
				for (let i = 0; i < res.rows.length; i++) metaRef.current.set(offset + i, res.rows[i]);
				setTick((x) => x + 1);
				void ensureThumbs(res.rows.map((r) => r.recordIndex));
			} catch (e) {
				console.error('obd loadWindow failed', e);
			} finally {
				inflightRef.current.delete(key);
			}
		},
		[category, dupOnly, debouncedSearch, ensureThumbs]
	);

	const ensureVisible = React.useCallback(
		(startPos: number, endPos: number) => {
			let needMeta = false;
			const thumbIds: number[] = [];
			for (let p = startPos; p < endPos; p++) {
				const row = metaRef.current.get(p);
				if (!row) needMeta = true;
				else if (thumbRef.current.get(row.recordIndex) === undefined) thumbIds.push(row.recordIndex);
			}
			if (needMeta) void loadWindow(startPos, Math.max(itemsPerRow * WINDOW_ROWS, endPos - startPos));
			else if (thumbIds.length) void ensureThumbs(thumbIds);
		},
		[loadWindow, ensureThumbs, itemsPerRow]
	);

	React.useEffect(() => {
		if (!obdViewerOpen) return;
		resetCaches();
		setTotal(0);
		if (scrollRef.current) scrollRef.current.scrollTop = 0;
		void loadWindow(0, itemsPerRow * WINDOW_ROWS);
	}, [obdViewerOpen, category, dupOnly, debouncedSearch, itemsPerRow, resetCaches, loadWindow]);

	React.useEffect(() => {
		if (!obdViewerOpen || status !== 1) return;
		let active = true;
		const tick = async () => {
			const s = await obdStats().catch(() => null);
			if (!s || !active) return;
			setStats(s);
			setStatus(s.status);
			const res = await obdQuery({ dupOnly, category, limit: 1, offset: 0, search: debouncedSearch }).catch(() => null);
			if (active && res) setTotal(res.total);
		};
		void tick();
		const id = setInterval(() => void tick(), 500);
		return () => {
			active = false;
			clearInterval(id);
		};
	}, [obdViewerOpen, status, category, dupOnly, debouncedSearch]);

	const startOpen = React.useCallback(
		async (paths: string[], recursive: boolean) => {
			thumbRef.current.clear();
			resetCaches();
			setSelected(new Set());
			setTotal(0);
			setProgress(null);
			setStats(null);
			setStatus(1);
			try {
				await obdClear();
				await obdOpen(paths, recursive);
				void loadWindow(0, itemsPerRow * WINDOW_ROWS);
			} catch (e) {
				toast({ variant: 'destructive', description: `Failed to open: ${e}` });
				setStatus(0);
			}
		},
		[resetCaches, loadWindow, itemsPerRow, toast]
	);

	const openFiles = React.useCallback(async () => {
		const sel = await open({ multiple: true, filters: [{ name: 'OBD File', extensions: ['obd'] }] });
		if (!sel) return;
		void startOpen(Array.isArray(sel) ? sel : [sel], false);
	}, [startOpen]);

	const openFolder = React.useCallback(async () => {
		const dir = await open({ directory: true, multiple: false });
		if (!dir || typeof dir !== 'string') return;
		void startOpen([dir], true);
	}, [startOpen]);

	React.useEffect(() => {
		if (!obdViewerOpen) return;
		let unlisten: undefined | (() => void);
		let cancelled = false;
		getCurrentWebviewWindow()
			.onDragDropEvent((event) => {
				if (event.payload.type !== 'drop') return;
				const paths = event.payload.paths;
				if (paths.length) void startOpen(paths, true);
			})
			.then((fn) => (cancelled ? fn() : (unlisten = fn)));
		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, [obdViewerOpen, startOpen]);

	React.useEffect(() => {
		if (!obdViewerOpen) return;
		let cancelled = false;
		let unP: undefined | (() => void);
		let unD: undefined | (() => void);
		listen<ObdProgress>('obd_progress', (e) => setProgress(e.payload)).then((f) => (cancelled ? f() : (unP = f)));
		listen<ObdProgress>('obd_done', (e) => {
			setProgress(e.payload);
			setStatus(2);
			void obdStats().then((s) => setStats(s));
			resetCaches();
			void loadWindow(0, itemsPerRow * WINDOW_ROWS);
		}).then((f) => (cancelled ? f() : (unD = f)));
		return () => {
			cancelled = true;
			unP?.();
			unD?.();
		};
	}, [obdViewerOpen, resetCaches, loadWindow, itemsPerRow]);

	const toggle = React.useCallback((recordIndex: number) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(recordIndex)) next.delete(recordIndex);
			else next.add(recordIndex);
			return next;
		});
	}, []);

	const clearSelection = React.useCallback(() => setSelected(new Set()), []);

	const importSelected = React.useCallback(async () => {
		if (!data || selected.size === 0) return;
		setBusy(true);
		try {
			const indices = Array.from(selected);
			const paths = await obdGetPaths(indices);
			const files = await Promise.all(paths.map(readFileBytes));
			const base = nextSpriteBase(data.sprites, data.spritesCount);
			const result = await extractObdEntries(files, base, data.transparency);

			let maxId = data.spritesCount;
			for (const sprite of result.sprites) {
				data.sprites.set(sprite.id, sprite);
				if (sprite.id > maxId) maxId = sprite.id;
			}
			data.spritesCount = maxId;

			for (const thing of result.things) {
				const cat = thing.category as ThingCategory;
				const map = getCategoryMap(data, cat);
				let nextId = getCategoryStartId(TIBIA_FORMAT_CONFIG, cat);
				while (map.has(nextId)) nextId++;
				thing.id = nextId;
				map.set(nextId, thing as ThingType);
				setCategoryCount(data, cat, map.size);
				updateThing(nextId, cat, thing as ThingType);
				markAsNewItem(nextId, cat);
			}

			notifyDataChanged(result.sprites.map((s) => s.id));
			notifySpritesLoaded();
			toast({ description: `Imported ${result.things.length} object${result.things.length === 1 ? '' : 's'}` });
			clearSelection();
		} catch (e) {
			toast({ variant: 'destructive', description: `Import failed: ${e}` });
		} finally {
			setBusy(false);
		}
	}, [data, selected, updateThing, markAsNewItem, notifyDataChanged, notifySpritesLoaded, toast, clearSelection]);

	const getRow = React.useCallback((position: number) => metaRef.current.get(position), []);
	const getThumb = React.useCallback((recordIndex: number) => thumbRef.current.get(recordIndex) ?? null, []);

	return {
		busy,
		stats,
		total,
		status,
		search,
		getRow,
		toggle,
		dupOnly,
		category,
		getThumb,
		selected,
		progress,
		scrollRef,
		openFiles,
		setSearch,
		openFolder,
		setDupOnly,
		setCategory,
		itemsPerRow,
		ensureVisible,
		obdViewerOpen,
		clearSelection,
		importSelected,
		closeObdViewer,
		hasProject: !!data
	};
};
