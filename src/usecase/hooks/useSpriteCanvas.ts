import type { ThingType } from '~/lib/formats/tibia';
import type { SceneTile } from '~/usecase/util/spriteLayoutUtils';

import React from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

import { blendOutfit } from '~/lib/formats/tibia/outfit';
import { useDragDrop } from '~/usecase/context/DragDropContext';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { computeSpriteLayout } from '~/usecase/util/spriteLayoutUtils';
import { getSpriteIndex, isValidSpriteId, importObjectSheet, getCategoryRenderConfig } from '~/lib/formats/tibia';

interface Slot {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface SpriteCanvasProps {
	panX?: number;
	panY?: number;
	fill?: boolean;
	width?: number;
	scale?: number;
	frame?: number;
	layer?: number;
	height?: number;
	smooth?: boolean;
	spriteId?: number;
	thing?: ThingType;
	patternX?: number;
	patternY?: number;
	patternZ?: number;
	className?: string;
	showGrid?: boolean;
	showEmpty?: boolean;
	sceneWidth?: number;
	spriteIds?: number[];
	sceneHeight?: number;
	isPanEnabled?: boolean;
	showExactSize?: boolean;
	allowFileDrop?: boolean;
	sceneScrollOffset?: number;
	sceneTiles?: null | SceneTile[][];
	renderMode?: 'list' | 'full' | 'preview';
	onPanChange?: (x: number, y: number) => void;
	onSpriteDoubleClick?: (spriteId: number) => void;
	onSpriteHover?: (spriteId: null | number) => void;
	onMiddleMousePanChange?: (isPanning: boolean) => void;
	onSpriteDrop?: (index: number, spriteId: number | number[]) => void;
	outfitData?: {
		head: number;
		body: number;
		legs: number;
		feet: number;
		addons: boolean[];
	};
}

export const useSpriteCanvas = (props: SpriteCanvasProps) => {
	const {
		thing,
		spriteId,
		panX = 0,
		panY = 0,
		spriteIds,
		width = 1,
		scale = 1,
		frame = 0,
		layer = 0,
		height = 1,
		outfitData,
		sceneTiles,
		onPanChange,
		fill = false,
		patternX = 0,
		patternY = 0,
		patternZ = 0,
		onSpriteDrop,
		onSpriteHover,
		className = '',
		sceneWidth = 0,
		smooth = false,
		sceneHeight = 0,
		showGrid = false,
		onSpriteDoubleClick,
		renderMode = 'full',
		isPanEnabled = false,
		showExactSize = false,
		sceneScrollOffset = 0,
		allowFileDrop = false,
		onMiddleMousePanChange
	} = props;

	const canvasRef = React.useRef<HTMLCanvasElement>(null);
	const containerRef = React.useRef<HTMLDivElement>(null);
	const {
		data,
		getSprite,
		isNewItem,
		spriteSize,
		formatConfig,
		spriteLoadVersion,
		notifyDataChanged,
		notifySpriteImport,
		notifySpritesLoaded
	} = useAssetData();
	const { dragType, isDragging, draggedItem } = useDragDrop();
	const [isLoading, setIsLoading] = React.useState(false);
	const [isPanning, setIsPanning] = React.useState(false);
	const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });

	const [highlightedSlot, setHighlightedSlot] = React.useState<null | Slot>(null);
	const [hoveredSlot, setHoveredSlot] = React.useState<null | Slot>(null);
	const [isFileDragging, setIsFileDragging] = React.useState(false);
	const [isFileDragOver, setIsFileDragOver] = React.useState(false);
	const currentHighlightRef = React.useRef<null | Slot>(null);

	const renderConfig = React.useMemo(
		() => (thing ? getCategoryRenderConfig(formatConfig, thing.category) : undefined),
		[thing, formatConfig]
	);

	const { canvasWidth, canvasHeight, spriteLayout } = React.useMemo(
		() =>
			computeSpriteLayout({
				thing,
				frame,
				width,
				height,
				patternX,
				patternY,
				patternZ,
				spriteId,
				spriteIds,
				renderMode,
				sceneTiles,
				sceneWidth,
				outfitData,
				spriteSize,
				sceneHeight,
				renderConfig
			}),
		[
			thing,
			frame,
			renderMode,
			spriteId,
			spriteIds,
			width,
			height,
			patternX,
			patternY,
			patternZ,
			layer,
			outfitData,
			sceneTiles,
			sceneWidth,
			sceneHeight,
			spriteLoadVersion
		]
	);

	const offscreenCanvasRef = React.useRef<null | HTMLCanvasElement>(null);

	const sceneCacheRef = React.useRef<{
		width: number;
		height: number;
		tiles: null | SceneTile[][];
		canvas: null | HTMLCanvasElement;
	}>({ width: 0, height: 0, tiles: null, canvas: null });

	React.useEffect(() => {
		if (!sceneTiles || !data || !data.sprPath || sceneWidth === 0 || sceneHeight === 0) return;

		const loadSceneSprites = async () => {
			const sceneSpriteIds = new Set<number>();

			for (let tileY = 0; tileY < sceneHeight; tileY++) {
				for (let tileX = 0; tileX < sceneWidth; tileX++) {
					const tile = sceneTiles[tileY]?.[tileX];
					if (!tile) continue;

					for (const sceneItem of tile.items) {
						const sceneThing = data.items.get(sceneItem.id);
						if (!sceneThing) continue;

						for (const sId of sceneThing.spriteIndex) {
							if (isValidSpriteId(sId)) {
								sceneSpriteIds.add(sId);
							}
						}
					}
				}
			}

			if (sceneSpriteIds.size === 0) return;

			const missingIds = Array.from(sceneSpriteIds).filter((id) => !data.sprites.has(id));
			if (missingIds.length === 0) return;

			const { loadSpriteIds } = await import('~/lib/formats/tibia');
			await loadSpriteIds(data.sprPath, missingIds, data.transparency, data.sprites);
			notifySpritesLoaded();
		};

		loadSceneSprites();
	}, [sceneTiles, sceneWidth, sceneHeight, data, notifySpritesLoaded]);

	React.useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		if (!offscreenCanvasRef.current) {
			offscreenCanvasRef.current = document.createElement('canvas');
			offscreenCanvasRef.current.width = spriteSize;
			offscreenCanvasRef.current.height = spriteSize;
		}
		const offscreenCtx = offscreenCanvasRef.current.getContext('2d');
		if (!offscreenCtx) return;

		ctx.imageSmoothingEnabled = smooth;
		if (smooth) {
			ctx.imageSmoothingQuality = 'high';
		}

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		if (sceneTiles && sceneWidth > 0 && sceneHeight > 0 && renderMode === 'preview' && renderConfig?.scenePreview) {
			const sceneCache = sceneCacheRef.current;
			const scenePixelWidth = sceneWidth * spriteSize;
			const scenePixelHeight = sceneHeight * spriteSize;

			const needsRebuild =
				!sceneCache.canvas ||
				sceneCache.tiles !== sceneTiles ||
				sceneCache.width !== sceneWidth ||
				sceneCache.height !== sceneHeight;

			if (needsRebuild) {
				if (!sceneCache.canvas) {
					sceneCache.canvas = document.createElement('canvas');
				}
				sceneCache.canvas.width = scenePixelWidth * 2;
				sceneCache.canvas.height = scenePixelHeight * 2;
				sceneCache.tiles = sceneTiles;
				sceneCache.width = sceneWidth;
				sceneCache.height = sceneHeight;

				const cacheCtx = sceneCache.canvas.getContext('2d');
				if (cacheCtx) {
					cacheCtx.clearRect(0, 0, sceneCache.canvas.width, sceneCache.canvas.height);

					for (let repeatY = 0; repeatY < 2; repeatY++) {
						for (let repeatX = 0; repeatX < 2; repeatX++) {
							const offsetX = repeatX * scenePixelWidth;
							const offsetY = repeatY * scenePixelHeight;

							for (let tileY = 0; tileY < sceneHeight; tileY++) {
								for (let tileX = 0; tileX < sceneWidth; tileX++) {
									const tile = sceneTiles[tileY]?.[tileX];
									if (!tile) continue;

									const drawBaseX = tileX * spriteSize + offsetX;
									const drawBaseY = tileY * spriteSize + offsetY;
									let elevation = 0;

									for (const sceneItem of tile.items) {
										const sceneThing = data?.items.get(sceneItem.id);
										if (!sceneThing) continue;

										const itemWidth = sceneThing.width || 1;
										const itemHeight = sceneThing.height || 1;

										for (let h = 0; h < itemHeight; h++) {
											for (let w = 0; w < itemWidth; w++) {
												const spriteIdx = (itemHeight - h - 1) * itemWidth + (itemWidth - w - 1);
												const sceneSpriteId = sceneThing.spriteIndex[spriteIdx];

												if (isValidSpriteId(sceneSpriteId)) {
													const sceneSprite = getSprite(sceneSpriteId);
													if (sceneSprite && !sceneSprite.isEmpty) {
														if (!sceneSprite.imageData) {
															const imageData = offscreenCtx.createImageData(spriteSize, spriteSize);
															imageData.data.set(sceneSprite.rgbaPixels);
															sceneSprite.imageData = imageData;
														}
														offscreenCtx.clearRect(0, 0, spriteSize, spriteSize);
														offscreenCtx.putImageData(sceneSprite.imageData, 0, 0);

														const drawX = drawBaseX - elevation - w * spriteSize;
														const drawY = drawBaseY - elevation - h * spriteSize;
														cacheCtx.drawImage(offscreenCanvasRef.current!, drawX, drawY);
													}
												}
											}
										}

										if (sceneThing.elevation && sceneThing.elevation > 0) {
											elevation += sceneThing.elevation;
										}
									}
								}
							}
						}
					}
				}
			}

			if (sceneCache.canvas) {
				let scrollX = 0;
				let scrollY = 0;

				switch (patternX) {
					case 0:
						scrollY = -(sceneScrollOffset % scenePixelHeight);
						break;
					case 1:
						scrollX = sceneScrollOffset % scenePixelWidth;
						break;
					case 2:
						scrollY = sceneScrollOffset % scenePixelHeight;
						break;
					case 3:
						scrollX = -(sceneScrollOffset % scenePixelWidth);
						break;
				}

				const sourceX = ((scrollX % scenePixelWidth) + scenePixelWidth) % scenePixelWidth;
				const sourceY = ((scrollY % scenePixelHeight) + scenePixelHeight) % scenePixelHeight;

				ctx.drawImage(sceneCache.canvas, sourceX, sourceY, canvasWidth, canvasHeight, 0, 0, canvasWidth, canvasHeight);
			}
		}

		if (spriteLayout.length === 0) {
			return;
		}

		let loadedSprites = 0;
		let missingSprites = 0;

		if (renderConfig?.layerCompositing && outfitData && thing && thing.layers === 2) {
			const spritesByPatternAndPos = new Map<number, Map<string, { x: number; y: number; layer0?: any; layer1?: any }>>();

			for (const { x: posX, y: posY, patternY: py, layer: spriteLayerIndex, spriteId: currentSpriteId } of spriteLayout) {
				const isValid = isValidSpriteId(currentSpriteId);
				if (!isValid) {
					loadedSprites++;
					continue;
				}

				const sprite = getSprite(currentSpriteId);
				if (!sprite) {
					missingSprites++;
					continue;
				}

				if (sprite.isEmpty) {
					loadedSprites++;
					continue;
				}

				loadedSprites++;

				if (!sprite.imageData) {
					const imageData = offscreenCtx.createImageData(spriteSize, spriteSize);
					imageData.data.set(sprite.rgbaPixels);
					sprite.imageData = imageData;
				}

				if (!spritesByPatternAndPos.has(py)) {
					spritesByPatternAndPos.set(py, new Map());
				}
				const patternGroup = spritesByPatternAndPos.get(py)!;
				const key = `${posX},${posY} `;

				if (!patternGroup.has(key)) {
					patternGroup.set(key, { x: posX, y: posY });
				}
				const entry = patternGroup.get(key)!;

				if (spriteLayerIndex === 0) {
					entry.layer0 = sprite;
				} else if (spriteLayerIndex === 1) {
					entry.layer1 = sprite;
				}
			}

			const sortedPatterns = Array.from(spritesByPatternAndPos.keys()).sort((a, b) => a - b);

			for (const py of sortedPatterns) {
				const patternGroup = spritesByPatternAndPos.get(py)!;

				for (const entry of patternGroup.values()) {
					offscreenCtx.clearRect(0, 0, spriteSize, spriteSize);
					let drawn = false;

					if (entry.layer0 && entry.layer1) {
						const colors = {
							head: Math.max(0, Math.min(255, Math.floor(outfitData.head || 0))),
							body: Math.max(0, Math.min(255, Math.floor(outfitData.body || 0))),
							legs: Math.max(0, Math.min(255, Math.floor(outfitData.legs || 0))),
							feet: Math.max(0, Math.min(255, Math.floor(outfitData.feet || 0)))
						};
						const blendedPixels = blendOutfit(entry.layer0.imageData.data, entry.layer1.imageData.data, colors);
						const blendedImageData = offscreenCtx.createImageData(spriteSize, spriteSize);
						blendedImageData.data.set(blendedPixels);
						offscreenCtx.putImageData(blendedImageData, 0, 0);
						drawn = true;
					} else if (entry.layer0) {
						offscreenCtx.putImageData(entry.layer0.imageData, 0, 0);
						drawn = true;
					} else if (entry.layer1) {
						offscreenCtx.putImageData(entry.layer1.imageData, 0, 0);
						drawn = true;
					}

					if (drawn) {
						ctx.drawImage(offscreenCanvasRef.current, entry.x, entry.y);
					}
				}
			}
		} else {
			for (const { x: posX, y: posY, spriteId: currentSpriteId } of spriteLayout) {
				const isValid = isValidSpriteId(currentSpriteId);

				if (!isValid) {
					loadedSprites++;
					continue;
				}

				const sprite = getSprite(currentSpriteId);

				if (!sprite) {
					missingSprites++;
					continue;
				}

				if (sprite.isEmpty) {
					loadedSprites++;
					continue;
				}

				loadedSprites++;

				if (!sprite.imageData) {
					const imageData = offscreenCtx.createImageData(spriteSize, spriteSize);
					imageData.data.set(sprite.rgbaPixels);
					sprite.imageData = imageData;
				}

				offscreenCtx.clearRect(0, 0, spriteSize, spriteSize);
				offscreenCtx.putImageData(sprite.imageData, 0, 0);
				ctx.drawImage(offscreenCanvasRef.current, posX, posY);
			}
		}

		setIsLoading(missingSprites > 0 && loadedSprites === 0 && spriteLayout.length > 0);

		if (showGrid) {
			ctx.strokeStyle = '#FF00FF';
			ctx.lineWidth = 1;
			ctx.beginPath();

			for (let x = 0; x <= canvasWidth; x += spriteSize) {
				ctx.moveTo(x, 0);
				ctx.lineTo(x, canvasHeight);
			}

			for (let y = 0; y <= canvasHeight; y += spriteSize) {
				ctx.moveTo(0, y);
				ctx.lineTo(canvasWidth, y);
			}

			ctx.stroke();
		}

		if (showExactSize && thing) {
			const exactSize = thing.exactSize || spriteSize;
			ctx.strokeStyle = '#00FF00';
			ctx.lineWidth = 1;

			let cols = 1;
			let rows = 1;

			if (renderMode === 'full') {
				cols = thing.patternX * thing.patternZ;
				rows = thing.patternY;
			}

			const pixelsWidth = thing.width * spriteSize;
			const pixelsHeight = thing.height * spriteSize;

			for (let r = 0; r < rows; r++) {
				for (let c = 0; c < cols; c++) {
					const cellX = c * pixelsWidth;
					const cellY = r * pixelsHeight;

					const x = cellX + pixelsWidth - exactSize;
					const y = cellY + pixelsHeight - exactSize;

					ctx.strokeRect(x + 0.5, y + 0.5, exactSize - 1, exactSize - 1);
				}
			}
		}
	}, [
		spriteLayout,
		spriteLoadVersion,
		canvasWidth,
		canvasHeight,
		data,
		showGrid,
		showExactSize,
		thing,
		outfitData,
		renderMode,
		sceneTiles,
		sceneWidth,
		sceneHeight,
		sceneScrollOffset,
		patternX,
		getSprite,
		smooth
	]);

	const exactSizeCenter = React.useMemo(() => {
		if (!thing) return null;

		const exactSize = thing.exactSize || spriteSize;
		const pixelsWidth = thing.width * spriteSize;
		const pixelsHeight = thing.height * spriteSize;

		let exactSizeCenterX = pixelsWidth - exactSize / 2;
		let exactSizeCenterY = pixelsHeight - exactSize / 2;

		if (sceneTiles && sceneWidth > 0 && sceneHeight > 0 && renderConfig?.scenePreview) {
			const centerTileX = Math.floor(sceneWidth / 2);
			const centerTileY = Math.floor(sceneHeight / 2);
			const offsetX = centerTileX * spriteSize - (thing.width - 1) * spriteSize;
			const offsetY = centerTileY * spriteSize - (thing.height - 1) * spriteSize;
			exactSizeCenterX += offsetX;
			exactSizeCenterY += offsetY;
		}

		return { x: exactSizeCenterX, y: exactSizeCenterY };
	}, [thing, sceneTiles, sceneWidth, sceneHeight]);

	const handleMouseDown = React.useCallback(
		(e: React.MouseEvent) => {
			if (!onPanChange) return;

			const isLeftButton = e.button === 0;
			const isMiddleButton = e.button === 1;

			let allowPanning = false;

			if (isMiddleButton) {
				allowPanning = true;
			} else if (isLeftButton && isPanEnabled) {
				allowPanning = true;
			}

			if (!allowPanning) return;

			setIsPanning(true);
			setPanStart({ x: e.clientX - panX, y: e.clientY - panY });

			if (isMiddleButton && onMiddleMousePanChange) {
				onMiddleMousePanChange(true);
			}

			e.preventDefault();
		},
		[onPanChange, isPanEnabled, panX, panY, onMiddleMousePanChange]
	);

	React.useEffect(() => {
		if (!isPanning || !onPanChange) return;

		const handleMouseMove = (e: MouseEvent) => {
			const newPanX = e.clientX - panStart.x;
			const newPanY = e.clientY - panStart.y;
			onPanChange(newPanX, newPanY);
		};

		const handleMouseUp = (e: MouseEvent) => {
			const wasMiddleButton = e.button === 1;
			setIsPanning(false);

			if (wasMiddleButton && onMiddleMousePanChange) {
				onMiddleMousePanChange(false);
			}
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);

		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
		};
	}, [isPanning, panStart, onPanChange, panX, panY, onMiddleMousePanChange]);

	React.useEffect(() => {
		if (!isDragging || (dragType !== 'sprite' && dragType !== 'sprites') || !thing || !canvasRef.current || !onSpriteDrop) return;

		const handleGlobalMouseMove = (e: MouseEvent) => {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();

			if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
				const relX = e.clientX - rect.left;
				const relY = e.clientY - rect.top;

				const canvasX = relX * (canvasWidth / rect.width);
				const canvasY = relY * (canvasHeight / rect.height);

				const pixelsWidth = thing.width * spriteSize;
				const pixelsHeight = thing.height * spriteSize;

				const col = Math.floor(canvasX / pixelsWidth);
				const row = Math.floor(canvasY / pixelsHeight);

				const cellX = canvasX % pixelsWidth;
				const cellY = canvasY % pixelsHeight;

				const slotX = Math.floor(cellX / spriteSize) * spriteSize;
				const slotY = Math.floor(cellY / spriteSize) * spriteSize;

				const highlightX = col * pixelsWidth + slotX;
				const highlightY = row * pixelsHeight + slotY;

				const newHighlight = {
					x: highlightX,
					y: highlightY,
					w: spriteSize,
					h: spriteSize
				};

				currentHighlightRef.current = newHighlight;
				setHighlightedSlot(newHighlight);
			} else {
				currentHighlightRef.current = null;
				setHighlightedSlot(null);
			}
		};

		const handleGlobalMouseUp = () => {
			if (currentHighlightRef.current) {
				const pixelsWidth = thing.width * spriteSize;
				const pixelsHeight = thing.height * spriteSize;

				const col = Math.floor(currentHighlightRef.current.x / pixelsWidth);
				const row = Math.floor(currentHighlightRef.current.y / pixelsHeight);

				const cellX = currentHighlightRef.current.x % pixelsWidth;
				const cellY = currentHighlightRef.current.y % pixelsHeight;

				const w = thing.width - 1 - Math.floor(cellX / spriteSize);
				const h = thing.height - 1 - Math.floor(cellY / spriteSize);

				const pY = row;
				const pZ = Math.floor(col / thing.patternX);
				const pX = col % thing.patternX;

				const currentFrame = thing.frames > 1 ? frame : 0;
				const targetLayer = layer || 0;

				const index = getSpriteIndex(thing, w, h, targetLayer, pX, pY, pZ, currentFrame);

				if (index >= 0 && index < thing.spriteIndex.length) {
					onSpriteDrop(index, draggedItem);
				}
			}
			setHighlightedSlot(null);
			currentHighlightRef.current = null;
		};

		window.addEventListener('mousemove', handleGlobalMouseMove);
		window.addEventListener('mouseup', handleGlobalMouseUp);

		return () => {
			window.removeEventListener('mousemove', handleGlobalMouseMove);
			window.removeEventListener('mouseup', handleGlobalMouseUp);
			setHighlightedSlot(null);
		};
	}, [isDragging, dragType, draggedItem, thing, canvasWidth, canvasHeight, onSpriteDrop, frame, layer]);

	const isDraggingImageRef = React.useRef(false);

	React.useEffect(() => {
		const containerElement = containerRef.current;
		if (!containerElement || !allowFileDrop) return;

		const isImagePath = (p: string) => /\.(png|bmp|jpg|jpeg)$/i.test(p);
		const overContainer = (x: number, y: number) => {
			const r = containerElement.getBoundingClientRect();
			const dpr = window.devicePixelRatio || 1;
			const cx = x / dpr;
			const cy = y / dpr;
			return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
		};

		let unlisten: undefined | (() => void);
		let cancelled = false;

		getCurrentWebviewWindow()
			.onDragDropEvent(async (event) => {
				const p = event.payload;
				if (p.type === 'enter') {
					isDraggingImageRef.current = p.paths.some(isImagePath);
					if (!isDraggingImageRef.current) return;
					setIsFileDragging(true);
					setIsFileDragOver(overContainer(p.position.x, p.position.y));
				} else if (p.type === 'over') {
					if (!isDraggingImageRef.current) return;
					setIsFileDragOver(overContainer(p.position.x, p.position.y));
				} else if (p.type === 'leave') {
					isDraggingImageRef.current = false;
					setIsFileDragging(false);
					setIsFileDragOver(false);
				} else if (p.type === 'drop') {
					const wasImage = isDraggingImageRef.current;
					const onTarget = overContainer(p.position.x, p.position.y);
					isDraggingImageRef.current = false;
					setIsFileDragging(false);
					setIsFileDragOver(false);
					if (!wasImage || !onTarget || !thing || !data) return;

					const imagePath = p.paths.find(isImagePath);
					if (!imagePath) return;

					const result = await importObjectSheet(thing, data, imagePath, { isNew: isNewItem(thing.id, thing.category) });
					if (result.success && result.updatedThing) {
						notifySpritesLoaded();
						if (notifyDataChanged && result.spriteIds) {
							notifyDataChanged(result.spriteIds);
						}
						notifySpriteImport();
					} else if (result.error) {
						console.error('Sheet import rejected:', result.error);
					}
				}
			})
			.then((fn) => {
				if (cancelled) fn();
				else unlisten = fn;
			});

		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, [thing, data, allowFileDrop, isNewItem, notifySpritesLoaded, notifyDataChanged, notifySpriteImport]);

	const transformStyle = React.useMemo(() => {
		const baseStyle = {
			maxWidth: '100%',
			maxHeight: '100%',
			objectFit: 'contain' as const,
			imageRendering: 'pixelated' as const
		};

		if (renderMode === 'list') {
			if (fill) {
				return { ...baseStyle, width: '100%', height: '100%', transform: 'none', boxSizing: 'border-box' as const };
			}

			const renderedWidth = canvasWidth * scale;
			const renderedHeight = canvasHeight * scale;

			return {
				...baseStyle,
				transform: 'none',
				width: `${renderedWidth}px`,
				height: `${renderedHeight}px`,
				boxSizing: 'border-box' as const
			};
		}

		if (renderMode === 'preview' && exactSizeCenter) {
			const canvasCenterX = canvasWidth / 2;
			const canvasCenterY = canvasHeight / 2;

			const offsetX = canvasCenterX - exactSizeCenter.x;
			const offsetY = canvasCenterY - exactSizeCenter.y;

			return {
				width: `${canvasWidth}px`,
				height: `${canvasHeight}px`,
				imageRendering: 'pixelated' as const,
				transformOrigin: `${exactSizeCenter.x}px ${exactSizeCenter.y}px`,
				transform: `translate(${panX}px, ${panY}px) translate(${offsetX}px, ${offsetY}px) scale(${scale})`
			};
		}

		return {
			...baseStyle,
			width: `${canvasWidth}px`,
			height: `${canvasHeight}px`,
			transformOrigin: 'center center',
			transform: `translate(${panX}px, ${panY}px) scale(${scale})`
		};
	}, [canvasWidth, canvasHeight, scale, exactSizeCenter, panX, panY, renderMode, fill]);

	const handleMouseDoubleClick = React.useCallback(
		(e: React.MouseEvent) => {
			if (!onSpriteDoubleClick || !thing) return;

			const rect = (e.target as HTMLElement).getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			const canvasX = x * (canvasWidth / rect.width);
			const canvasY = y * (canvasHeight / rect.height);

			const clickedSprite = spriteLayout.find((s) => {
				return canvasX >= s.x && canvasX < s.x + spriteSize && canvasY >= s.y && canvasY < s.y + spriteSize;
			});

			if (clickedSprite) {
				onSpriteDoubleClick(clickedSprite.spriteId);
			}
		},
		[onSpriteDoubleClick, thing, spriteLayout, canvasWidth, canvasHeight]
	);

	const handleMouseMove = React.useCallback(
		(e: React.MouseEvent) => {
			if (isDragging) return;
			if (!onSpriteHover || !thing) return;

			const rect = (e.target as HTMLElement).getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			const canvasX = x * (canvasWidth / rect.width);
			const canvasY = y * (canvasHeight / rect.height);

			const hoveredSprite = spriteLayout.find((s) => {
				return canvasX >= s.x && canvasX < s.x + spriteSize && canvasY >= s.y && canvasY < s.y + spriteSize;
			});

			if (hoveredSprite) {
				onSpriteHover(hoveredSprite.spriteId);
				setHoveredSlot({
					w: spriteSize,
					h: spriteSize,
					x: hoveredSprite.x,
					y: hoveredSprite.y
				});
			} else {
				onSpriteHover(null);
				setHoveredSlot(null);
			}
		},
		[onSpriteHover, thing, spriteLayout, canvasWidth, canvasHeight]
	);

	const handleMouseLeave = React.useCallback(() => {
		if (onSpriteHover) {
			onSpriteHover(null);
		}
		setHoveredSlot(null);
	}, [onSpriteHover]);

	const overlayCanvasRef = React.useRef<HTMLCanvasElement>(null);

	React.useEffect(() => {
		const canvas = overlayCanvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		if (hoveredSlot) {
			ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
			ctx.fillRect(hoveredSlot.x, hoveredSlot.y, hoveredSlot.w, hoveredSlot.h);
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
			ctx.lineWidth = 1;
			ctx.strokeRect(hoveredSlot.x, hoveredSlot.y, hoveredSlot.w, hoveredSlot.h);
		}

		if (highlightedSlot) {
			ctx.fillStyle = 'rgba(250, 204, 21, 0.3)';
			ctx.strokeStyle = '#facc15';
			ctx.lineWidth = 2;

			ctx.fillRect(highlightedSlot.x, highlightedSlot.y, highlightedSlot.w, highlightedSlot.h);
			ctx.strokeRect(highlightedSlot.x, highlightedSlot.y, highlightedSlot.w, highlightedSlot.h);
		}
	}, [highlightedSlot, hoveredSlot, canvasWidth, canvasHeight]);

	return {
		scale,
		smooth,
		className,
		canvasRef,
		isLoading,
		isPanning,
		renderMode,
		onPanChange,
		canvasWidth,
		isPanEnabled,
		containerRef,
		canvasHeight,
		allowFileDrop,
		transformStyle,
		isFileDragging,
		isFileDragOver,
		handleMouseDown,
		handleMouseMove,
		overlayCanvasRef,
		handleMouseLeave,
		handleMouseDoubleClick
	};
};
