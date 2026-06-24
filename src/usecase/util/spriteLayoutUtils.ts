import type { OutfitData } from '~/usecase/context/PropertiesContext/types';

import { getSpriteIndex, type ThingType, type CategoryRenderConfig } from '~/lib/formats/tibia';

export interface SceneItem {
	id: number;
	count?: number;
}

export interface SceneTile {
	items: SceneItem[];
}

export interface SpriteLayoutItem {
	x: number;
	y: number;
	layer: number;
	spriteId: number;
	patternY: number;
}

interface ComputeLayoutParams {
	frame: number;
	width: number;
	height: number;
	patternX: number;
	patternY: number;
	patternZ: number;
	thing?: ThingType;
	spriteId?: number;
	sceneWidth: number;
	spriteSize: number;
	sceneHeight: number;
	spriteIds?: number[];
	outfitData?: OutfitData;
	sceneTiles?: null | SceneTile[][];
	renderConfig?: CategoryRenderConfig;
	renderMode: 'list' | 'full' | 'preview';
}

interface LayoutResult {
	canvasWidth: number;
	canvasHeight: number;
	spriteLayout: SpriteLayoutItem[];
}

export const computeSpriteLayout = (params: ComputeLayoutParams): LayoutResult => {
	const {
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
	} = params;

	let canvasW: number;
	let canvasH: number;
	const layout: SpriteLayoutItem[] = [];

	if (renderMode === 'list' && thing) {
		canvasW = thing.width * spriteSize;
		canvasH = spriteSize;

		const clamp = renderConfig?.listPatternXClamp;
		const defaultPatternX = clamp && thing.patternX > clamp ? clamp : 0;

		const layerCount = renderConfig?.listLayerCount ?? thing.layers;

		for (let l = 0; l < layerCount; l++) {
			for (let w = 0; w < thing.width; w++) {
				const index = getSpriteIndex(thing, w, 0, l, defaultPatternX, 0, 0, 0);
				if (index < thing.spriteIndex.length) {
					const posX = (thing.width - w - 1) * spriteSize;
					layout.push({
						y: 0,
						x: posX,
						layer: l,
						patternY: 0,
						spriteId: thing.spriteIndex[index]
					});
				}
			}
		}
	} else if (renderMode === 'preview' && thing) {
		if (sceneTiles && sceneWidth > 0 && sceneHeight > 0 && renderConfig?.scenePreview) {
			canvasW = sceneWidth * spriteSize;
			canvasH = sceneHeight * spriteSize;
		} else {
			canvasW = thing.width * spriteSize;
			canvasH = thing.height * spriteSize;
		}

		const currentFrame = thing.frames > 1 ? frame : 0;

		const patternYsToRender: number[] = [];

		if (renderConfig?.addonSlots && outfitData) {
			patternYsToRender.push(0);
			if (thing.patternY > 1 && outfitData.addons) {
				for (let i = 0; i < outfitData.addons.length && i < thing.patternY - 1; i++) {
					if (outfitData.addons[i]) {
						patternYsToRender.push(i + 1);
					}
				}
			}
		} else {
			patternYsToRender.push(patternY);
		}

		let offsetX = 0;
		let offsetY = 0;
		if (sceneTiles && sceneWidth > 0 && sceneHeight > 0 && renderConfig?.scenePreview) {
			const centerTileX = Math.floor(sceneWidth / 2);
			const centerTileY = Math.floor(sceneHeight / 2);
			offsetX = centerTileX * spriteSize - (thing.width - 1) * spriteSize;
			offsetY = centerTileY * spriteSize - (thing.height - 1) * spriteSize;
		}

		for (const py of patternYsToRender) {
			for (let l = 0; l < thing.layers; l++) {
				for (let h = 0; h < thing.height; h++) {
					for (let w = 0; w < thing.width; w++) {
						const index = getSpriteIndex(thing, w, h, l, patternX, py, patternZ, currentFrame);
						if (index < thing.spriteIndex.length) {
							const posX = (thing.width - w - 1) * spriteSize + offsetX;
							const posY = (thing.height - h - 1) * spriteSize + offsetY;
							layout.push({
								x: posX,
								y: posY,
								layer: l,
								patternY: py,
								spriteId: thing.spriteIndex[index]
							});
						}
					}
				}
			}
		}
	} else if (renderMode === 'full' && thing) {
		const cols = thing.patternX * thing.patternZ;
		const rows = thing.patternY;

		canvasW = cols * thing.width * spriteSize;
		canvasH = rows * thing.height * spriteSize;

		const pixelsWidth = thing.width * spriteSize;
		const pixelsHeight = thing.height * spriteSize;

		const currentFrame = thing.frames > 1 ? frame : 0;

		for (let z = 0; z < thing.patternZ; z++) {
			for (let y = 0; y < thing.patternY; y++) {
				for (let x = 0; x < thing.patternX; x++) {
					const col = x + z * thing.patternX;
					const row = y;

					const fx = col * pixelsWidth;
					const fy = row * pixelsHeight;

					for (let l = 0; l < thing.layers; l++) {
						for (let h = 0; h < thing.height; h++) {
							for (let w = 0; w < thing.width; w++) {
								const spriteIndex = getSpriteIndex(thing, w, h, l, x, y, z, currentFrame);

								if (spriteIndex < thing.spriteIndex.length) {
									const px = (thing.width - w - 1) * spriteSize;
									const py = (thing.height - h - 1) * spriteSize;
									const sId = thing.spriteIndex[spriteIndex];

									layout.push({
										layer: l,
										x: px + fx,
										y: py + fy,
										patternY: y,
										spriteId: sId
									});
								}
							}
						}
					}
				}
			}
		}
	} else {
		const spritesToRender = spriteIds || (spriteId !== undefined ? [spriteId] : []);
		canvasW = width * spriteSize;
		canvasH = height * spriteSize;

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const index = y * width + x;
				if (index < spritesToRender.length) {
					const posX = (width - x - 1) * spriteSize;
					const posY = (height - y - 1) * spriteSize;
					layout.push({
						x: posX,
						y: posY,
						layer: 0,
						patternY: 0,
						spriteId: spritesToRender[index]
					});
				}
			}
		}
	}

	return { canvasWidth: canvasW, spriteLayout: layout, canvasHeight: canvasH };
};
