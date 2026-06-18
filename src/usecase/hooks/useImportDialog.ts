import type { ThingType, ImportSource, ImportManifest } from '@/lib/formats/tibia';

import React from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useTransfer } from '@/usecase/context/TransferContext';
import { useAssetData } from '@/usecase/context/AssetDataContext';
import {
	ThingCategory,
	readFileBytes,
	readObdManifest,
	readSfpManifest,
	setCategoryCount,
	extractObdEntries,
	extractSfpEntries,
	getCategoryStartId,
	TIBIA_FORMAT_CONFIG,
	getCategoryMap as getCategoryMapUtil
} from '@/lib/formats/tibia';

import { useToast } from './use-toast';

type CategoryFilter = 'all' | ThingCategory;

const nextSpriteBase = (sprites: Map<number, unknown>, spritesCount: number): number => {
	let base = spritesCount + 1;
	for (const id of sprites.keys()) {
		if (id >= base) base = id + 1;
	}
	return base;
};

export const useImportDialog = () => {
	const { toast } = useToast();
	const { importOpen, closeImport, importPreset } = useTransfer();
	const { data, updateThing, markAsNewItem, notifyDataChanged, notifySpritesLoaded } = useAssetData();

	const [busy, setBusy] = React.useState(false);
	const [loading, setLoading] = React.useState(false);
	const [search, setSearch] = React.useState('');
	const [filter, setFilter] = React.useState<CategoryFilter>('all');
	const [selected, setSelected] = React.useState<Set<number>>(new Set());
	const [manifest, setManifest] = React.useState<null | ImportManifest>(null);
	const [sourceFiles, setSourceFiles] = React.useState<Uint8Array[]>([]);

	const loadManifest = React.useCallback(
		async (source: ImportSource, files: Uint8Array[]) => {
			setLoading(true);
			setManifest(null);
			setSourceFiles(files);
			try {
				const result = source === 'sfp' ? await readSfpManifest(files[0]) : await readObdManifest(files);
				setManifest(result);
				setSelected(new Set(result.entries.map((e) => e.index)));
			} catch (err) {
				const message = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);
				toast({ variant: 'destructive', description: `Failed to read file: ${message}` });
			} finally {
				setLoading(false);
			}
		},
		[toast]
	);

	React.useEffect(() => {
		if (!importOpen) {
			setManifest(null);
			setSearch('');
			setFilter('all');
			setSelected(new Set());
			return;
		}
		if (importPreset) {
			void loadManifest(importPreset.source, importPreset.files);
		}
	}, [importOpen, importPreset, loadManifest]);

	const pickFile = React.useCallback(async () => {
		const selectedPaths = await open({
			multiple: true,
			filters: [
				{ name: 'Importable', extensions: ['sfp', 'obd'] },
				{ extensions: ['sfp'], name: 'Sprite Forge Pack' },
				{ extensions: ['obd'], name: 'Object Builder Data' }
			]
		});
		if (!selectedPaths) return;
		const paths = Array.isArray(selectedPaths) ? selectedPaths : [selectedPaths];
		const sfp = paths.find((p) => p.toLowerCase().endsWith('.sfp'));
		if (sfp) {
			void loadManifest('sfp', [await readFileBytes(sfp)]);
		} else {
			void loadManifest('obd', await Promise.all(paths.map(readFileBytes)));
		}
	}, [loadManifest]);

	const visibleEntries = React.useMemo(() => {
		if (!manifest) return [];
		const query = search.trim().toLowerCase();
		return manifest.entries.filter((e) => {
			if (filter !== 'all' && e.category !== filter) return false;
			if (query && !e.name.toLowerCase().includes(query) && !String(e.sourceId).includes(query)) return false;
			return true;
		});
	}, [manifest, filter, search]);

	const toggle = React.useCallback((index: number) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	}, []);

	const selectAll = React.useCallback(() => {
		setSelected(new Set(visibleEntries.map((e) => e.index)));
	}, [visibleEntries]);

	const selectNone = React.useCallback(() => setSelected(new Set()), []);

	const confirm = React.useCallback(async () => {
		if (!data || !manifest || selected.size === 0) return;
		setBusy(true);
		try {
			const indices = Array.from(selected).sort((a, b) => a - b);
			const base = nextSpriteBase(data.sprites, data.spritesCount);
			const result =
				manifest.source === 'sfp'
					? await extractSfpEntries(sourceFiles[0], indices, base, data.transparency)
					: await extractObdEntries(
							indices.map((i) => sourceFiles[i]),
							base,
							data.transparency
						);

			let maxId = data.spritesCount;
			for (const sprite of result.sprites) {
				data.sprites.set(sprite.id, sprite);
				if (sprite.id > maxId) maxId = sprite.id;
			}
			data.spritesCount = maxId;

			for (const thing of result.things) {
				const category = thing.category;
				const map = getCategoryMapUtil(data, category);
				let nextId = getCategoryStartId(TIBIA_FORMAT_CONFIG, category);
				while (map.has(nextId)) nextId++;
				thing.id = nextId;
				map.set(nextId, thing as ThingType);
				setCategoryCount(data, category, map.size);
				updateThing(nextId, category, thing as ThingType);
				markAsNewItem(nextId, category);
			}

			notifyDataChanged(result.sprites.map((s) => s.id));
			notifySpritesLoaded();

			toast({ description: `Imported ${result.things.length} object${result.things.length > 1 ? 's' : ''}` });
			closeImport();
		} catch (err) {
			const message = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);
			toast({ variant: 'destructive', description: `Import failed: ${message}` });
		} finally {
			setBusy(false);
		}
	}, [
		data,
		manifest,
		selected,
		sourceFiles,
		updateThing,
		markAsNewItem,
		notifyDataChanged,
		notifySpritesLoaded,
		toast,
		closeImport
	]);

	return {
		busy,
		filter,
		search,
		toggle,
		confirm,
		loading,
		manifest,
		selected,
		pickFile,
		setFilter,
		setSearch,
		selectAll,
		selectNone,
		importOpen,
		closeImport,
		visibleEntries
	};
};
