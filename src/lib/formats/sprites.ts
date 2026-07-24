import type { OptimizeResult } from './registry';

import { getFormat } from './registry';
import { type AssetData } from './tibia/types';

const handlerOf = (data: AssetData) => getFormat(data.formatId ?? 'tibia');

export async function loadSprites(data: AssetData, ids: number[]): Promise<void> {
	const h = handlerOf(data);
	if (!h?.loadSprites) return;
	await h.loadSprites(data, ids);
}

export async function loadSpritesLz4(data: AssetData, ids: number[]): Promise<void> {
	const h = handlerOf(data);
	if (!h) return;
	if (h.loadSpritesLz4) return h.loadSpritesLz4(data, ids);
	if (h.loadSprites) return h.loadSprites(data, ids);
}

export async function optimizeSprites(
	data: AssetData,
	onProgress?: (m: string, c: number, t: number) => void
): Promise<OptimizeResult> {
	const h = handlerOf(data);
	if (!h?.optimize) throw new Error(`format '${data.formatId ?? 'tibia'}' has no optimizer`);
	return h.optimize(data, onProgress);
}
