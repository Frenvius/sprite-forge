import type { SceneTile } from '~/usecase/util/spriteLayoutUtils';
import type { OutfitData, Visibility } from '~/usecase/context/PropertiesContext/types';

import React from 'react';
import { invoke } from '@tauri-apps/api/core';

import { ThingCategory } from '~/lib/formats/tibia';
import { useToast } from '~/usecase/hooks/useToast';
import { ZOOM_LEVELS } from '~/usecase/util/constants';
import { type Sprite, type ThingType } from '~/lib/formats/tibia';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { useGeneralSettings } from '~/usecase/context/GeneralSettingsContext';
import { loadItemState, saveItemState, getItemStateKey, type ItemPropertiesState } from '~/usecase/util/itemStateUtils';

export const useObjectProperties = (override?: { item: null | ThingType; getSprite: (id: number) => Sprite | undefined }) => {
	const {
		data,
		getThing,
		isNewItem,
		spriteSize,
		updateThing,
		openedItemId,
		clearNewItem,
		updateCounter,
		setOpenedItemId,
		removeOpenedItem,
		selectedCategory,
		hasUnsavedChanges,
		openedItemCategory,
		markUnsavedChanges,
		notifySpritesLoaded,
		setHighlightedSpriteId
	} = useAssetData();
	const { settings } = useGeneralSettings();
	const autoPlayRef = React.useRef(settings.autoPlayAnimation);
	autoPlayRef.current = settings.autoPlayAnimation;
	const defaultZoomRef = React.useRef(settings.defaultZoom);
	defaultZoomRef.current = settings.defaultZoom;
	const projectItem = openedItemId && openedItemCategory ? getThing(openedItemId, openedItemCategory) : null;
	const item = override ? override.item : projectItem;

	const [draftItem, setDraftItem] = React.useState<typeof item>(null);
	const [hasChanges, setHasChanges] = React.useState(false);
	const [showCloseConfirm, setShowCloseConfirm] = React.useState(false);
	const [selectedFrameGroup, setSelectedFrameGroup] = React.useState(0);
	const selectedFrameGroupRef = React.useRef(0);
	const originalItemRef = React.useRef<typeof item>(null);
	const isNewItemRef = React.useRef(isNewItem);
	const hasUnsavedChangesRef = React.useRef(hasUnsavedChanges);
	isNewItemRef.current = isNewItem;
	hasUnsavedChangesRef.current = hasUnsavedChanges;

	React.useEffect(() => {
		if (override) return;
		if (item && openedItemId && openedItemCategory) {
			let initialItem = { ...item };
			let initialGroup = 0;

			if (item.category === ThingCategory.OUTFIT) {
				const versionSupportsFrameGroups = (data?.version.value || 0) >= 1057;

				if (versionSupportsFrameGroups && (!initialItem.frameGroupsData || initialItem.frameGroupsData.length === 0)) {
					initialItem.frameGroupsData = [
						{
							type: 0,
							width: initialItem.width,
							height: initialItem.height,
							layers: initialItem.layers,
							frames: initialItem.frames,
							patternX: initialItem.patternX,
							patternY: initialItem.patternY,
							patternZ: initialItem.patternZ,
							exactSize: initialItem.exactSize,
							loopCount: initialItem.loopCount,
							startFrame: initialItem.startFrame,
							isAnimation: initialItem.isAnimation,
							animationMode: initialItem.animationMode,
							frameDurations: initialItem.frameDurations,
							spriteIndex: [...(initialItem.spriteIndex || [])]
						}
					];
				}

				if (initialItem.frameGroupsData && initialItem.frameGroupsData.length > 1) {
					initialGroup = 1;
					const group = initialItem.frameGroupsData[1];
					initialItem = {
						...initialItem,
						width: group.width,
						height: group.height,
						frames: group.frames,
						layers: group.layers,
						patternX: group.patternX,
						patternY: group.patternY,
						patternZ: group.patternZ,
						exactSize: group.exactSize,
						spriteIndex: group.spriteIndex,
						isAnimation: group.isAnimation,
						loopCount: group.loopCount || 0,
						startFrame: group.startFrame || 0,
						animationMode: group.animationMode || 0,
						frameDurations: group.frameDurations || []
					};
				} else if (initialItem.frameGroupsData && initialItem.frameGroupsData.length === 1) {
					const group = initialItem.frameGroupsData[0];
					initialItem = {
						...initialItem,
						width: group.width,
						height: group.height,
						frames: group.frames,
						layers: group.layers,
						patternX: group.patternX,
						patternY: group.patternY,
						patternZ: group.patternZ,
						exactSize: group.exactSize,
						spriteIndex: group.spriteIndex,
						isAnimation: group.isAnimation,
						loopCount: group.loopCount || 0,
						startFrame: group.startFrame || 0,
						animationMode: group.animationMode || 0,
						frameDurations: group.frameDurations || []
					};
				}
			}

			const isNew = isNewItemRef.current(openedItemId, openedItemCategory);
			const wasMarkedUnsaved = hasUnsavedChangesRef.current(openedItemId, openedItemCategory);
			setDraftItem(initialItem);
			setHasChanges(isNew || wasMarkedUnsaved);
			setSelectedFrameGroup(initialGroup);
			selectedFrameGroupRef.current = initialGroup;
			originalItemRef.current = { ...initialItem };
		} else {
			originalItemRef.current = null;
			setDraftItem(null);
			setHasChanges(false);
		}
	}, [item, openedItemId, openedItemCategory, updateCounter]);

	const handlePropertyChange = React.useCallback(
		(property: string, value: any) => {
			if (!draftItem || !openedItemId || !openedItemCategory) return;

			let finalValue = value;
			if (typeof (draftItem as any)[property] === 'number' && typeof value === 'string') {
				finalValue = Number(value);
			}

			setDraftItem((prev) => {
				if (!prev) return null;
				const newItem = { ...prev, [property]: finalValue };

				const currentFrameGroup = selectedFrameGroupRef.current;
				if (newItem.frameGroupsData && newItem.frameGroupsData[currentFrameGroup]) {
					const newGroups = [...newItem.frameGroupsData];
					newGroups[currentFrameGroup] = {
						...newGroups[currentFrameGroup],
						[property]: finalValue
					};
					newItem.frameGroupsData = newGroups;
				}
				return newItem;
			});
			setHasChanges(true);
			markUnsavedChanges(openedItemId, openedItemCategory, true);
		},
		[draftItem, openedItemId, openedItemCategory, markUnsavedChanges]
	);

	const handleSave = () => {
		if (!draftItem || !openedItemId || !hasChanges || !openedItemCategory) return;

		const updates: Partial<typeof item> = {};
		Object.keys(draftItem).forEach((key) => {
			if (item && (draftItem as any)[key] !== (item as any)[key]) {
				(updates as any)[key] = (draftItem as any)[key];
			}
		});

		updateThing(openedItemId, openedItemCategory, updates);
		setHasChanges(false);
		markUnsavedChanges(openedItemId, openedItemCategory, false);
		clearNewItem(openedItemId, openedItemCategory);
	};

	const handleDiscardChanges = () => {
		if (!originalItemRef.current || !openedItemId || !openedItemCategory) return;

		const isNew = isNewItem(openedItemId, openedItemCategory);
		setDraftItem({ ...originalItemRef.current });
		setHasChanges(isNew);
		markUnsavedChanges(openedItemId, openedItemCategory, isNew);

		if (originalItemRef.current.category === ThingCategory.OUTFIT) {
			const initialGroup = originalItemRef.current.frameGroupsData?.length > 1 ? 1 : 0;
			setSelectedFrameGroup(initialGroup);
			selectedFrameGroupRef.current = initialGroup;
		}
	};

	const hasPropertyChanged = (property: string): boolean => {
		if (!originalItemRef.current || !draftItem) return false;
		const original = (originalItemRef.current as any)[property];
		const current = (draftItem as any)[property];

		if (Array.isArray(original) && Array.isArray(current)) {
			return JSON.stringify(original) !== JSON.stringify(current);
		}

		return original !== current;
	};

	const handleUndoProperty = (property: string) => {
		if (!originalItemRef.current || !draftItem || !openedItemId || !openedItemCategory) return;

		const originalValue = (originalItemRef.current as any)[property];
		setDraftItem((prev) => {
			if (!prev) return null;
			const updated = { ...prev, [property]: originalValue };

			const stillHasChanges = Object.keys(updated).some((key) => {
				if (key === property) return false;
				const orig = (originalItemRef.current as any)?.[key];
				const curr = (updated as any)[key];

				if (Array.isArray(orig) && Array.isArray(curr)) {
					return JSON.stringify(orig) !== JSON.stringify(curr);
				}

				return orig !== curr;
			});

			const isNew = isNewItem(openedItemId, openedItemCategory);
			const effective = stillHasChanges || isNew;
			setHasChanges(effective);
			markUnsavedChanges(openedItemId, openedItemCategory, effective);

			return updated;
		});
	};

	const handleClose = () => {
		if (hasChanges) {
			setShowCloseConfirm(true);
			return;
		}

		performClose();
	};

	const performClose = () => {
		if (!openedItemId || !openedItemCategory) return;

		try {
			if (typeof window !== 'undefined') {
				const key = getItemStateKey(openedItemCategory, openedItemId);
				localStorage.removeItem(key);
			}
		} catch (e) {
			console.error('Failed to delete item state from localStorage:', e);
		}

		removeOpenedItem(openedItemId, openedItemCategory);

		setOpenedItemId(null);
		setDraftItem(null);
		setHasChanges(false);
		setShowCloseConfirm(false);
	};

	const clientVersion = data?.version.value || 0;
	const itemCategory = override?.item ? (override.item.category as ThingCategory) : openedItemCategory || selectedCategory;
	const isItem = itemCategory === ThingCategory.ITEM;
	const isOutfit = itemCategory === ThingCategory.OUTFIT;
	const isMissile = itemCategory === ThingCategory.MISSILE;

	const supportsFrameGroups = clientVersion >= 1057;

	const visibility: Visibility = {
		isItem,
		isOutfit,
		isMissile,
		showHooks: isItem,
		supportsFrameGroups,
		showMinimap: isItem,
		showWriting: isItem,
		showLensHelp: isItem,
		showInteraction: isItem,
		showPhysicsGround: isItem,
		showLayerPosition: isItem,
		showAnimateAlways: isOutfit,
		showDisplacementElevation: isItem,
		showPatternZ: clientVersion >= 755,
		showDisplacement: isItem || isOutfit,
		showMarket: isItem && clientVersion >= 940,
		showUsable: isItem && clientVersion >= 1021,
		showHangable: isItem && clientVersion >= 755,
		showDontHide: isItem && clientVersion >= 780,
		showEquipment: isItem && clientVersion >= 900,
		showIgnoreLook: isItem && clientVersion >= 780,
		showWrappable: isItem && clientVersion >= 1021,
		showTopEffect: isItem && clientVersion >= 1021,
		showAnimationProperties: clientVersion >= 1050,
		showTranslucent: isItem && clientVersion >= 860,
		showGroundBorder: isItem && clientVersion >= 755,
		showDefaultActions: isItem && clientVersion >= 1021,
		showNoMoveAnimation: isItem && clientVersion >= 1010,
		showHasCharges: isItem && clientVersion >= 780 && clientVersion <= 854,
		showFloorChange: isItem && clientVersion >= 710 && clientVersion <= 854
	};

	const [zoom, setZoom] = React.useState(settings.defaultZoom);
	const [panX, setPanX] = React.useState(0);
	const [panY, setPanY] = React.useState(0);
	const [showExactSize, setShowExactSize] = React.useState(false);
	const [showGrid, setShowGrid] = React.useState(false);
	const [isPanEnabled, setIsPanEnabled] = React.useState(false);
	const [isMiddleMousePanning, setIsMiddleMousePanning] = React.useState(false);
	const [showDirectionButtons, setShowDirectionButtons] = React.useState(true);

	const [patternX, setPatternX] = React.useState(0);
	const [patternY, setPatternY] = React.useState(0);
	const [patternZ, setPatternZ] = React.useState(0);
	const [currentFrame, setCurrentFrame] = React.useState(0);
	const [currentLayer, setCurrentLayer] = React.useState(0);
	const [isPlaying, setIsPlaying] = React.useState(false);

	const [outfitData, setOutfitData] = React.useState<OutfitData>({
		head: 0,
		body: 0,
		legs: 0,
		feet: 0,
		addons: [false, false]
	});

	const [showScene, setShowScene] = React.useState(false);
	const [showSmooth, setShowSmooth] = React.useState(false);
	const [defaultSceneTiles, setDefaultSceneTiles] = React.useState<null | SceneTile[][]>(null);
	const [sceneSize, setSceneSize] = React.useState({ width: 0, height: 0 });
	const [sceneScrollOffset, setSceneScrollOffset] = React.useState(0);
	const sceneScrollRef = React.useRef(0);

	React.useEffect(() => {
		if (showScene && !defaultSceneTiles) {
			loadDefaultScene();
		}
	}, [showScene]);

	const loadDefaultScene = async () => {
		try {
			const config = await invoke<{ default_scene?: string }>('get_config');
			if (config.default_scene) {
				const content = await invoke<string>('load_scene', { name: config.default_scene });
				const scene = JSON.parse(content);
				setDefaultSceneTiles(scene.tiles);
				setSceneSize({ width: scene.width, height: scene.height });
			} else {
				try {
					const response = await fetch('/default-scene.json');
					if (response.ok) {
						const scene = await response.json();
						if (scene.tiles && scene.width && scene.height) {
							setDefaultSceneTiles(scene.tiles);
							setSceneSize({ width: scene.width, height: scene.height });
						}
					}
				} catch (fetchError) {
					console.error('Failed to load public default scene:', fetchError);
				}
			}
		} catch (e) {
			console.error('Failed to load default scene:', e);
		}
	};

	const handleFrameGroupChange = (index: number) => {
		setSelectedFrameGroup(index);
		selectedFrameGroupRef.current = index;
		if (draftItem && draftItem.frameGroupsData) {
			const group = draftItem.frameGroupsData[index];
			if (group) {
				setDraftItem((prev) => ({
					...prev!,
					width: group.width,
					height: group.height,
					frames: group.frames,
					layers: group.layers,
					patternX: group.patternX,
					patternY: group.patternY,
					patternZ: group.patternZ,
					exactSize: group.exactSize,
					spriteIndex: group.spriteIndex,
					isAnimation: group.isAnimation,
					loopCount: group.loopCount || 0,
					startFrame: group.startFrame || 0,
					animationMode: group.animationMode || 0,
					frameDurations: group.frameDurations || []
				}));
				setCurrentFrame(0);
			}
		}
	};

	const handleCreateFrameGroup = () => {
		if (!draftItem || !isOutfit) return;

		const currentGroups = draftItem.frameGroupsData || [];
		if (currentGroups.length >= 2) return;

		let type = 0;
		if (currentGroups.length > 0) {
			const existingType = currentGroups[0].type;
			type = existingType === 0 ? 1 : 0;
		}

		const width = 1;
		const height = 1;
		const exactSize = spriteSize;
		const layers = 1;
		const patternX = 4;
		const patternY = 1;
		const patternZ = 1;
		const frames = type === 1 ? 3 : 1;

		const totalSprites = width * height * layers * patternX * patternY * patternZ * frames;
		const spriteIndex = new Array(totalSprites).fill(0);

		const newGroup = {
			type,
			width,
			height,
			layers,
			frames,
			patternX,
			patternY,
			patternZ,
			exactSize,
			spriteIndex,
			loopCount: 0,
			startFrame: 0,
			animationMode: 0,
			frameDurations: [],
			isAnimation: frames > 1
		};

		const newGroups = [...currentGroups, newGroup];
		const newIndex = newGroups.length - 1;

		setDraftItem((prev) => ({
			...prev!,
			width: newGroup.width,
			height: newGroup.height,
			frames: newGroup.frames,
			layers: newGroup.layers,
			frameGroupsData: newGroups,
			patternX: newGroup.patternX,
			patternY: newGroup.patternY,
			patternZ: newGroup.patternZ,
			exactSize: newGroup.exactSize,
			spriteIndex: newGroup.spriteIndex,
			isAnimation: newGroup.isAnimation,
			loopCount: newGroup.loopCount || 0,
			startFrame: newGroup.startFrame || 0,
			animationMode: newGroup.animationMode || 0,
			frameDurations: newGroup.frameDurations || []
		}));

		setSelectedFrameGroup(newIndex);
		selectedFrameGroupRef.current = newIndex;
		setCurrentFrame(0);
		setHasChanges(true);
		if (openedItemId && openedItemCategory) {
			markUnsavedChanges(openedItemId, openedItemCategory, true);
		}
	};

	const handleDeleteFrameGroup = () => {
		if (!draftItem || !isOutfit) return;

		const currentGroups = draftItem.frameGroupsData || [];
		if (currentGroups.length <= 1) return;

		const newGroups = currentGroups.filter((_, idx) => idx !== selectedFrameGroup);
		const newIndex = Math.min(selectedFrameGroup, newGroups.length - 1);
		const group = newGroups[newIndex];

		setDraftItem((prev) => ({
			...prev!,
			width: group.width,
			height: group.height,
			frames: group.frames,
			layers: group.layers,
			patternX: group.patternX,
			patternY: group.patternY,
			patternZ: group.patternZ,
			frameGroupsData: newGroups,
			exactSize: group.exactSize,
			spriteIndex: group.spriteIndex,
			isAnimation: group.isAnimation,
			loopCount: group.loopCount || 0,
			startFrame: group.startFrame || 0,
			animationMode: group.animationMode || 0,
			frameDurations: group.frameDurations || []
		}));

		setSelectedFrameGroup(newIndex);
		selectedFrameGroupRef.current = newIndex;
		setCurrentFrame(0);
		setHasChanges(true);
		if (openedItemId && openedItemCategory) {
			markUnsavedChanges(openedItemId, openedItemCategory, true);
		}
	};

	const handleZoomIn = () => {
		const currentIndex = ZOOM_LEVELS.indexOf(zoom);
		if (currentIndex < ZOOM_LEVELS.length - 1) {
			setZoom(ZOOM_LEVELS[currentIndex + 1]);
		}
	};

	const handleZoomOut = () => {
		const currentIndex = ZOOM_LEVELS.indexOf(zoom);
		if (currentIndex > 0) {
			setZoom(ZOOM_LEVELS[currentIndex - 1]);
		}
	};

	const handleResetPan = () => {
		setPanX(0);
		setPanY(0);
	};

	const canvasContainerRef = React.useRef<HTMLDivElement>(null);
	const { toast } = useToast();
	const [copyFlash, setCopyFlash] = React.useState(false);

	const handleCopySprite = React.useCallback(async () => {
		const container = canvasContainerRef.current;
		if (!container) return;
		const canvas = container.querySelector('canvas');
		if (!canvas) {
			toast({ title: 'Copy failed', variant: 'destructive', description: 'No sprite to copy' });
			return;
		}
		setCopyFlash(true);
		setTimeout(() => setCopyFlash(false), 250);
		try {
			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
			if (!blob) throw new Error('Failed to encode sprite');
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			toast({ title: 'Copied', description: 'Sprite copied to clipboard' });
		} catch (err) {
			console.error('Clipboard write failed:', err);
			toast({ title: 'Copy failed', variant: 'destructive', description: 'Could not write image to clipboard' });
		}
	}, [toast]);

	const handleResetSprites = () => {
		if (!item || !draftItem) return;

		if (item.category === ThingCategory.OUTFIT && item.frameGroupsData) {
			const currentGroupIndex = selectedFrameGroupRef.current;
			const originalGroup = item.frameGroupsData[currentGroupIndex];
			if (originalGroup) {
				handlePropertyChange('spriteIndex', [...originalGroup.spriteIndex]);
				return;
			}
		}

		handlePropertyChange('spriteIndex', [...item.spriteIndex]);
	};

	const [hoveredSpriteId, setHoveredSpriteId] = React.useState<null | number>(null);

	const handleSpriteDoubleClick = React.useCallback(
		(spriteId: number) => {
			setHighlightedSpriteId(spriteId);
		},
		[setHighlightedSpriteId]
	);

	const handleSpriteDrop = React.useCallback(
		(index: number, spriteId: number | number[]) => {
			if (draftItem && draftItem.spriteIndex) {
				const newSpriteIndex = [...draftItem.spriteIndex];

				if (Array.isArray(spriteId)) {
					for (let i = 0; i < spriteId.length; i++) {
						const targetIndex = index + i;
						if (targetIndex < newSpriteIndex.length) {
							newSpriteIndex[targetIndex] = spriteId[i];
						}
					}
				} else {
					if (index >= 0 && index < newSpriteIndex.length) {
						newSpriteIndex[index] = spriteId;
					}
				}

				handlePropertyChange('spriteIndex', newSpriteIndex);
			}
		},
		[draftItem, handlePropertyChange]
	);
	const handleSpriteHover = (spriteId: null | number) => {
		setHoveredSpriteId(spriteId);
	};

	const hasLoadedStateRef = React.useRef(false);
	const isLoadingStateRef = React.useRef(false);
	const previousItemRef = React.useRef<null | { id: number; category: ThingCategory }>(null);
	const stateRefs = React.useRef({
		zoom: 1,
		panX: 0,
		panY: 0,
		patternX: 0,
		patternY: 0,
		patternZ: 0,
		currentFrame: 0,
		currentLayer: 0,
		showGrid: false,
		isPlaying: false,
		showExactSize: false,
		outfitData: { head: 0, body: 0, legs: 0, feet: 0, addons: [false, false] } as OutfitData
	});

	React.useEffect(() => {
		stateRefs.current.zoom = zoom;
		stateRefs.current.panX = panX;
		stateRefs.current.panY = panY;
		stateRefs.current.patternX = patternX;
		stateRefs.current.patternY = patternY;
		stateRefs.current.patternZ = patternZ;
		stateRefs.current.currentFrame = currentFrame;
		stateRefs.current.currentLayer = currentLayer;
		stateRefs.current.isPlaying = isPlaying;
		stateRefs.current.showExactSize = showExactSize;
		stateRefs.current.showGrid = showGrid;
		stateRefs.current.outfitData = outfitData;
	}, [
		zoom,
		panX,
		panY,
		patternX,
		patternY,
		patternZ,
		currentFrame,
		currentLayer,
		isPlaying,
		showExactSize,
		showGrid,
		outfitData
	]);

	const animationState = React.useRef({
		lastTime: 0,
		timeRemaining: 0,
		skipFirstFrame: false,
		durations: [] as number[]
	});

	const requestRef = React.useRef<number>();

	const animate = (time: number) => {
		if (!isPlaying || !draftItem) return;

		const state = animationState.current;

		if (state.lastTime === 0) {
			state.lastTime = time;
			requestRef.current = requestAnimationFrame(animate);
			return;
		}

		const elapsed = time - state.lastTime;
		state.lastTime = time;

		if (showScene && defaultSceneTiles) {
			const scrollSpeed = elapsed * 0.06;
			sceneScrollRef.current += scrollSpeed;
			setSceneScrollOffset(Math.floor(sceneScrollRef.current));
		}

		if (state.durations.length === 0) return;

		if (elapsed >= state.timeRemaining) {
			setCurrentFrame((prevFrame) => {
				const frames = draftItem.frames;
				let nextFrame = prevFrame + 1;

				if (nextFrame >= frames) {
					nextFrame = 0;
				}

				if (state.skipFirstFrame && nextFrame === 0) {
					nextFrame = 1 % frames;
				}

				const nextDuration = state.durations[nextFrame] || 200;
				state.timeRemaining = nextDuration - (elapsed - state.timeRemaining);

				if (state.timeRemaining < 0) state.timeRemaining = 0;

				return nextFrame;
			});
		} else {
			state.timeRemaining -= elapsed;
		}

		requestRef.current = requestAnimationFrame(animate);
	};

	React.useEffect(() => {
		if (isPlaying && draftItem) {
			const currentGroup = draftItem.frameGroupsData?.[selectedFrameGroupRef.current];

			let durations: number[] = [];

			const groupDurations = currentGroup?.frameDurations;
			if (groupDurations && groupDurations.length > 0) {
				durations = groupDurations.map((d) => d.minimum);
			} else if (draftItem.frameDurations && draftItem.frameDurations.length > 0) {
				durations = draftItem.frameDurations.map((d) => d.minimum);
			} else {
				let defaultDuration = 500;
				if (draftItem.category === ThingCategory.OUTFIT) {
					defaultDuration = 300;
				} else if (draftItem.category === ThingCategory.EFFECT) {
					defaultDuration = 100;
				} else if (draftItem.category === ThingCategory.MISSILE) {
					defaultDuration = 150;
				}
				durations = new Array(draftItem.frames).fill(defaultDuration);
			}

			const isOutfitDraft = draftItem.category === ThingCategory.OUTFIT;
			const isGroupWalking = currentGroup?.type === 1;

			if (isGroupWalking && draftItem.frames > 2) {
				const calculatedDuration = Math.floor(1000 / draftItem.frames);
				durations = durations.map(() => calculatedDuration);
			}

			durations = durations.map((d) => Math.max(d, 50));

			console.log('[AnimDebug] Setup', {
				durations,
				isGroupWalking,
				frames: draftItem.frames,
				category: draftItem.category,
				groupDurationsLen: groupDurations?.length,
				itemDurationsLen: draftItem.frameDurations?.length
			});

			animationState.current.durations = durations;

			const animateAlways = draftItem.animateAlways;
			const isIdle = currentGroup?.type !== 1;

			animationState.current.skipFirstFrame = isOutfitDraft && !animateAlways && isIdle;

			if (animationState.current.timeRemaining <= 0) {
				animationState.current.timeRemaining = durations[currentFrame] || 200;
			}

			animationState.current.lastTime = 0;
			requestRef.current = requestAnimationFrame(animate);
		} else {
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		}

		return () => {
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		};
	}, [isPlaying, draftItem, data, selectedFrameGroup]);

	const handlePatternUp = () => {
		setPatternX(0);
	};

	const handlePatternDown = () => {
		if (item && item.patternX >= 3) {
			setPatternX(2);
		}
	};

	const handlePatternLeft = () => {
		if (item && item.patternX >= 4) {
			setPatternX(3);
		}
	};

	const handlePatternRight = () => {
		if (item && item.patternX >= 2) {
			setPatternX(1);
		}
	};

	const handleFirstFrame = () => {
		setCurrentFrame(0);
	};

	const handlePrevFrame = () => {
		if (currentFrame > 0) {
			setCurrentFrame(currentFrame - 1);
		}
	};

	const handleNextFrame = () => {
		if (draftItem && currentFrame < draftItem.frames - 1) {
			setCurrentFrame(currentFrame + 1);
		}
	};

	const handleLastFrame = () => {
		if (draftItem) {
			setCurrentFrame(draftItem.frames - 1);
		}
	};

	const handlePlayPause = () => {
		if (!isPlaying) {
			if (isOutfit && draftItem && !draftItem.animateAlways && currentFrame === 0 && draftItem.frames > 1) {
				setCurrentFrame(1);
			}
			setIsPlaying(true);
		} else {
			setIsPlaying(false);
			if (isOutfit) {
				setCurrentFrame(0);
			}
			sceneScrollRef.current = 0;
			setSceneScrollOffset(0);
		}
	};

	const handleRandomizeColors = () => {
		setOutfitData({
			...outfitData,
			head: Math.floor(Math.random() * 256),
			body: Math.floor(Math.random() * 256),
			legs: Math.floor(Math.random() * 256),
			feet: Math.floor(Math.random() * 256)
		});
	};

	React.useEffect(() => {
		if (override) return;
		if (draftItem && openedItemId && openedItemCategory) {
			if (
				previousItemRef.current &&
				(previousItemRef.current.id !== openedItemId || previousItemRef.current.category !== openedItemCategory) &&
				hasLoadedStateRef.current
			) {
				const prevState: ItemPropertiesState = {
					zoom: stateRefs.current.zoom,
					panX: stateRefs.current.panX,
					panY: stateRefs.current.panY,
					patternX: stateRefs.current.patternX,
					patternY: stateRefs.current.patternY,
					patternZ: stateRefs.current.patternZ,
					showGrid: stateRefs.current.showGrid,
					isPlaying: stateRefs.current.isPlaying,
					currentFrame: stateRefs.current.currentFrame,
					currentLayer: stateRefs.current.currentLayer,
					showExactSize: stateRefs.current.showExactSize,
					outfitData: { ...stateRefs.current.outfitData }
				};
				saveItemState(previousItemRef.current.category, previousItemRef.current.id, prevState);
			}

			hasLoadedStateRef.current = false;
			isLoadingStateRef.current = true;

			const savedState = loadItemState(openedItemCategory, openedItemId);

			const zoomValue = savedState?.zoom !== undefined ? savedState.zoom : defaultZoomRef.current;
			const panXValue = savedState?.panX !== undefined ? savedState.panX : 0;
			const panYValue = savedState?.panY !== undefined ? savedState.panY : 0;

			let patternXValue = savedState?.patternX !== undefined ? savedState.patternX : 0;
			let patternYValue = savedState?.patternY !== undefined ? savedState.patternY : 0;
			if (!savedState) {
				if (openedItemCategory === ThingCategory.MISSILE) {
					patternXValue = 1;
					patternYValue = 2;
				} else if (openedItemCategory === ThingCategory.OUTFIT) {
					patternXValue = 2;
					patternYValue = 0;
				}
			}
			patternXValue = Math.min(patternXValue, Math.max(0, draftItem.patternX - 1));
			patternYValue = Math.min(patternYValue, Math.max(0, draftItem.patternY - 1));
			const patternZValue =
				savedState?.patternZ !== undefined ? Math.min(savedState.patternZ, Math.max(0, draftItem.patternZ - 1)) : 0;

			const currentFrameValue =
				savedState?.currentFrame !== undefined ? Math.min(savedState.currentFrame, Math.max(0, draftItem.frames - 1)) : 0;
			const currentLayerValue =
				savedState?.currentLayer !== undefined ? Math.min(savedState.currentLayer, Math.max(0, draftItem.layers - 1)) : 0;
			const isPlayingValue =
				savedState?.isPlaying !== undefined ? savedState.isPlaying : autoPlayRef.current && draftItem.frames > 1;
			const showExactSizeValue = savedState?.showExactSize !== undefined ? savedState.showExactSize : false;
			const showGridValue = savedState?.showGrid !== undefined ? savedState.showGrid : false;

			let outfitDataValue;
			if (savedState?.outfitData) {
				outfitDataValue = { ...savedState.outfitData };
				if (isOutfit && item) {
					const addonCount = Math.max(0, item.patternY - 1);
					if (!outfitDataValue.addons || outfitDataValue.addons.length !== addonCount) {
						outfitDataValue.addons = Array(addonCount).fill(false);
					} else {
						outfitDataValue.addons = outfitDataValue.addons.slice(0, addonCount);
					}
				}
			} else if (isOutfit && item) {
				const addonCount = Math.max(0, item.patternY - 1);
				outfitDataValue = {
					head: 0,
					body: 0,
					legs: 0,
					feet: 0,
					addons: Array(addonCount).fill(false)
				};
			} else {
				outfitDataValue = { head: 0, body: 0, legs: 0, feet: 0, addons: [false, false] };
			}

			setZoom(zoomValue);
			stateRefs.current.zoom = zoomValue;
			setPanX(panXValue);
			stateRefs.current.panX = panXValue;
			setPanY(panYValue);
			stateRefs.current.panY = panYValue;
			setPatternX(patternXValue);
			stateRefs.current.patternX = patternXValue;
			setPatternY(patternYValue);
			stateRefs.current.patternY = patternYValue;
			setPatternZ(patternZValue);
			stateRefs.current.patternZ = patternZValue;
			setCurrentFrame(currentFrameValue);
			stateRefs.current.currentFrame = currentFrameValue;
			setCurrentLayer(currentLayerValue);
			stateRefs.current.currentLayer = currentLayerValue;
			setIsPlaying(isPlayingValue);
			stateRefs.current.isPlaying = isPlayingValue;
			setShowExactSize(showExactSizeValue);
			stateRefs.current.showExactSize = showExactSizeValue;
			setShowGrid(showGridValue);
			stateRefs.current.showGrid = showGridValue;
			setOutfitData(outfitDataValue);
			stateRefs.current.outfitData = { ...outfitDataValue };

			previousItemRef.current = { id: openedItemId, category: openedItemCategory };
			hasLoadedStateRef.current = true;
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					isLoadingStateRef.current = false;
				});
			});
		} else {
			hasLoadedStateRef.current = false;
			isLoadingStateRef.current = false;
			previousItemRef.current = null;
		}
	}, [draftItem, openedItemId, openedItemCategory, isOutfit, item]);

	React.useEffect(() => {
		if (override) return;
		if (isLoadingStateRef.current) {
			return;
		}

		if (openedItemId && openedItemCategory && hasLoadedStateRef.current && draftItem) {
			if (
				previousItemRef.current &&
				previousItemRef.current.id === openedItemId &&
				previousItemRef.current.category === openedItemCategory
			) {
				const state: ItemPropertiesState = {
					zoom,
					panX,
					panY,
					patternX,
					patternY,
					patternZ,
					showGrid,
					isPlaying,
					currentFrame,
					currentLayer,
					showExactSize,
					outfitData: { ...outfitData }
				};
				saveItemState(openedItemCategory, openedItemId, state);
			}
		}
	}, [
		zoom,
		panX,
		panY,
		patternX,
		patternY,
		patternZ,
		currentFrame,
		currentLayer,
		isPlaying,
		showExactSize,
		showGrid,
		outfitData,
		openedItemId,
		openedItemCategory,
		draftItem
	]);

	React.useEffect(() => {
		if (override) return;
		if (!data || !item || !draftItem || !data.sprPath || !draftItem.spriteIndex) return;

		const spriteIds = Array.from(new Set(draftItem.spriteIndex.filter((id) => id > 0)));

		if (spriteIds.length === 0) return;

		const loadItemSprites = async () => {
			try {
				const { loadSpriteIds } = await import('~/lib/formats/tibia');
				await loadSpriteIds(data.sprPath!, spriteIds, data.transparency, data.sprites);
				notifySpritesLoaded();
			} catch (err) {
				console.error('Failed to load item sprites:', err);
			}
		};

		loadItemSprites();
	}, [data, item, draftItem, notifySpritesLoaded]);

	React.useEffect(() => {
		if (!override?.item) return;
		let init = { ...override.item };
		let initialGroup = 0;
		if (init.category === ThingCategory.OUTFIT && init.frameGroupsData && init.frameGroupsData.length > 0) {
			initialGroup = init.frameGroupsData.length > 1 ? 1 : 0;
			const g = init.frameGroupsData[initialGroup];
			init = {
				...init,
				width: g.width,
				height: g.height,
				frames: g.frames,
				layers: g.layers,
				patternX: g.patternX,
				patternY: g.patternY,
				patternZ: g.patternZ,
				exactSize: g.exactSize,
				spriteIndex: g.spriteIndex,
				isAnimation: g.isAnimation,
				loopCount: g.loopCount || 0,
				startFrame: g.startFrame || 0,
				animationMode: g.animationMode || 0,
				frameDurations: g.frameDurations || []
			};
		}
		setDraftItem(init);
		originalItemRef.current = { ...init };
		setSelectedFrameGroup(initialGroup);
		selectedFrameGroupRef.current = initialGroup;
		setHasChanges(false);

		const cat = override.item.category;
		setZoom(defaultZoomRef.current);
		setPanX(0);
		setPanY(0);
		setPatternX(
			cat === ThingCategory.OUTFIT ? Math.min(2, Math.max(0, init.patternX - 1)) : cat === ThingCategory.MISSILE ? 1 : 0
		);
		setPatternY(cat === ThingCategory.MISSILE ? 2 : 0);
		setPatternZ(0);
		setCurrentFrame(0);
		setCurrentLayer(0);
		setIsPlaying(init.frames > 1);
		setOutfitData({ head: 0, body: 0, legs: 0, feet: 0, addons: Array(Math.max(0, init.patternY - 1)).fill(false) });
	}, [override?.item]);

	const firstSpriteId = draftItem && draftItem.spriteIndex && draftItem.spriteIndex.length > 0 ? draftItem.spriteIndex[0] : 0;

	return {
		data,
		item,
		draftItem,
		visibility,
		outfitData,
		hasChanges,
		handleSave,
		handleClose,
		itemCategory,
		performClose,
		setOutfitData,
		showCloseConfirm,
		hasPropertyChanged,
		handleUndoProperty,
		handleResetSprites,
		setShowCloseConfirm,
		handleDiscardChanges,
		handlePropertyChange,
		handleRandomizeColors,
		frameGroups: {
			selectedFrameGroup,
			onSelectFrameGroup: handleFrameGroupChange,
			onCreateFrameGroup: handleCreateFrameGroup,
			onDeleteFrameGroup: handleDeleteFrameGroup
		},
		preview: {
			zoom,
			panX,
			panY,
			setPanX,
			setPanY,
			patternX,
			patternY,
			patternZ,
			showGrid,
			isPlaying,
			showScene,
			copyFlash,
			sceneSize,
			showSmooth,
			setPatternX,
			setPatternY,
			setShowGrid,
			currentFrame,
			currentLayer,
			setShowScene,
			isPanEnabled,
			handleZoomIn,
			setShowSmooth,
			showExactSize,
			firstSpriteId,
			handleZoomOut,
			handleResetPan,
			setIsPanEnabled,
			hoveredSpriteId,
			handlePatternUp,
			handlePrevFrame,
			handleNextFrame,
			handleLastFrame,
			handlePlayPause,
			setShowExactSize,
			handleCopySprite,
			handleFirstFrame,
			handleSpriteDrop,
			sceneScrollOffset,
			defaultSceneTiles,
			handlePatternDown,
			handlePatternLeft,
			handleSpriteHover,
			canvasContainerRef,
			handlePatternRight,
			showDirectionButtons,
			isMiddleMousePanning,
			setShowDirectionButtons,
			setIsMiddleMousePanning,
			handleSpriteDoubleClick,
			getSpriteOverride: override?.getSprite
		}
	};
};
