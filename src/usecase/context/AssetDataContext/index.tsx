import type { Sprite, AssetData, ThingType, ServerItem, FormatConfig, ServerItemData } from '@/lib/formats/tibia';

import React from 'react';
import { logger, EventCode } from '@/lib/debug';
import {
	SpriteReader,
	ThingCategory,
	getCategoryMap,
	saveCachedProfile,
	syncFromThingType,
	TIBIA_FORMAT_CONFIG,
	createServerItemFromThing
} from '@/lib/formats/tibia';

interface AssetDataContextType {
	spriteSize: number;
	isLoading: boolean;
	error: null | string;
	clearData: () => void;
	updateCounter: number;
	data: null | AssetData;
	autoSyncServer: boolean;
	openedItems: ThingType[];
	spriteLoadVersion: number;
	formatConfig: FormatConfig;
	openedItemId: null | number;
	spriteImportVersion: number;
	openedSpriteId: null | number;
	notifySpriteImport: () => void;
	selectedCategory: ThingCategory;
	notifySpritesLoaded: () => void;
	hasModifiedItems: () => boolean;
	highlightedItemId: null | number;
	spriteReader: null | SpriteReader;
	clearModifiedTracking: () => void;
	highlightedSpriteId: null | number;
	modifiedSprites: Map<number, Sprite>;
	setError: (error: null | string) => void;
	getSprite: (id: number) => null | Sprite;
	openedItemCategory: null | ThingCategory;
	setAutoSyncServer: (value: boolean) => void;
	setServerProfile: (profileId: string) => void;
	setOpenedSpriteId: (id: null | number) => void;
	reloadServerAttributes: () => { synced: number };
	notifyDataChanged: (spriteIds?: number[]) => void;
	setHighlightedItemId: (id: null | number) => void;
	setHighlightedSpriteId: (id: null | number) => void;
	createMissingServerItems: () => { created: number };
	getServerItem: (serverId: number) => null | ServerItem;
	setSelectedCategory: (category: ThingCategory) => void;
	attachServerItems: (serverItems: ServerItemData) => void;
	getServerItemsForClient: (clientId: number) => ServerItem[];
	isNewItem: (id: number, category: ThingCategory) => boolean;
	clearNewItem: (id: number, category: ThingCategory) => void;
	markAsNewItem: (id: number, category: ThingCategory) => void;
	removeOpenedItem: (id: number, category: ThingCategory) => void;
	getThing: (id: number, category: ThingCategory) => null | ThingType;
	hasUnsavedChanges: (id: number, category: ThingCategory) => boolean;
	setOpenedItemId: (id: null | number, category?: ThingCategory) => void;
	compileFiles: () => Promise<null | { synced: number; created: number }>;
	loadingProgress: null | { stage: string; total: number; current: number };
	updateServerItem: (serverId: number, updates: Partial<ServerItem>) => void;
	setSelectedCategoryAndItem: (category: ThingCategory, itemId: number) => void;
	setData: (data: AssetData, reader: SpriteReader, skipBackendSync?: boolean) => void;
	markUnsavedChanges: (id: number, category: ThingCategory, hasChanges: boolean) => void;
	updateThing: (id: number, category: ThingCategory, updates: Partial<ThingType>) => void;
	modifiedSinceCompile: Map<string, { id: number; data: ThingType; category: ThingCategory }>;
	setLoading: (loading: boolean, progress?: { stage: string; total: number; current: number }) => void;
	restoreCommit: (
		hash: string
	) => Promise<{ itemsSkipped: number; itemsRestored: number; spritesSkipped: number; spritesRestored: number }>;
}

const AssetDataContext = React.createContext<undefined | AssetDataContextType>(undefined);

