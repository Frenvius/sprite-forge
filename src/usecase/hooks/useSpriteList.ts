import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { type Sprite } from '@/lib/formats/tibia';
import { useDragDrop } from '@/usecase/context/DragDropContext';
import { useListViewMode } from '@/usecase/hooks/useListViewMode';
import { useAssetData } from '@/usecase/context/AssetDataContext';
import { useGeneralSettings } from '@/usecase/context/GeneralSettingsContext';

import { useToast } from './use-toast';

export const useSpriteList = () => {
	const {
		data,
		spriteSize,
		updateCounter,
		openedSpriteId,
		setOpenedSpriteId,
		notifyDataChanged,
		notifySpritesLoaded,
		highlightedSpriteId,
		spriteImportVersion,
		setHighlightedSpriteId
	} = useAssetData();
	const { startDrag } = useDragDrop();
	const { toast } = useToast();
	const { viewMode, setViewMode } = useListViewMode('get_sprite_list_view_mode', 'set_sprite_list_view_mode');
	const [currentPage, setCurrentPage] = React.useState<number>(1);
	const [selectedSpriteIds, setSelectedSpriteIds] = React.useState<Set<number>>(new Set());
	const [inputValue, setInputValue] = React.useState<string>('');

	const scrollViewportRef = React.useRef<HTMLDivElement>(null);
	const shouldScrollToHighlightedRef = React.useRef(false);
	const isInternalHighlightChange = React.useRef(false);
	const pendingNewSpriteId = React.useRef<null | number>(null);
	const { settings: generalSettings } = useGeneralSettings();
	const itemsPerPage = generalSettings.listAmountSprites;

	const allSpriteIds = React.useMemo(() => {
		if (!data) return [];
		const ids: number[] = [];
		for (let id = 1; id <= data.spritesCount; id++) {
			ids.push(id);
		}
		return ids;
	}, [data, updateCounter]);

	const totalPages = Math.max(1, Math.ceil(allSpriteIds.length / itemsPerPage));
	const paginatedSpriteIds = React.useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		return allSpriteIds.slice(start, end);
	}, [currentPage, allSpriteIds, itemsPerPage]);

	React.useEffect(() => {
		if (currentPage > totalPages) setCurrentPage(totalPages);
	}, [currentPage, totalPages]);

	React.useEffect(() => {
		if (data) {
			setCurrentPage(1);
			const firstSpriteId = allSpriteIds[0];
			if (firstSpriteId !== undefined) {
				setHighlightedSpriteId(firstSpriteId);
				setSelectedSpriteIds(new Set([firstSpriteId]));
			} else {
				setHighlightedSpriteId(null);
				setSelectedSpriteIds(new Set());
			}
			setOpenedSpriteId(null);
		}
	}, [data, setOpenedSpriteId]);

	React.useEffect(() => {
		setInputValue(highlightedSpriteId ? String(highlightedSpriteId) : '');
	}, [highlightedSpriteId]);

	React.useEffect(() => {
		if (spriteImportVersion > 0 && totalPages > 0) {
			setCurrentPage(totalPages);
			if (allSpriteIds.length > 0) {
				const lastSpriteId = allSpriteIds[allSpriteIds.length - 1];
				setHighlightedSpriteId(lastSpriteId);
				setSelectedSpriteIds(new Set([lastSpriteId]));
			}
		}
	}, [spriteImportVersion, totalPages, allSpriteIds, setHighlightedSpriteId]);

	React.useEffect(() => {
		if (!data || !data.sprPath) return;

		let cancelled = false;

		const loadSpritesForCurrentPage = async () => {
			const { loadSpriteIds, loadSpriteIdsLz4 } = await import('@/lib/formats/tibia');

			if (cancelled) return;

			const PREFETCH_PAGES = 2;
			const pagesToLoad = Math.min(PREFETCH_PAGES + 1, totalPages - currentPage + 1);

			const spritesToLoad: number[] = [];

			for (let i = 0; i < pagesToLoad; i++) {
				const pageNum = currentPage + i;
				if (pageNum > totalPages) break;

				const start = (pageNum - 1) * itemsPerPage;
				const end = start + itemsPerPage;
				spritesToLoad.push(...allSpriteIds.slice(start, end));
			}

			const uncached = spritesToLoad.filter((id) => !data.sprites.has(id));
			if (uncached.length === 0) return;

			if (uncached.length > 100) {
				await loadSpriteIdsLz4(data.sprPath, spritesToLoad, data.transparency, data.sprites);
			} else {
				await loadSpriteIds(data.sprPath, spritesToLoad, data.transparency, data.sprites);
			}

			if (cancelled) return;
			notifySpritesLoaded();
		};

		loadSpritesForCurrentPage();

		return () => {
			cancelled = true;
		};
	}, [currentPage, data, allSpriteIds, totalPages, itemsPerPage]);

	const handlePageChange = (page: number) => {
		if (page >= 1 && page <= totalPages) {
			setCurrentPage(page);

			const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
			if (viewport) {
				viewport.scrollTop = 0;
			}

			const start = (page - 1) * itemsPerPage;
			const firstSpriteId = allSpriteIds[start];
			if (firstSpriteId !== undefined) {
				setHighlightedSpriteId(firstSpriteId);
				setSelectedSpriteIds(new Set([firstSpriteId]));
			}
		}
	};

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			const spriteId = parseInt(inputValue);
			if (!isNaN(spriteId) && data && spriteId >= 1 && spriteId <= data.spritesCount) {
				const spriteIndex = allSpriteIds.indexOf(spriteId);
				if (spriteIndex !== -1) {
					const targetPage = Math.floor(spriteIndex / itemsPerPage) + 1;
					setCurrentPage(targetPage);
					shouldScrollToHighlightedRef.current = true;
					setHighlightedSpriteId(spriteId);
				}
			}
		}
	};

	React.useEffect(() => {
		if (pendingNewSpriteId.current !== null && currentPage > 0) {
			setTimeout(() => {
				if (pendingNewSpriteId.current !== null) {
					shouldScrollToHighlightedRef.current = true;
					setHighlightedSpriteId(pendingNewSpriteId.current);
					setOpenedSpriteId(pendingNewSpriteId.current);
					pendingNewSpriteId.current = null;
				}
			}, 50);
		}
	}, [currentPage, setHighlightedSpriteId, setOpenedSpriteId, updateCounter]);

	React.useEffect(() => {
		if (highlightedSpriteId && data) {
			const spriteIndex = allSpriteIds.indexOf(highlightedSpriteId);
			if (spriteIndex !== -1) {
				const targetPage = Math.floor(spriteIndex / itemsPerPage) + 1;

				if (targetPage !== currentPage) {
					setCurrentPage(targetPage);
					shouldScrollToHighlightedRef.current = true;
				} else {
					if (!isInternalHighlightChange.current) {
						shouldScrollToHighlightedRef.current = true;
					}
				}
			}
		}
		isInternalHighlightChange.current = false;
	}, [highlightedSpriteId, data, allSpriteIds, currentPage, itemsPerPage, selectedSpriteIds]);

	React.useEffect(() => {
		if (shouldScrollToHighlightedRef.current && highlightedSpriteId) {
			setTimeout(() => {
				const viewport = scrollViewportRef.current;
				if (viewport) {
					const highlightedButton = viewport.querySelector(`[data-sprite-id="${highlightedSpriteId}"]`) as HTMLElement;
					if (highlightedButton) {
						const viewportHeight = viewport.clientHeight;
						const itemTop = highlightedButton.offsetTop;
						const itemHeight = highlightedButton.offsetHeight;
						const scrollTop = itemTop - viewportHeight / 2 + itemHeight / 2;

						viewport.scrollTo({
							behavior: 'smooth',
							top: Math.max(0, scrollTop)
						});
					}
				}
				shouldScrollToHighlightedRef.current = false;
			}, 50);
		}
	}, [highlightedSpriteId, currentPage]);

	const handleDeleteSprite = (ids: number | number[]) => {
		if (!data || !data.sprites) return;

		const idList = Array.isArray(ids) ? [...ids].sort((a, b) => b - a) : [ids];
		const modified: number[] = [];

		for (const id of idList) {
			const sprite = data.sprites.get(id);
			if (!sprite) continue;

			if (id === data.spritesCount) {
				data.sprites.delete(id);
				data.spritesCount--;
			} else {
				sprite.isEmpty = true;
				sprite.rgbaPixels = new Uint8Array(4096);
				sprite.pixels = undefined;
				sprite.compressedPixels = new Uint8Array(0);
				sprite.imageData = undefined;
			}

			if (openedSpriteId === id) setOpenedSpriteId(null);
			modified.push(id);
		}

		if (modified.length === 0) return;

		const deletedSet = new Set(modified);
		if (highlightedSpriteId && deletedSet.has(highlightedSpriteId)) {
			setHighlightedSpriteId(null);
		}
		setSelectedSpriteIds((prev) => {
			const next = new Set(prev);
			for (const id of modified) next.delete(id);
			return next;
		});

		notifySpritesLoaded();
		notifyDataChanged(modified);
	};

	const handleContextMenuTarget = (id: number) => {
		if (!selectedSpriteIds.has(id)) {
			setSelectedSpriteIds(new Set([id]));
			setHighlightedSpriteId(id);
			isInternalHighlightChange.current = true;
		}
	};

	const pasteClipboardImage = async (targetSpriteId?: number) => {
		if (!data) return;

		try {
			const clipboardItems = await navigator.clipboard.read();

			for (const clipboardItem of clipboardItems) {
				for (const type of clipboardItem.types) {
					if (type.startsWith('image/')) {
						const blob = await clipboardItem.getType(type);

						const img = document.createElement('img');
						const url = URL.createObjectURL(blob);

						img.onload = async () => {
							URL.revokeObjectURL(url);

							if (img.width % spriteSize !== 0 || img.height % spriteSize !== 0) {
								alert(`Image dimensions must be multiples of ${spriteSize} pixels.\nCurrent size: ${img.width}x${img.height}`);
								return;
							}

							if (targetSpriteId !== undefined && (img.width !== spriteSize || img.height !== spriteSize)) {
								alert(
									`When pasting into an existing sprite, image must be exactly ${spriteSize}x${spriteSize} pixels.\nCurrent size: ${img.width}x${img.height}`
								);
								return;
							}

							const canvas = document.createElement('canvas');
							canvas.width = img.width;
							canvas.height = img.height;
							const ctx = canvas.getContext('2d');
							if (!ctx) return;

							ctx.drawImage(img, 0, 0);
							const imageData = ctx.getImageData(0, 0, img.width, img.height);

							const tilesX = img.width / spriteSize;
							const tilesY = img.height / spriteSize;

							let lastCreatedId = targetSpriteId;
							const modifiedSpriteIds: number[] = [];

							for (let ty = 0; ty < tilesY; ty++) {
								for (let tx = 0; tx < tilesX; tx++) {
									const pixels = new Uint8Array(spriteSize * spriteSize * 4);
									for (let y = 0; y < spriteSize; y++) {
										for (let x = 0; x < spriteSize; x++) {
											const srcIdx = ((ty * spriteSize + y) * img.width + (tx * spriteSize + x)) * 4;
											const dstIdx = (y * spriteSize + x) * 4;
											pixels[dstIdx] = imageData.data[srcIdx];
											pixels[dstIdx + 1] = imageData.data[srcIdx + 1];
											pixels[dstIdx + 2] = imageData.data[srcIdx + 2];
											pixels[dstIdx + 3] = imageData.data[srcIdx + 3];
										}
									}

									const compressBuf = new Uint8Array(4097);
									compressBuf[0] = data.transparency ? 1 : 0;
									compressBuf.set(pixels, 1);
									const compressResp = await invoke<ArrayBuffer>('compress_sprite_rgba', compressBuf);
									const compressedPixels = compressResp instanceof Uint8Array ? compressResp : new Uint8Array(compressResp);

									let spriteId: number;

									if (targetSpriteId !== undefined && ty === 0 && tx === 0) {
										spriteId = targetSpriteId;
										const sprite = data.sprites.get(spriteId);
										if (sprite) {
											sprite.rgbaPixels = pixels;
											sprite.compressedPixels = new Uint8Array(compressedPixels);
											sprite.isEmpty = pixels.every((p) => p === 0);
											sprite.imageData = undefined;
											modifiedSpriteIds.push(spriteId);
										}
									} else if (targetSpriteId === undefined) {
										let newId = data.spritesCount + 1;
										while (data.sprites.has(newId)) {
											newId++;
										}
										spriteId = newId;

										const newSprite: Sprite = {
											id: newId,
											rgbaPixels: pixels,
											imageData: undefined,
											transparent: data.transparency,
											isEmpty: pixels.every((p) => p === 0),
											compressedPixels: new Uint8Array(compressedPixels)
										};

										data.sprites.set(newId, newSprite);
										data.spritesCount = newId;
										lastCreatedId = newId;
										modifiedSpriteIds.push(newId);
									}
								}
							}

							if (lastCreatedId !== undefined) {
								const lastPage = Math.ceil(lastCreatedId / itemsPerPage);
								pendingNewSpriteId.current = lastCreatedId;
								setCurrentPage(lastPage);
							}

							notifySpritesLoaded();
							notifyDataChanged(modifiedSpriteIds);
						};

						img.onerror = () => {
							URL.revokeObjectURL(url);
							alert('Failed to load image from clipboard');
						};

						img.src = url;
						return;
					}
				}
			}
		} catch (err) {
			console.error('Failed to read clipboard:', err);
			alert('Failed to access clipboard. Please make sure you have granted clipboard permissions.');
		}
	};

	const ensureSpriteLoaded = React.useCallback(
		async (id: number): Promise<null | Sprite> => {
			if (!data || !data.sprPath) return null;
			const cached = data.sprites.get(id);
			if (cached) return cached;
			const { loadSpriteIds } = await import('@/lib/formats/tibia');
			await loadSpriteIds(data.sprPath, [id], data.transparency, data.sprites);
			notifySpritesLoaded();
			return data.sprites.get(id) ?? null;
		},
		[data, notifySpritesLoaded]
	);

	const rgbaToPngBlob = React.useCallback((rgba: Uint8Array, width = 32, height = 32): Promise<null | Blob> => {
		return new Promise((resolve) => {
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) return resolve(null);
			const imageData = ctx.createImageData(width, height);
			imageData.data.set(rgba);
			ctx.putImageData(imageData, 0, 0);
			canvas.toBlob((blob) => resolve(blob), 'image/png');
		});
	}, []);

	const handleCopySpriteImage = React.useCallback(
		async (id: number) => {
			const sprite = await ensureSpriteLoaded(id);
			if (!sprite) return;
			const blob = await rgbaToPngBlob(sprite.rgbaPixels);
			if (!blob) return;
			try {
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
				toast({ title: 'Copied', description: `Sprite ${id} copied to clipboard` });
			} catch (err) {
				console.error('Clipboard write failed:', err);
				toast({ title: 'Copy failed', variant: 'destructive', description: 'Could not write image to clipboard' });
			}
		},
		[ensureSpriteLoaded, rgbaToPngBlob, toast]
	);

	const handleFindUsages = React.useCallback(
		async (id: number) => {
			try {
				const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
				const { emit } = await import('@tauri-apps/api/event');
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
				await emit('find_by_sprite', { spriteId: id });
			} catch (err) {
				console.error('Failed to open find window:', err);
				toast({ title: 'Error', variant: 'destructive', description: 'Failed to open Find window' });
			}
		},
		[toast]
	);

	const handleExportSpritePng = React.useCallback(
		async (id: number) => {
			const sprite = await ensureSpriteLoaded(id);
			if (!sprite) return;
			try {
				const { save } = await import('@tauri-apps/plugin-dialog');
				const filePath = await save({
					defaultPath: `sprite_${id}.png`,
					filters: [{ name: 'PNG Image', extensions: ['png'] }]
				});
				if (!filePath) return;
				await invoke('write_sprite_png', { path: filePath, rgba: Array.from(sprite.rgbaPixels) });
				toast({ title: 'Exported', description: `Sprite ${id} saved` });
			} catch (err) {
				console.error('Export failed:', err);
				toast({ title: 'Export failed', variant: 'destructive', description: String(err) });
			}
		},
		[ensureSpriteLoaded, toast]
	);

	const handleExportSpritesPng = React.useCallback(
		async (ids: number[]) => {
			if (ids.length === 0) return;
			try {
				const { open } = await import('@tauri-apps/plugin-dialog');
				const dirPath = await open({ directory: true, multiple: false });
				if (!dirPath || typeof dirPath !== 'string') return;

				let exported = 0;
				for (const id of ids) {
					const sprite = await ensureSpriteLoaded(id);
					if (!sprite) continue;
					const filePath = `${dirPath}/sprite_${id}.png`;
					await invoke('write_sprite_png', { path: filePath, rgba: Array.from(sprite.rgbaPixels) });
					exported++;
				}
				toast({ title: 'Exported', description: `${exported} sprite${exported === 1 ? '' : 's'} saved` });
			} catch (err) {
				console.error('Export failed:', err);
				toast({ title: 'Export failed', variant: 'destructive', description: String(err) });
			}
		},
		[ensureSpriteLoaded, toast]
	);

	const handleReplaceFromPng = React.useCallback(
		async (id: number) => {
			if (!data) return;
			try {
				const { open } = await import('@tauri-apps/plugin-dialog');
				const filePath = await open({
					multiple: false,
					filters: [{ name: 'Image', extensions: ['png', 'bmp', 'jpg', 'jpeg'] }]
				});
				if (!filePath || typeof filePath !== 'string') return;

				const rgbaArr = await invoke<number[] | Uint8Array>('read_sprite_png', { path: filePath });
				const pixels = rgbaArr instanceof Uint8Array ? rgbaArr : new Uint8Array(rgbaArr);

				const compressBuf = new Uint8Array(4097);
				compressBuf[0] = data.transparency ? 1 : 0;
				compressBuf.set(pixels, 1);
				const compressResp = await invoke<ArrayBuffer>('compress_sprite_rgba', compressBuf);
				const compressedPixels = compressResp instanceof Uint8Array ? compressResp : new Uint8Array(compressResp);

				const sprite = data.sprites.get(id);
				if (sprite) {
					sprite.rgbaPixels = pixels;
					sprite.compressedPixels = compressedPixels;
					sprite.isEmpty = pixels.every((p) => p === 0);
					sprite.imageData = undefined;
					sprite.pixels = undefined;
				} else {
					data.sprites.set(id, {
						id,
						compressedPixels,
						rgbaPixels: pixels,
						imageData: undefined,
						transparent: data.transparency,
						isEmpty: pixels.every((p) => p === 0)
					});
				}

				notifySpritesLoaded();
				notifyDataChanged([id]);
				toast({ title: 'Replaced', description: `Sprite ${id} replaced from PNG` });
			} catch (err) {
				console.error('Replace failed:', err);
				toast({ variant: 'destructive', title: 'Replace failed', description: String(err) });
			}
		},
		[data, notifySpritesLoaded, notifyDataChanged, toast]
	);

	React.useEffect(() => {
		const handlePaste = async (e: ClipboardEvent) => {
			if (!data) return;
			if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;

			e.preventDefault();
			await pasteClipboardImage();
		};

		document.addEventListener('paste', handlePaste);
		return () => {
			document.removeEventListener('paste', handlePaste);
		};
	}, [data, pasteClipboardImage]);

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Delete') return;
			if (!data) return;
			if (document.activeElement?.tagName === 'INPUT') return;

			const targets =
				selectedSpriteIds.size > 0 ? Array.from(selectedSpriteIds) : highlightedSpriteId ? [highlightedSpriteId] : [];
			if (targets.length === 0) return;

			e.preventDefault();
			handleDeleteSprite(targets);
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [data, highlightedSpriteId, selectedSpriteIds]);

	const createNewSprite = () => {
		if (!data) return;
		let newId = data.spritesCount + 1;
		while (data.sprites.has(newId)) {
			newId++;
		}

		const newSprite: Sprite = {
			id: newId,
			isEmpty: true,
			pixels: undefined,
			imageData: undefined,
			transparent: data.transparency,
			rgbaPixels: new Uint8Array(4096),
			compressedPixels: new Uint8Array(0)
		};

		data.sprites.set(newId, newSprite);
		data.spritesCount = newId;

		const lastPage = Math.ceil(newId / itemsPerPage);

		pendingNewSpriteId.current = newId;
		setCurrentPage(lastPage);

		notifySpritesLoaded();
		notifyDataChanged([newId]);
	};

	const openSprite = (id: number) => {
		setOpenedSpriteId(id);
		setHighlightedSpriteId(id);
		isInternalHighlightChange.current = true;
	};

	const selectSprite = (id: number, e: React.MouseEvent) => {
		const newSelection = new Set(e.ctrlKey ? selectedSpriteIds : []);

		if (e.shiftKey && highlightedSpriteId) {
			const start = Math.min(highlightedSpriteId, id);
			const end = Math.max(highlightedSpriteId, id);
			for (let i = start; i <= end; i++) {
				newSelection.add(i);
			}
		} else if (e.ctrlKey) {
			if (newSelection.has(id)) {
				newSelection.delete(id);
			} else {
				newSelection.add(id);
			}
			setHighlightedSpriteId(id);
		} else {
			newSelection.add(id);
			setHighlightedSpriteId(id);
		}

		isInternalHighlightChange.current = true;
		setSelectedSpriteIds(newSelection);
	};

	const startSpriteDragTimer = (id: number, makePreview: (ids: number[]) => React.ReactNode) => {
		return setTimeout(() => {
			let idsToDrag: number[] = [];
			if (selectedSpriteIds.has(id)) {
				idsToDrag = Array.from(selectedSpriteIds).sort((a, b) => a - b);
			} else {
				idsToDrag = [id];
				setSelectedSpriteIds(new Set([id]));
				setHighlightedSpriteId(id);
			}

			startDrag(idsToDrag, 'sprites', makePreview(idsToDrag));
		}, 150);
	};

	return {
		data,
		viewMode,
		openSprite,
		inputValue,
		totalPages,
		currentPage,
		setViewMode,
		selectSprite,
		setInputValue,
		createNewSprite,
		handlePageChange,
		handleFindUsages,
		scrollViewportRef,
		selectedSpriteIds,
		handleDeleteSprite,
		handleInputKeyDown,
		paginatedSpriteIds,
		pasteClipboardImage,
		highlightedSpriteId,
		handleReplaceFromPng,
		startSpriteDragTimer,
		handleCopySpriteImage,
		handleExportSpritePng,
		handleExportSpritesPng,
		handleContextMenuTarget
	};
};
