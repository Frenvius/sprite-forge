import type { ThingType, ThingCategory } from '~/lib/formats/tibia';
import type { ImportRow, ImportThumb, ImportStats, ImportProgress } from '~/lib/formats/tibia/importViewer';

import React from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

import { useToast } from './useToast';
import { useTransfer } from '~/usecase/context/TransferContext';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import {
	setCategoryCount,
	getCategoryStartId,
	TIBIA_FORMAT_CONFIG,
	getCategoryMap as getCategoryMapUtil
} from '~/lib/formats/tibia';
import {
	importClear,
	importQuery,
	importStats,
	importThumbs,
	importExtract,
	importOpenObd,
	importOpenSfp,
	importDupIndices
} from '~/lib/formats/tibia/importViewer';

const CELL = 150;
const WINDOW_ROWS = 6;
const THUMB_CAP = 6000;

const nextSpriteBase = (sprites: Map<number, unknown>, spritesCount: number): number => {
	let base = spritesCount + 1;
	for (const id of sprites.keys()) if (id >= base) base = id + 1;
	return base;
};

export const useImportDialog = () => {
	const { toast } = useToast();
	const { importOpen, closeImport, importPreset } = useTransfer();
	const { data, updateThing, markAsNewItem, notifyDataChanged, notifySpritesLoaded } = useAssetData();

	const scrollRef = React.useRef<HTMLDivElement>(null);
	const [gridWidth, setGridWidth] = React.useState(0);

	const [category, setCategory] = React.useState(0);
	const [dupOnly, setDupOnly] = React.useState(false);
	const [search, setSearch] = React.useState('');
	const [debouncedSearch, setDebouncedSearch] = React.useState('');

	const [total, setTotal] = React.useState(0);
	const [status, setStatus] = React.useState(0);
	const [stats, setStats] = React.useState<null | ImportStats>(null);
	const [progress, setProgress] = React.useState<null | ImportProgress>(null);

	const [selected, setSelected] = React.useState<Set<number>>(new Set());
	const [busy, setBusy] = React.useState(false);
	const [, setTick] = React.useState(0);

	const metaRef = React.useRef<Map<number, ImportRow>>(new Map());
	const thumbRef = React.useRef<Map<number, null | ImportThumb>>(new Map());
	const tokenRef = React.useRef(0);
	const inflightRef = React.useRef<Set<string>>(new Set());

	const itemsPerRow = Math.max(2, Math.floor((gridWidth || 760) / CELL));

	React.useEffect(() => {
		const t = setTimeout(() => setDebouncedSearch(search), 200);
		return () => clearTimeout(t);
	}, [search]);

	React.useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const ro = new ResizeObserver((entries) => setGridWidth(entries[0].contentRect.width));
		ro.observe(el);
		return () => ro.disconnect();
	}, [importOpen, status]);

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
			const thumbs = await importThumbs(need);
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
			console.error('import thumbs failed', e);
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
				const res = await importQuery({ limit, offset, dupOnly, category, search: debouncedSearch });
				if (token !== tokenRef.current) return;
				setTotal(res.total);
				setStatus(res.status);
				for (let i = 0; i < res.rows.length; i++) metaRef.current.set(offset + i, res.rows[i]);
				setTick((x) => x + 1);
				void ensureThumbs(res.rows.map((r) => r.recordIndex));
			} catch (e) {
				console.error('import loadWindow failed', e);
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
		if (!importOpen) return;
		resetCaches();
		setTotal(0);
		if (scrollRef.current) scrollRef.current.scrollTop = 0;
		void loadWindow(0, itemsPerRow * WINDOW_ROWS);
	}, [importOpen, category, dupOnly, debouncedSearch, itemsPerRow, resetCaches, loadWindow]);

	React.useEffect(() => {
		if (!importOpen || status !== 1) return;
		let active = true;
		const tick = async () => {
			const s = await importStats().catch(() => null);
			if (!s || !active) return;
			setStats(s);
			setStatus(s.status);
			const res = await importQuery({ dupOnly, category, limit: 1, offset: 0, search: debouncedSearch }).catch(() => null);
			if (active && res) setTotal(res.total);
		};
		void tick();
		const id = setInterval(() => void tick(), 500);
		return () => {
			active = false;
			clearInterval(id);
		};
	}, [importOpen, status, category, dupOnly, debouncedSearch]);

	const startOpen = React.useCallback(
		async (source: 'sfp' | 'obd', paths: string[]) => {
			thumbRef.current.clear();
			resetCaches();
			setSelected(new Set());
			setTotal(0);
			setProgress(null);
			setStats(null);
			setStatus(1);
			try {
				await importClear();
				if (source === 'sfp') await importOpenSfp(paths[0]);
				else await importOpenObd(paths, true);
				void loadWindow(0, itemsPerRow * WINDOW_ROWS);
			} catch (e) {
				toast({ variant: 'destructive', description: `Failed to read file: ${e}` });
				setStatus(0);
			}
		},
		[resetCaches, loadWindow, itemsPerRow, toast]
	);

	React.useEffect(() => {
		if (!importOpen) {
			setSearch('');
			setCategory(0);
			setDupOnly(false);
			setSelected(new Set());
			void importClear();
			return;
		}
		if (importPreset) void startOpen(importPreset.source, importPreset.paths);
	}, [importOpen, importPreset, startOpen]);

	React.useEffect(() => {
		if (!importOpen) return;
		let cancelled = false;
		let unP: undefined | (() => void);
		let unD: undefined | (() => void);
		listen<ImportProgress>('import_progress', (e) => setProgress(e.payload)).then((f) => (cancelled ? f() : (unP = f)));
		listen<ImportProgress>('import_done', (e) => {
			setProgress(e.payload);
			setStatus(2);
			setSelected(new Set(Array.from({ length: e.payload.total }, (_, i) => i)));
			void importStats().then((s) => setStats(s));
			resetCaches();
			void loadWindow(0, itemsPerRow * WINDOW_ROWS);
		}).then((f) => (cancelled ? f() : (unD = f)));
		return () => {
			cancelled = true;
			unP?.();
			unD?.();
		};
	}, [importOpen, resetCaches, loadWindow, itemsPerRow]);

	const pickFile = React.useCallback(async () => {
		const sel = await open({
			multiple: true,
			filters: [
				{ name: 'Importable', extensions: ['sfp', 'obd'] },
				{ extensions: ['sfp'], name: 'Sprite Forge Pack' },
				{ name: 'OBD File', extensions: ['obd'] }
			]
		});
		if (!sel) return;
		const paths = Array.isArray(sel) ? sel : [sel];
		const sfp = paths.find((p) => p.toLowerCase().endsWith('.sfp'));
		if (sfp) void startOpen('sfp', [sfp]);
		else void startOpen('obd', paths);
	}, [startOpen]);

	const toggle = React.useCallback((recordIndex: number) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(recordIndex)) next.delete(recordIndex);
			else next.add(recordIndex);
			return next;
		});
	}, []);

	const selectAll = React.useCallback(() => {
		setSelected(new Set(Array.from({ length: total }, (_, i) => i)));
	}, [total]);

	const selectNone = React.useCallback(() => setSelected(new Set()), []);

	const deselectDuplicates = React.useCallback(async () => {
		const dups = await importDupIndices();
		setSelected((prev) => {
			const next = new Set(prev);
			for (const i of dups) next.delete(i);
			return next;
		});
	}, []);

	const confirm = React.useCallback(async () => {
		if (!data || selected.size === 0) return;
		setBusy(true);
		try {
			const indices = Array.from(selected).sort((a, b) => a - b);
			const base = nextSpriteBase(data.sprites, data.spritesCount);
			const result = await importExtract(indices, base, data.transparency);

			let maxId = data.spritesCount;
			for (const sprite of result.sprites) {
				data.sprites.set(sprite.id, sprite);
				if (sprite.id > maxId) maxId = sprite.id;
			}
			data.spritesCount = maxId;

			for (const thing of result.things) {
				const cat = thing.category as ThingCategory;
				const map = getCategoryMapUtil(data, cat);
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
			closeImport();
		} catch (err) {
			const message = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);
			toast({ variant: 'destructive', description: `Import failed: ${message}` });
		} finally {
			setBusy(false);
		}
	}, [data, selected, updateThing, markAsNewItem, notifyDataChanged, notifySpritesLoaded, toast, closeImport]);

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
		confirm,
		pickFile,
		category,
		selected,
		progress,
		getThumb,
		scrollRef,
		setSearch,
		selectAll,
		selectNone,
		setDupOnly,
		importOpen,
		setCategory,
		closeImport,
		itemsPerRow,
		ensureVisible,
		deselectDuplicates,
		duplicateCount: stats?.duplicates ?? 0
	};
};