export const AssetDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [data, setDataState] = React.useState<null | AssetData>(null);
	const [spriteReader, setSpriteReader] = React.useState<null | SpriteReader>(null);
	const [isLoading, setIsLoading] = React.useState(false);
	const [loadingProgress, setLoadingProgress] = React.useState<null | { stage: string; total: number; current: number }>(null);
	const [error, setError] = React.useState<null | string>(null);
	const [updateCounter, setUpdateCounter] = React.useState(0);
	const [spriteImportVersion, setSpriteImportVersion] = React.useState(0);
	const loadOpenedItemsState = (): {
		openedId: null | number;
		openedCategory: null | ThingCategory;
		items: Array<{ id: number; category: ThingCategory }>;
	} => {
		try {
			if (typeof window !== 'undefined') {
				const saved = localStorage.getItem('sprite-forge-opened-items');
				if (saved) {
					return JSON.parse(saved);
				}
			}
		} catch (e) {
			console.error('Failed to load opened items from localStorage:', e);
		}
		return { items: [], openedId: null, openedCategory: null };
	};

	const initialState = loadOpenedItemsState();
	const [openedItemId, setOpenedItemIdState] = React.useState<null | number>(initialState.openedId);
	const [openedItemCategory, setOpenedItemCategoryState] = React.useState<null | ThingCategory>(initialState.openedCategory);
	const [openedItems, setOpenedItems] = React.useState<ThingType[]>([]);
	const [highlightedItemId, setHighlightedItemId] = React.useState<null | number>(null);
	const [selectedCategory, setSelectedCategoryState] = React.useState<ThingCategory>(ThingCategory.ITEM);
	const settingItemRef = React.useRef(false);
	const hasRestoredRef = React.useRef(false);
	const hasPreloadedRef = React.useRef(false);
	const [openedSpriteId, setOpenedSpriteId] = React.useState<null | number>(null);
	const [highlightedSpriteId, setHighlightedSpriteId] = React.useState<null | number>(null);
	const [spriteSize, _setSpriteSize] = React.useState(32);
	const [spriteLoadVersion, setSpriteLoadVersion] = React.useState(0);
	const [unsavedChanges, setUnsavedChanges] = React.useState<Set<string>>(new Set());
	const [newItemKeys, setNewItemKeys] = React.useState<Set<string>>(new Set());
	const [modifiedSinceCompile, setModifiedSinceCompile] = React.useState<
		Map<string, { id: number; data: ThingType; category: ThingCategory }>
	>(new Map());
	const [originalItemsSinceCompile, setOriginalItemsSinceCompile] = React.useState<
		Map<string, { id: number; data: ThingType; category: ThingCategory }>
	>(new Map());
	const [modifiedSprites, setModifiedSprites] = React.useState<Map<number, Sprite>>(new Map());
	const [modifiedServerIds, setModifiedServerIds] = React.useState<Set<number>>(new Set());
	const [autoSyncServer, setAutoSyncServerState] = React.useState<boolean>(() => {
		try {
			return typeof window === 'undefined' ? true : localStorage.getItem('sprite-forge-otb-autosync') !== 'false';
		} catch {
			return true;
		}
	});

	const setAutoSyncServer = React.useCallback((value: boolean) => {
		setAutoSyncServerState(value);
		try {
			if (typeof window !== 'undefined') localStorage.setItem('sprite-forge-otb-autosync', String(value));
		} catch {
			void 0;
		}
	}, []);

	const saveOpenedItemsState = React.useCallback(
		(items: ThingType[], openedId: null | number, openedCategory: null | ThingCategory) => {
			try {
				if (typeof window !== 'undefined') {
					const itemsToSave = items.map((item) => ({ id: item.id, category: item.category }));
					localStorage.setItem(
						'sprite-forge-opened-items',
						JSON.stringify({
							openedId,
							openedCategory,
							items: itemsToSave
						})
					);
				}
			} catch (e) {
				console.error('Failed to save opened items to localStorage:', e);
			}
		},
		[]
	);

	const removeOpenedItem = React.useCallback(
		(id: number, category: ThingCategory) => {
			setOpenedItems((prev) => {
				const newItems = prev.filter((item) => !(item.id === id && item.category === category));
				return newItems;
			});
			if (openedItemId === id && openedItemCategory === category) {
				setOpenedItemIdState(null);
				setOpenedItemCategoryState(null);
			}

			const key = `${category}-${id}`;
			setUnsavedChanges((prev) => {
				const next = new Set(prev);
				next.delete(key);
				return next;
			});
		},
		[openedItemId, openedItemCategory]
	);

	const setData = React.useCallback(
		async (newData: AssetData, reader: SpriteReader, skipBackendSync = false) => {
			if (data?.sprPath && data.sprPath !== newData.sprPath) {
				try {
					const { invoke } = await import('@tauri-apps/api/core');
					await invoke('close_spr_file', { path: data.sprPath });
					console.log('Closed previous SPR file:', data.sprPath);
				} catch (e) {
					console.warn('Failed to close previous SPR file:', e);
				}
			}
			if (data?.datPath && data.datPath !== newData.datPath) {
				try {
					const { invoke } = await import('@tauri-apps/api/core');
					await invoke('clear_dat_data', { path: data.datPath });
					console.log('Cleared previous DAT data:', data.datPath);
				} catch (e) {
					console.warn('Failed to clear previous DAT data:', e);
				}
			}

			try {
				if (typeof window !== 'undefined') {
					localStorage.removeItem('sprite-forge-opened-items');
					const keysToRemove: string[] = [];
					for (let i = 0; i < localStorage.length; i++) {
						const key = localStorage.key(i);
						if (key && key.startsWith('sprite-forge-item-state-')) {
							keysToRemove.push(key);
						}
					}
					keysToRemove.forEach((key) => localStorage.removeItem(key));
				}
			} catch (e) {
				console.error('Failed to clear localStorage:', e);
			}

			setOpenedItemIdState(null);
			setOpenedItemCategoryState(null);
			setOpenedItems([]);
			setHighlightedItemId(null);
			setUnsavedChanges(new Set());
			setNewItemKeys(new Set());
			setSelectedCategoryState(ThingCategory.ITEM);

			hasRestoredRef.current = false;
			hasPreloadedRef.current = false;

			setDataState(newData);
			setSpriteReader(reader);
			setError(null);

			if (newData.datPath && !skipBackendSync) {
				try {
					if (typeof window !== 'undefined') {
						localStorage.setItem('sprite-forge-dat-path', newData.datPath);
						if (newData.sprPath) {
							localStorage.setItem('sprite-forge-spr-path', newData.sprPath);
						}
						localStorage.setItem('sprite-forge-transparency', String(newData.transparency));
						localStorage.setItem('sprite-forge-sprites-count', String(newData.spritesCount));
					}
					console.log('DAT paths stored in localStorage for cross-window access');
				} catch (e) {
					console.error('Failed to store paths in localStorage:', e);
				}
			}
		},
		[data]
	);

	const setLoading = React.useCallback((loading: boolean, progress?: { stage: string; total: number; current: number }) => {
		setIsLoading(loading);
		setLoadingProgress(progress || null);
	}, []);

	const clearData = React.useCallback(async () => {
		const currentDatPath = data?.datPath;

		setDataState(null);
		setSpriteReader(null);
		setError(null);
		setOpenedItemIdState(null);
		setOpenedItemCategoryState(null);
		setOpenedItems([]);
		setHighlightedItemId(null);
		setSelectedCategory(ThingCategory.ITEM);
		setOpenedSpriteId(null);
		setUnsavedChanges(new Set());
		setNewItemKeys(new Set());
		try {
			if (typeof window !== 'undefined') {
				localStorage.removeItem('sprite-forge-opened-items');
				localStorage.removeItem('sprite-forge-dat-path');
				const keysToRemove: string[] = [];
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key && key.startsWith('sprite-forge-item-state-')) {
						keysToRemove.push(key);
					}
				}
				keysToRemove.forEach((key) => localStorage.removeItem(key));
			}
		} catch (e) {
			console.error('Failed to clear localStorage:', e);
		}

		if (currentDatPath) {
			try {
				const { invoke } = await import('@tauri-apps/api/core');
				const { emit } = await import('@tauri-apps/api/event');

				await invoke('clear_dat_data', { path: currentDatPath });
				await emit('data_cleared');
				console.log('DAT data cleared from Rust backend and event emitted');
			} catch (e) {
				console.error('Failed to clear DAT data from Rust backend:', e);
			}
		}
	}, [data]);

	const getThing = React.useCallback(
		(id: number, category: ThingCategory): null | ThingType => {
			if (!data) return null;
			return getCategoryMap(data, category).get(id) ?? null;
		},
		[data, updateCounter]
	);

	const getServerItem = React.useCallback(
		(serverId: number): null | ServerItem => {
			return data?.serverItems?.items.get(serverId) ?? null;
		},
		[data, updateCounter]
	);

	const attachServerItems = React.useCallback(
		(serverItems: ServerItemData) => {
			if (!data) return;
			data.serverItems = serverItems;
			data.otbPath = serverItems.otbPath;
			data.xmlPath = serverItems.xmlPath;
			setModifiedServerIds(new Set());
			setUpdateCounter((c) => c + 1);
		},
		[data]
	);

	const setServerProfile = React.useCallback(
		(profileId: string) => {
			const sd = data?.serverItems;
			if (!sd) return;
			sd.profileId = profileId;
			saveCachedProfile(sd.otbPath, profileId);
			setUpdateCounter((c) => c + 1);
		},
		[data]
	);

	const getServerItemsForClient = React.useCallback(
		(clientId: number): ServerItem[] => {
			const sd = data?.serverItems;
			if (!sd) return [];
			const ids = sd.byClientId.get(clientId) ?? [];
			const result: ServerItem[] = [];
			for (const id of ids) {
				const item = sd.items.get(id);
				if (item) result.push(item);
			}
			return result;
		},
		[data, updateCounter]
	);

	const updateServerItem = React.useCallback(
		(serverId: number, updates: Partial<ServerItem>) => {
			const sd = data?.serverItems;
			if (!sd) return;
			const item = sd.items.get(serverId);
			if (!item) return;
			Object.assign(item, updates);
			setModifiedServerIds((prev) => {
				const next = new Set(prev);
				next.add(serverId);
				return next;
			});
			setUpdateCounter((c) => c + 1);
		},
		[data]
	);

	const createMissingServerItems = React.useCallback((): { created: number } => {
		const sd = data?.serverItems;
		if (!data || !sd) return { created: 0 };

		let maxServerId = 0;
		for (const id of sd.items.keys()) if (id > maxServerId) maxServerId = id;

		const newIds: number[] = [];
		for (const thing of data.items.values()) {
			const serverIds = sd.byClientId.get(thing.id);
			if (serverIds && serverIds.length > 0) continue;
			const newItem = createServerItemFromThing(thing, ++maxServerId, data.version.value);
			sd.items.set(newItem.serverId, newItem);
			sd.byClientId.set(thing.id, [newItem.serverId]);
			newIds.push(newItem.serverId);
		}

		if (newIds.length > 0) {
			setModifiedServerIds((prev) => {
				const next = new Set(prev);
				for (const id of newIds) next.add(id);
				return next;
			});
			setUpdateCounter((c) => c + 1);
		}

		return { created: newIds.length };
	}, [data]);

	const reloadServerAttributes = React.useCallback((): { synced: number } => {
		const sd = data?.serverItems;
		if (!data || !sd) return { synced: 0 };

		const ids: number[] = [];
		for (const [clientId, serverIds] of sd.byClientId) {
			const thing = data.items.get(clientId);
			if (!thing) continue;
			for (const sid of serverIds) {
				const server = sd.items.get(sid);
				if (!server) continue;
				syncFromThingType(server, thing, false, data.version.value);
				ids.push(sid);
			}
		}

		if (ids.length > 0) {
			setModifiedServerIds((prev) => {
				const next = new Set(prev);
				for (const id of ids) next.add(id);
				return next;
			});
			setUpdateCounter((c) => c + 1);
		}

		return { synced: ids.length };
	}, [data]);

	const setOpenedItemId = React.useCallback(
		(id: null | number, category?: ThingCategory) => {
			settingItemRef.current = true;
			setOpenedItemIdState(id);
			if (id && data) {
				const itemCategory = category || selectedCategory;
				const thing = getThing(id, itemCategory);
				if (thing) {
					setOpenedItemCategoryState(thing.category);
					setOpenedItems((prev) => {
						const exists = prev.some((item) => item.id === thing.id && item.category === thing.category);
						if (!exists) {
							return [...prev, thing];
						}
						return prev;
					});
				}
			} else {
				setOpenedItemCategoryState(null);
			}
			setTimeout(() => {
				settingItemRef.current = false;
			}, 0);
		},
		[data, selectedCategory, getThing, saveOpenedItemsState]
	);

	const setSelectedCategory = React.useCallback((category: ThingCategory) => {
		setSelectedCategoryState(category);
	}, []);

	const setSelectedCategoryAndItem = React.useCallback(
		(category: ThingCategory, itemId: number) => {
			setOpenedItemId(itemId, category);
		},
		[setOpenedItemId]
	);

	React.useEffect(() => {
		saveOpenedItemsState(openedItems, openedItemId, openedItemCategory);
	}, [openedItems, openedItemId, openedItemCategory, saveOpenedItemsState]);

	React.useEffect(() => {
		if (data && !hasRestoredRef.current) {
			try {
				if (typeof window !== 'undefined') {
					const saved = localStorage.getItem('sprite-forge-opened-items');
					if (saved) {
						const savedState = JSON.parse(saved);
						if (savedState.items && savedState.items.length > 0) {
							hasRestoredRef.current = true;
							const restoredItems: ThingType[] = [];
							for (const { id, category } of savedState.items) {
								const thing = getThing(id, category);
								if (thing) {
									restoredItems.push(thing);
								}
							}
							if (restoredItems.length > 0) {
								setOpenedItems(restoredItems);
							}
							if (savedState.openedId !== null && savedState.openedCategory) {
								const thing = getThing(savedState.openedId, savedState.openedCategory);
								if (thing) {
									setOpenedItemIdState(savedState.openedId);
									setOpenedItemCategoryState(savedState.openedCategory);
								}
							}
						} else {
							hasRestoredRef.current = true;
						}
					} else {
						hasRestoredRef.current = true;
					}
				}
			} catch (e) {
				console.error('Failed to restore opened items:', e);
				hasRestoredRef.current = true;
			}
		}
	}, [data, getThing]);

	const updateThing = React.useCallback(
		(id: number, category: ThingCategory, updates: Partial<ThingType>) => {
			if (!data) return;

			const collection = getCategoryMap(data, category);

			if (collection.has(id)) {
				const thing = collection.get(id)!;
				const key = `${category}-${id}`;

				setOriginalItemsSinceCompile((prev) => {
					if (prev.has(key)) return prev;
					const next = new Map(prev);
					next.set(key, {
						id,
						category,
						data: JSON.parse(JSON.stringify(thing)) as ThingType
					});
					return next;
				});

				Object.assign(thing, updates);

				setModifiedSinceCompile((prev) => {
					const next = new Map(prev);
					next.set(key, {
						id,
						category,
						data: { ...thing }
					});
					return next;
				});

				setUpdateCounter((prev) => prev + 1);
				setUnsavedChanges((prev) => {
					const next = new Set(prev);
					next.delete(key);
					return next;
				});
			}
		},
		[data]
	);

	const hasUnsavedChanges = React.useCallback(
		(id: number, category: ThingCategory): boolean => {
			const key = `${category}-${id}`;
			return unsavedChanges.has(key);
		},
		[unsavedChanges]
	);

	const markUnsavedChanges = React.useCallback((id: number, category: ThingCategory, hasChanges: boolean) => {
		const key = `${category}-${id}`;
		setUnsavedChanges((prev) => {
			const next = new Set(prev);
			if (hasChanges) {
				next.add(key);
			} else {
				next.delete(key);
			}
			return next;
		});
	}, []);

	const isNewItem = React.useCallback(
		(id: number, category: ThingCategory): boolean => {
			return newItemKeys.has(`${category}-${id}`);
		},
		[newItemKeys]
	);

	const markAsNewItem = React.useCallback((id: number, category: ThingCategory) => {
		setNewItemKeys((prev) => {
			const next = new Set(prev);
			next.add(`${category}-${id}`);
			return next;
		});
	}, []);

	const clearNewItem = React.useCallback((id: number, category: ThingCategory) => {
		setNewItemKeys((prev) => {
			if (!prev.has(`${category}-${id}`)) return prev;
			const next = new Set(prev);
			next.delete(`${category}-${id}`);
			return next;
		});
	}, []);

	const notifySpritesLoaded = React.useCallback(() => {
		setSpriteLoadVersion((v) => {
			try {
				logger.log(EventCode.CTX_LOAD_END, { v: v + 1 });
			} catch {}
			return v + 1;
		});
	}, []);

	const notifySpriteImport = React.useCallback(() => {
		setSpriteImportVersion((v) => v + 1);
	}, []);

	const notifyDataChanged = React.useCallback(
		(spriteIds?: number[]) => {
			setUpdateCounter((c) => c + 1);

			if (spriteIds && spriteIds.length > 0 && data) {
				setModifiedSprites((prev) => {
					const next = new Map(prev);
					for (const spriteId of spriteIds) {
						const sprite = data.sprites.get(spriteId);
						if (sprite) {
							next.set(spriteId, sprite);
						} else {
							next.set(spriteId, {
								id: spriteId,
								isEmpty: true,
								transparent: data.transparency,
								rgbaPixels: new Uint8Array(4096),
								compressedPixels: new Uint8Array(0)
							} as Sprite);
						}
					}
					return next;
				});
			}
		},
		[data]
	);

	const getSprite = React.useCallback(
		(id: number): null | Sprite => {
			if (!data || !data.sprPath) return null;

			try {
				logger.log(EventCode.CTX_SPRITE_REQ, { id });
			} catch {}

			if (data.sprites.has(id)) {
				try {
					logger.log(EventCode.CTX_SPRITE_HIT, { id });
				} catch {}
				return data.sprites.get(id)!;
			}

			try {
				logger.log(EventCode.CTX_SPRITE_MISS, { id, v: spriteLoadVersion, sz: data.sprites.size });
			} catch {}
			return null;
		},
		[data, spriteLoadVersion]
	);

	const hasModifiedItems = React.useCallback(() => {
		return modifiedSinceCompile.size > 0 || modifiedSprites.size > 0 || modifiedServerIds.size > 0;
	}, [modifiedSinceCompile, modifiedSprites, modifiedServerIds]);

	const clearModifiedTracking = React.useCallback(() => {
		setModifiedSinceCompile(new Map());
		setOriginalItemsSinceCompile(new Map());
		setModifiedSprites(new Map());
		setModifiedServerIds(new Set());
		setNewItemKeys(new Set());
	}, []);

	const compileFiles = React.useCallback(async (): Promise<null | { synced: number; created: number }> => {
		if (!data || !data.datPath || !data.sprPath) {
			throw new Error('No data or file paths available for compilation');
		}

		const datChanged = modifiedSinceCompile.size > 0 || modifiedSprites.size > 0;
		const hasOtb = !!data.otbPath && !!data.serverItems;
		const serverChanged = hasOtb && (modifiedServerIds.size > 0 || (autoSyncServer && datChanged));

		if (!datChanged && !serverChanged) {
			console.log('No modifications to compile');
			return null;
		}

		let compileSucceeded = false;
		let otbResult: null | { synced: number; created: number } = null;
		try {
			if (datChanged) {
				const { compileFiles: doCompile } = await import('@/lib/formats/tibia/compiler');
				await doCompile({
					data,
					datPath: data.datPath,
					sprPath: data.sprPath,
					modifiedItems: modifiedSinceCompile,
					directlyModifiedSprites: modifiedSprites,
					originalItems: originalItemsSinceCompile,
					onProgress: (stage, current, total) => {
						setLoading(true, { stage, total, current });
					}
				});
			}

			if (hasOtb && (datChanged || serverChanged)) {
				setLoading(true, { total: 1, current: 1, stage: 'Writing server items (OTB/XML)...' });
				const { compileServerItems } = await import('@/lib/formats/tibia/otb');
				otbResult = await compileServerItems(data, autoSyncServer, data.version.value);
				console.log(`[OTB] synced ${otbResult.synced} server items, created ${otbResult.created} missing`);
			}

			compileSucceeded = true;
			return otbResult;
		} finally {
			if (compileSucceeded) {
				clearModifiedTracking();
			}
			setLoading(false);
		}
	}, [
		data,
		modifiedSinceCompile,
		modifiedSprites,
		modifiedServerIds,
		autoSyncServer,
		originalItemsSinceCompile,
		clearModifiedTracking
	]);

	const restoreCommit = React.useCallback(
		async (hash: string) => {
			if (!data) {
				throw new Error('No project open');
			}

			const { getCommitState, decodeCommitSpritePayload } = await import('@/lib/versionControl');
			const commit = await getCommitState(hash);
			if (!commit) {
				throw new Error('Commit not found or unreadable');
			}

			let itemsRestored = 0;
			let itemsSkipped = 0;
			let spritesRestored = 0;
			let spritesSkipped = 0;

			for (const entry of commit.items) {
				if (!entry.before) {
					itemsSkipped++;
					continue;
				}
				updateThing(entry.id, entry.category, entry.before);
				itemsRestored++;
			}

			const restoredSpriteIds: number[] = [];
			for (const entry of commit.sprites) {
				if (!entry.before) {
					if (data.sprites.has(entry.id)) {
						data.sprites.delete(entry.id);
						restoredSpriteIds.push(entry.id);
						spritesRestored++;
					} else {
						spritesSkipped++;
					}
					continue;
				}
				const payload = decodeCommitSpritePayload(entry.before);
				data.sprites.set(entry.id, {
					id: entry.id,
					transparent: payload.transparent,
					rgbaPixels: new Uint8Array(4096),
					compressedPixels: payload.compressedPixels,
					isEmpty: payload.compressedPixels.length === 0
				} as Sprite);
				restoredSpriteIds.push(entry.id);
				spritesRestored++;
			}

			if (restoredSpriteIds.length > 0) {
				notifyDataChanged(restoredSpriteIds);
			} else {
				notifyDataChanged();
			}

			return { itemsSkipped, itemsRestored, spritesSkipped, spritesRestored };
		},
		[data, updateThing, notifyDataChanged]
	);

	return (
		<AssetDataContext.Provider
			value={{
				data,
				error,
				setData,
				setError,
				getThing,
				isLoading,
				clearData,
				getSprite,
				isNewItem,
				spriteSize,
				setLoading,
				updateThing,
				openedItems,
				spriteReader,
				openedItemId,
				compileFiles,
				clearNewItem,
				restoreCommit,
				updateCounter,
				markAsNewItem,
				getServerItem,
				openedSpriteId,
				autoSyncServer,
				loadingProgress,
				setOpenedItemId,
				modifiedSprites,
				removeOpenedItem,
				selectedCategory,
				hasModifiedItems,
				updateServerItem,
				setServerProfile,
				attachServerItems,
				highlightedItemId,
				setOpenedSpriteId,
				spriteLoadVersion,
				hasUnsavedChanges,
				notifyDataChanged,
				setAutoSyncServer,
				openedItemCategory,
				markUnsavedChanges,
				notifySpriteImport,
				setSelectedCategory,
				notifySpritesLoaded,
				highlightedSpriteId,
				spriteImportVersion,
				setHighlightedItemId,
				modifiedSinceCompile,
				clearModifiedTracking,
				reloadServerAttributes,
				setHighlightedSpriteId,
				getServerItemsForClient,
				createMissingServerItems,
				setSelectedCategoryAndItem,
				formatConfig: TIBIA_FORMAT_CONFIG
			}}
		>
			{children}
		</AssetDataContext.Provider>
	);
};

export const useAssetData = () => {
	const context = React.useContext(AssetDataContext);
	if (context === undefined) {
		throw new Error('useAssetData must be used within a AssetDataProvider');
	}
	return context;
};
