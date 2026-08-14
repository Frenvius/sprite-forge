import type { Sprite } from '~/lib/formats/tibia';

import { SPRITE_SIZE } from '~/lib/formats/tibia';

export interface SheetTiles {
	cols: number;
	rows: number;
	tile: number;
	width: number;
	count: number;
	height: number;
	canvas: HTMLCanvasElement;
	isBlank: (index: number) => boolean;
	getTile: (index: number) => Sprite | undefined;
}

export const decodeSheet = async (bytes: Uint8Array): Promise<HTMLCanvasElement> => {
	const blob = new Blob([bytes]);
	const bitmap = await createImageBitmap(blob);
	const canvas = document.createElement('canvas');
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('Failed to create sheet canvas context');
	ctx.drawImage(bitmap, 0, 0);
	bitmap.close();
	return canvas;
};

export const createSheetTiles = (canvas: HTMLCanvasElement, tile = SPRITE_SIZE): SheetTiles => {
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	const cols = Math.max(1, Math.ceil(canvas.width / tile));
	const rows = Math.max(1, Math.ceil(canvas.height / tile));
	const cache = new Map<number, Sprite>();
	const blanks = new Map<number, boolean>();

	const build = (index: number): Sprite | undefined => {
		if (!ctx || index < 0 || index >= cols * rows) return undefined;
		const sx = (index % cols) * tile;
		const sy = Math.floor(index / cols) * tile;
		const rgbaPixels = new Uint8Array(tile * tile * 4);
		const source = ctx.getImageData(sx, sy, tile, tile);
		rgbaPixels.set(source.data);

		let empty = true;
		for (let i = 3; i < rgbaPixels.length; i += 4) {
			if (rgbaPixels[i] !== 0) {
				empty = false;
				break;
			}
		}

		blanks.set(index, empty);
		return { rgbaPixels, id: index + 1, isEmpty: empty, transparent: true };
	};

	const getTile = (index: number): Sprite | undefined => {
		const cached = cache.get(index);
		if (cached) return cached;
		const sprite = build(index);
		if (sprite) cache.set(index, sprite);
		return sprite;
	};

	return {
		cols,
		rows,
		tile,
		canvas,
		getTile,
		count: cols * rows,
		width: canvas.width,
		height: canvas.height,
		isBlank: (index: number) => {
			const known = blanks.get(index);
			if (known !== undefined) return known;
			return getTile(index)?.isEmpty ?? true;
		}
	};
};
