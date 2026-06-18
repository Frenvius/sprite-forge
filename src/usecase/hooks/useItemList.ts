import React from 'react';
import { logger, EventCode } from '@/lib/debug';
import { open } from '@tauri-apps/plugin-dialog';
import { useTransfer } from '@/usecase/context/TransferContext';
import { useListViewMode } from '@/usecase/hooks/useListViewMode';
import { useAssetData } from '@/usecase/context/AssetDataContext';
import { getThumbnailSpriteIds } from '@/usecase/util/thumbnailUtils';
import { readFileBytes, importObjectSheet } from '@/lib/formats/tibia';
import { useGeneralSettings } from '@/usecase/context/GeneralSettingsContext';
import {
	ThingCategory,
	type ThingType,
	isValidSpriteId,
	createThingType,
	getCategoryCount,
	setCategoryCount,
	getCategoryStartId,
	getCategoryMap as getCategoryMapUtil
} from '@/lib/formats/tibia';

import { useToast } from './use-toast';

export const useItemList = () => {
	const {
		data,
		isNewItem,
		spriteSize,
		updateThing,
		openedItemId,
		formatConfig,
		updateCounter,
		markAsNewItem,
		setOpenedItemId,
		selectedCategory,
		removeOpenedItem,
		highlightedItemId,
		hasUnsavedChanges,
		notifyDataChanged,
		markUnsavedChanges,
		setSelectedCategory,
		notifySpritesLoaded,
		setHighlightedItemId
	} = useAssetData();
	const { toast } = useToast();
	const { openExport, openImport } = useTransfer();
	const { viewMode, setViewMode } = useListViewMode('get_item_list_view_mode', 'set_item_list_view_mode');
	const [currentPage, setCurrentPage] = React.useState<number>(1);
	const [copiedProperties, setCopiedProperties] = React.useState<null | Partial<ThingType>>(null);
	const [inputValue, setInputValue] = React.useState<string>('');
	const [selectedItemIds, setSelectedItemIds] = React.useState<Set<number>>(new Set());

	const scrollViewportRef = React.useRef<HTMLDivElement>(null);
	const shouldScrollToHighlightedRef = React.useRef(false);
	const pendingNewItemId = React.useRef<null | number>(null);
	const prevCategoryRef = React.useRef<null | ThingCategory>(null);
	const prevDataRef = React.useRef<null | typeof data>(null);
	const { settings: generalSettings } = useGeneralSettings();
	const itemsPerPage = generalSettings.listAmountObjects;

	const getCategoryMap = React.useMemo(() => {
		return (category: ThingCategory) => {
			if (!data) return undefined;
			return getCategoryMapUtil(data, category);
		};
	}, [data]);

	const getThing = React.useCallback(
		(id: number, category: ThingCategory) => {
			const map = getCategoryMap(category);
			return map?.get(id) || null;
		},
		[getCategoryMap]
	);

	const allItemIds = React.useMemo(() => {
		if (!data) return [];
		const map = getCategoryMapUtil(data, selectedCategory);
		const count = getCategoryCount(data, selectedCategory);
		const minId = getCategoryStartId(formatConfig, selectedCategory);
		const ids: number[] = [];
		const maxId = minId + count - 1;
		for (let id = minId; id <= maxId; id++) {
			if (map.has(id)) {
				ids.push(id);
			}
		}
		return ids;
	}, [data, selectedCategory, updateCounter, formatConfig]);

	const totalPages = Math.max(1, Math.ceil(allItemIds.length / itemsPerPage));
	const paginatedItemIds = React.useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		return allItemIds.slice(start, end);
	}, [currentPage, allItemIds, itemsPerPage]);

	React.useEffect(() => {
		if (currentPage > totalPages) setCurrentPage(totalPages);
	}, [currentPage, totalPages]);

	React.useEffect(() => {
		if (data) {
			const categoryChanged = prevCategoryRef.current !== selectedCategory;
			const dataChanged = prevDataRef.current !== data;
			if (categoryChanged || dataChanged) {
				prevCategoryRef.current = selectedCategory;
				prevDataRef.current = data;
				setCurrentPage(1);
				const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
				if (viewport) viewport.scrollTo({ top: 0, behavior: 'instant' });
				const firstItemId = allItemIds[0];
				if (firstItemId !== undefined) {
					setHighlightedItemId(firstItemId);
					setSelectedItemIds(new Set([firstItemId]));
				} else {
					setHighlightedItemId(null);
					setSelectedItemIds(new Set());
				}
			}
		}
	}, [data, selectedCategory, setHighlightedItemId, allItemIds]);

	React.useEffect(() => {
		setInputValue(highlightedItemId ? String(highlightedItemId) : '');
	}, [highlightedItemId]);

	const [pendingSelection, setPendingSelection] = React.useState<null | { id: number; category: ThingCategory }>(null);

	React.useEffect(() => {
		let unlisten: undefined | (() => void);

		const setupListener = async () => {
			const { listen } = await import('@tauri-apps/api/event');
			unlisten = await listen('select_thing', (event: any) => {
				const { id, category } = event.payload;
				setPendingSelection({ id, category });
				setSelectedCategory(category);
			});
		};

		setupListener();

		return () => {
			if (unlisten) unlisten();
		};
	}, [setSelectedCategory]);

	React.useEffect(() => {
		if (pendingSelection && pendingSelection.category === selectedCategory) {
			const { id } = pendingSelection;
			const itemIndex = allItemIds.indexOf(id);

			if (itemIndex !== -1) {
				const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;
				setCurrentPage(targetPage);
				shouldScrollToHighlightedRef.current = true;
				setHighlightedItemId(id);
				setSelectedItemIds(new Set([id]));
				setPendingSelection(null);
			}
		}
	}, [pendingSelection, selectedCategory, allItemIds, itemsPerPage, setHighlightedItemId]);

	React.useEffect(() => {
		if (!data || !data.sprPath) return;

		let cancelled = false;

		const loadSpritesProgressively = async () => {
			logger.log(EventCode.ITEM_PAGE, { pg: currentPage, cat: selectedCategory, n: paginatedItemIds.length });

			const { loadSpriteIds, loadSpriteIdsLz4 } = await import('@/lib/formats/tibia');
			if (cancelled) return;

			const thumbIds: number[] = [];
			const seenThumb = new Set<number>();
			for (const id of paginatedItemIds) {
				const item = getThing(id, selectedCategory);
				if (!item) continue;
				for (const spriteId of getThumbnailSpriteIds(item)) {
					if (!seenThumb.has(spriteId)) {
						seenThumb.add(spriteId);
						thumbIds.push(spriteId);
					}
				}
			}

			if (thumbIds.length > 0 && !cancelled) {
				if (thumbIds.length > 100) {
					await loadSpriteIdsLz4(data.sprPath, thumbIds, data.transparency, data.sprites);
				} else {
					await loadSpriteIds(data.sprPath, thumbIds, data.transparency, data.sprites);
				}
				if (!cancelled) notifySpritesLoaded();
			}

			if (cancelled || totalPages <= currentPage) return;

			const PREFETCH_PAGES = 3;
			const pagesToPrefetch = Math.min(PREFETCH_PAGES, totalPages - currentPage);
			const prefetchIds: number[] = [];
			const seenPrefetch = new Set<number>();

			for (let i = 1; i <= pagesToPrefetch; i++) {
				const pageNum = currentPage + i;
				const start = (pageNum - 1) * itemsPerPage;
				const end = start + itemsPerPage;
				for (const id of allItemIds.slice(start, end)) {
					const item = getThing(id, selectedCategory);
					if (!item) continue;
					for (const spriteId of getThumbnailSpriteIds(item)) {
						if (!seenPrefetch.has(spriteId) && !data.sprites.has(spriteId)) {
							seenPrefetch.add(spriteId);
							prefetchIds.push(spriteId);
						}
					}
				}
			}

			if (prefetchIds.length > 0 && !cancelled) {
				try {
					if (prefetchIds.length > 100) {
						await loadSpriteIdsLz4(data.sprPath, prefetchIds, data.transparency, data.sprites);
					} else {
						await loadSpriteIds(data.sprPath, prefetchIds, data.transparency, data.sprites);
					}
				} catch {
					/* noop */
				}
			}
		};

		loadSpritesProgressively();

		return () => {
			cancelled = true;
		};
	}, [
		currentPage,
		data,
		paginatedItemIds,
		selectedCategory,
		getThing,
		notifySpritesLoaded,
		allItemIds,
		totalPages,
		itemsPerPage,
		updateCounter
	]);

	const handlePageChange = (page: number) => {
		if (page >= 1 && page <= totalPages) {
			setCurrentPage(page);

			const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
			if (viewport) {
				viewport.scrollTop = 0;
			}

			const start = (page - 1) * itemsPerPage;
			const firstItemId = allItemIds[start];
			if (firstItemId !== undefined) {
				setHighlightedItemId(firstItemId);
				setSelectedItemIds(new Set([firstItemId]));
			}
		}
	};

	const handleFindSimilar = React.useCallback(
		async (seeds: Array<{ id: number; category: ThingCategory }>) => {
			if (seeds.length === 0) return;
			const refs = seeds.filter(({ id, category }) => {
				const thing = getThing(id, category);
				return !!thing && (thing.spriteIndex || []).some((sid) => isValidSpriteId(sid));
			});

			if (refs.length === 0) {
				toast({ description: 'No valid sprites to compare against' });
				return;
			}

			try {
				const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
				const { emit } = await import('@tauri-apps/api/event');
				localStorage.setItem('sprite-forge-pending-find-similar', JSON.stringify({ refs, ts: Date.now() }));
				const existing = await WebviewWindow.getByLabel('find');
				if (existing) {
					await existing.show();
					await existing.setFocus();
				} else {
					const win = new WebviewWindow('find', {
						width: 900,
						height: 600,
						center: true,
						minWidth: 700,
						shadow: false,
						minHeight: 500,
						resizable: true,
						url: 'find.html',
						transparent: true,
						decorations: false,
						title: 'Find - Sprite Forge',
						backgroundColor: [0, 0, 0, 0]
					});
					await new Promise<void>((resolve) => {
						win.once('tauri://created', () => resolve());
						win.once('tauri://error', () => resolve());
					});
					await new Promise((r) => setTimeout(r, 300));
				}
				await emit('find_similar', { refs });
			} catch (err) {
				console.error('Failed to open find window:', err);
				toast({ title: 'Error', variant: 'destructive', description: 'Failed to open Find window' });
			}
		},
		[getThing, toast]
	);

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			const itemId = parseInt(inputValue);
			if (!isNaN(itemId) && data) {
				const item = getThing(itemId, selectedCategory);
				if (item) {
					const itemIndex = allItemIds.indexOf(itemId);
					if (itemIndex !== -1) {
						const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;
						setCurrentPage(targetPage);
						shouldScrollToHighlightedRef.current = true;
						setHighlightedItemId(itemId);
						setSelectedItemIds(new Set([itemId]));
					}
				}
			}
		}
	};

	React.useEffect(() => {
		if (pendingNewItemId.current !== null && currentPage > 0) {
			setTimeout(() => {
				if (pendingNewItemId.current !== null) {
					shouldScrollToHighlightedRef.current = true;
					setHighlightedItemId(pendingNewItemId.current);
					setOpenedItemId(pendingNewItemId.current);
					pendingNewItemId.current = null;
				}
			}, 50);
		}
	}, [currentPage, setHighlightedItemId, setOpenedItemId]);

	React.useEffect(() => {
		if (shouldScrollToHighlightedRef.current && highlightedItemId) {
			setTimeout(() => {
				const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
				if (viewport) {
					const highlightedButton = viewport.querySelector(`[data-item-id="${highlightedItemId}"]`) as HTMLElement;
					if (highlightedButton) {
						const viewportHeight = viewport.clientHeight;
						const itemTop = highlightedButton.offsetTop;
						const itemHeight = highlightedButton.offsetHeight;
						const scrollTop = itemTop - viewportHeight / 2 + itemHeight / 2;

						viewport.scrollTo({
							behavior: 'instant',
							top: Math.max(0, scrollTop)
						});
					}
				}
				shouldScrollToHighlightedRef.current = false;
			}, 0);
		}
	}, [highlightedItemId, currentPage]);

	const createNewItem = () => {
		if (!data) return;
		const map = getCategoryMapUtil(data, selectedCategory);
		const minId = getCategoryStartId(formatConfig, selectedCategory);

		let newId = minId;
		while (map.has(newId)) {
			newId++;
		}

		const newItem = createThingType(newId, selectedCategory, formatConfig);
		map.set(newId, newItem);

		const newCount = map.size;
		setCategoryCount(data, selectedCategory, newCount);

		const updatedMaxId = minId + newCount - 1;
		const updatedAllItemIds: number[] = [];
		if (map) {
			for (let id = minId; id <= updatedMaxId; id++) {
				if (map.has(id)) {
					updatedAllItemIds.push(id);
				}
			}
		}

		const itemIndex = updatedAllItemIds.indexOf(newId);
		const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;

		markAsNewItem(newId, selectedCategory);
		markUnsavedChanges(newId, selectedCategory, true);

		pendingNewItemId.current = newId;
		notifyDataChanged();
		setCurrentPage(targetPage);
	};

	const editItem = (id: number) => {
		setOpenedItemId(id);
		setHighlightedItemId(id);
		setSelectedItemIds(new Set([id]));
	};

	const selectItem = (id: number, e: React.MouseEvent) => {
		const newSelection = new Set(e.ctrlKey ? selectedItemIds : []);

		if (e.shiftKey && highlightedItemId) {
			const startIdx = allItemIds.indexOf(highlightedItemId);
			const endIdx = allItemIds.indexOf(id);
			if (startIdx !== -1 && endIdx !== -1) {
				const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
				for (let i = lo; i <= hi; i++) newSelection.add(allItemIds[i]);
			} else {
				newSelection.add(id);
			}
		} else if (e.ctrlKey) {
			if (newSelection.has(id)) newSelection.delete(id);
			else newSelection.add(id);
			setHighlightedItemId(id);
		} else {
			newSelection.add(id);
			setHighlightedItemId(id);
		}

		setSelectedItemIds(newSelection);
	};

	const handleContextMenuTarget = (id: number) => {
		if (!selectedItemIds.has(id)) {
			setSelectedItemIds(new Set([id]));
			setHighlightedItemId(id);
		}
	};

	const duplicateItem = (ids: number | number[], itemArg?: ThingType) => {
		if (!data) return;
		const map = getCategoryMapUtil(data, selectedCategory);
		const idList = Array.isArray(ids) ? ids : [ids];
		const minId = getCategoryStartId(formatConfig, selectedCategory);

		let lastNewId: null | number = null;
		const newIds: number[] = [];

		for (const sourceId of idList) {
			const source = itemArg && idList.length === 1 ? itemArg : map.get(sourceId);
			if (!source) continue;

			let newId = sourceId + 1;
			while (map.has(newId) || newIds.includes(newId)) {
				newId++;
			}

			const duplicate: ThingType = {
				...source,
				id: newId,
				spriteIndex: [...source.spriteIndex],
				frameDurations: source.frameDurations?.map((d) => ({ ...d })),
				frameGroupsData: source.frameGroupsData?.map((g) => ({
					...g,
					spriteIndex: [...g.spriteIndex],
					frameDurations: g.frameDurations?.map((d) => ({ ...d }))
				}))
			};

			map.set(newId, duplicate);
			markAsNewItem(newId, selectedCategory);
			markUnsavedChanges(newId, selectedCategory, true);
			newIds.push(newId);
			lastNewId = newId;
		}

		if (lastNewId === null) return;

		const updatedCount = Math.max(getCategoryCount(data, selectedCategory), lastNewId - minId + 1);
		setCategoryCount(data, selectedCategory, updatedCount);

		const updatedMaxId = minId + updatedCount - 1;
		const updatedAllItemIds: number[] = [];
		for (let scanId = minId; scanId <= updatedMaxId; scanId++) {
			if (map.has(scanId)) updatedAllItemIds.push(scanId);
		}

		const itemIndex = updatedAllItemIds.indexOf(lastNewId);
		const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;

		pendingNewItemId.current = lastNewId;
		notifyDataChanged();
		setCurrentPage(targetPage);
	};

	const copyProperties = (item: ThingType) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { id: _, category: ___, spriteIndex: __, frameGroupsData: ____, ...properties } = item;
		setCopiedProperties(properties);
		toast({ description: 'Properties copied' });
	};

	const pasteProperties = (ids: number | number[]) => {
		if (!copiedProperties) return;
		const idList = Array.isArray(ids) ? ids : [ids];
		for (const id of idList) {
			updateThing(id, selectedCategory, copiedProperties);
			markUnsavedChanges(id, selectedCategory, true);
		}
		notifyDataChanged(idList);
		toast({ description: idList.length > 1 ? `Properties pasted to ${idList.length} items` : 'Properties pasted' });
	};

	const exportSheet = (item: ThingType) => {
		if (data) openExport([item.id]);
	};

	const exportSheets = (ids: number | number[]) => {
		if (!data) return;
		const idList = Array.isArray(ids) ? ids : [ids];
		const things = idList.filter((id) => !!getThing(id, selectedCategory));
		if (things.length === 0) return;
		openExport(things);
	};

	const importInto = async (item: ThingType) => {
		if (!data) return;

		const selected = await open({
			multiple: true,
			filters: [{ name: 'Importable', extensions: ['sfp', 'obd', 'png', 'bmp', 'jpg', 'jpeg'] }]
		});
		if (!selected) return;
		const paths = Array.isArray(selected) ? selected : [selected];

		const sfp = paths.find((p) => /\.sfp$/i.test(p));
		if (sfp) {
			openImport({ source: 'sfp', files: [await readFileBytes(sfp)] });
			return;
		}

		const obds = paths.filter((p) => /\.obd$/i.test(p));
		if (obds.length > 0) {
			openImport({ source: 'obd', files: await Promise.all(obds.map(readFileBytes)) });
			return;
		}

		const image = paths.find((p) => /\.(png|bmp|jpe?g)$/i.test(p));
		if (!image) return;

		const result = await importObjectSheet(item, data, image, {
			isNew: isNewItem(item.id, selectedCategory)
		});
		if (result.success) {
			notifySpritesLoaded();
			notifyDataChanged([item.id]);
		} else if (result.error) {
			toast({ variant: 'destructive', description: `Import rejected: ${result.error}` });
		}
	};

	const removeItem = (ids: number | number[]) => {
		if (!data) return;
		const map = getCategoryMap(selectedCategory);
		if (!map) return;

		const idList = Array.isArray(ids) ? ids : [ids];
		const toRemove = idList.filter((id) => map.has(id));
		if (toRemove.length === 0) return;

		const firstRemoved = toRemove[0];
		const firstIndex = allItemIds.indexOf(firstRemoved);

		for (const id of toRemove) {
			map.delete(id);
			removeOpenedItem(id, selectedCategory);
			if (openedItemId === id) setOpenedItemId(null);
		}

		setHighlightedItemId(null);
		setSelectedItemIds(new Set());

		const removedSet = new Set(toRemove);
		const remainingIds = allItemIds.filter((itemId) => !removedSet.has(itemId));
		if (remainingIds.length === 0) {
			setCurrentPage(1);
		} else {
			const nextId = remainingIds[firstIndex] || remainingIds[firstIndex - 1] || remainingIds[0];
			if (nextId) {
				setHighlightedItemId(nextId);
				setSelectedItemIds(new Set([nextId]));
				const targetPage = Math.floor(remainingIds.indexOf(nextId) / itemsPerPage) + 1;
				setCurrentPage(targetPage);
			}
		}

		notifyDataChanged();
	};

	const canFindSimilar = (item: ThingType) => !!item.spriteIndex?.some((sid) => isValidSpriteId(sid));

	const [pendingFindActions, setPendingFindActions] = React.useState<
		Array<{ ids: number[]; action: string; category: ThingCategory }>
	>([]);

	React.useEffect(() => {
		let unlisten: undefined | (() => void);

		const setupListener = async () => {
			const { listen } = await import('@tauri-apps/api/event');
			unlisten = await listen('find_action', (event: any) => {
				const payload = event.payload as { id?: number; ids?: number[]; action: string; category: ThingCategory };
				const ids = Array.isArray(payload.ids) ? payload.ids : payload.id !== undefined ? [payload.id] : [];
				if (ids.length === 0) return;
				setPendingFindActions((prev) => [...prev, { ids, action: payload.action, category: payload.category }]);
			});
		};

		setupListener();

		return () => {
			if (unlisten) unlisten();
		};
	}, []);

	React.useEffect(() => {
		if (pendingFindActions.length === 0) return;
		const next = pendingFindActions[0];
		if (next.category !== selectedCategory) {
			setSelectedCategory(next.category);
			return;
		}

		const { ids, action } = next;
		const validItems = ids.map((id) => ({ id, item: getThing(id, selectedCategory) })).filter((x) => !!x.item);
		setPendingFindActions((prev) => prev.slice(1));
		if (validItems.length === 0) return;

		const isMulti = validItems.length > 1;
		const idList = validItems.map((x) => x.id);

		switch (action) {
			case 'duplicate':
				duplicateItem(isMulti ? idList : validItems[0].id, isMulti ? undefined : validItems[0].item!);
				break;
			case 'copy_properties':
				if (!isMulti) copyProperties(validItems[0].item!);
				break;
			case 'paste_properties':
				if (!copiedProperties) {
					toast({ description: 'No properties copied' });
				} else {
					pasteProperties(isMulti ? idList : validItems[0].id);
				}
				break;
			case 'export_sheet':
				exportSheets(idList);
				break;
			case 'import_sheet':
				if (!isMulti) importInto(validItems[0].item!);
				break;
		}
	}, [pendingFindActions, selectedCategory, copiedProperties, setSelectedCategory, getThing]);

	return {
		data,
		getThing,
		viewMode,
		editItem,
		selectItem,
		inputValue,
		removeItem,
		totalPages,
		spriteSize,
		importInto,
		currentPage,
		setViewMode,
		exportSheet,
		exportSheets,
		createNewItem,
		setInputValue,
		updateCounter,
		duplicateItem,
		canFindSimilar,
		copyProperties,
		selectedItemIds,
		pasteProperties,
		handlePageChange,
		copiedProperties,
		selectedCategory,
		paginatedItemIds,
		scrollViewportRef,
		hasUnsavedChanges,
		highlightedItemId,
		handleInputKeyDown,
		setSelectedCategory,
		setHighlightedItemId,
		handleContextMenuTarget,
		findSimilar: handleFindSimilar
	};
};
