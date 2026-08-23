import type { AssetData } from './types';
import type { RemovedReason, RemovedSprite, OptimizeResult } from '~/lib/formats/registry';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { iterAllThings } from './types';

const REASONS: RemovedReason[] = ['empty', 'duplicate', 'unused'];

export async function optimizeSprites(
	data: AssetData,
	onProgress?: (message: string, current: number, total: number) => void
): Promise<OptimizeResult> {
	const steps = 4;
	let currentStep = 0;

	if (onProgress) onProgress('Scanning for used sprites...', currentStep++, steps);

	const usedIds = new Set<number>();

	const scanThingSprites = (thing: ThingType) => {
		if (thing.spriteIndex) {
			for (const id of thing.spriteIndex) usedIds.add(id);
		}
		if (thing.frameGroupsData) {
			for (const group of thing.frameGroupsData) {
				if (group.spriteIndex) {
					for (const id of group.spriteIndex) usedIds.add(id);
				}
			}
		}
	};

	for (const thing of iterAllThings(data)) scanThingSprites(thing);

	if (onProgress) onProgress('Optimizing in backend...', currentStep++, steps);

	if (!data.sprPath) {
		throw new Error('No SPR file path available');
	}

	const usedIdsArray = new Uint8Array(usedIds.size * 4);
	const view = new DataView(usedIdsArray.buffer);
	let offset = 0;
	for (const id of usedIds) {
		view.setUint32(offset, id, true);
		offset += 4;
	}

	const unlisten = await listen<string>('optimizer-progress', (event) => {
		if (onProgress) onProgress(event.payload, currentStep, steps);
	});

	try {
		const pathBytes = new TextEncoder().encode(data.sprPath);
		const argsBuf = new Uint8Array(1 + 2 + pathBytes.length + usedIdsArray.length);
		const argsView = new DataView(argsBuf.buffer);
		argsView.setUint8(0, data.extended ? 1 : 0);
		argsView.setUint16(1, pathBytes.length, true);
		argsBuf.set(pathBytes, 3);
		argsBuf.set(usedIdsArray, 3 + pathBytes.length);

		const response = await invoke<ArrayBuffer>('optimize_sprites_rust', argsBuf);

		unlisten();

		const resultBytes = response instanceof Uint8Array ? response : new Uint8Array(response);
		const rv = new DataView(resultBytes.buffer, resultBytes.byteOffset, resultBytes.byteLength);
		let ro = 0;
		const oldTotal = rv.getUint32(ro, true);
		ro += 4;
		const newTotal = rv.getUint32(ro, true);
		ro += 4;
		const removedCount = rv.getUint32(ro, true);
		ro += 4;
		const duplicateCount = rv.getUint32(ro, true);
		ro += 4;
		const unusedCount = rv.getUint32(ro, true);
		ro += 4;
		const emptyCount = rv.getUint32(ro, true);
		ro += 4;
		const pathLen = rv.getUint16(ro, true);
		ro += 2;
		const tempPath = new TextDecoder().decode(resultBytes.subarray(ro, ro + pathLen));
		ro += pathLen;
		const remapLen = rv.getUint32(ro, true);
		ro += 4;
		const remapBytes = resultBytes.subarray(ro, ro + remapLen);
		ro += remapLen;
		const removedBytes = resultBytes.subarray(ro);

		const removed: RemovedSprite[] = [];
		const removedView = new DataView(removedBytes.buffer, removedBytes.byteOffset, removedBytes.byteLength);
		for (let i = 0; i + 9 <= removedBytes.length; i += 9) {
			const id = removedView.getUint32(i, true);
			const duplicateOf = removedView.getUint32(i + 4, true);
			const reason = REASONS[removedView.getUint8(i + 8)] ?? 'unused';
			removed.push(duplicateOf > 0 ? { id, reason, duplicateOf } : { id, reason });
		}

		if (onProgress) onProgress('Updating object references...', currentStep++, steps);

		const remap = new Map<number, number>();
		const remapView = new DataView(remapBytes.buffer, remapBytes.byteOffset, remapBytes.byteLength);
		for (let i = 0; i < remapBytes.length; i += 8) {
			const oldId = remapView.getUint32(i, true);
			const newId = remapView.getUint32(i + 4, true);
			remap.set(oldId, newId);
		}

		const remapThingSprites = (thing: ThingType) => {
			if (thing.spriteIndex) {
				for (let i = 0; i < thing.spriteIndex.length; i++) {
					const oldId = thing.spriteIndex[i];
					if (remap.has(oldId)) {
						thing.spriteIndex[i] = remap.get(oldId)!;
					}
				}
			}

			if (thing.frameGroupsData) {
				for (const group of thing.frameGroupsData) {
					if (group.spriteIndex) {
						for (let i = 0; i < group.spriteIndex.length; i++) {
							const oldId = group.spriteIndex[i];
							if (remap.has(oldId)) {
								group.spriteIndex[i] = remap.get(oldId)!;
							}
						}
					}
				}
			}
		};

		for (const thing of iterAllThings(data)) remapThingSprites(thing);

		if (onProgress) onProgress('Reloading sprites...', currentStep++, steps);

		await invoke('open_spr_file', {
			path: tempPath,
			extended: data.extended
		});

		data.sprites.clear();

		await loadSpriteIds(
			tempPath,
			Array.from({ length: Math.min(100, newTotal) }, (_, i) => i + 1),
			data.transparency,
			data.sprites
		);

		if (onProgress) onProgress('Optimization complete', steps, steps);

		return {
			removed,
			oldTotal,
			newTotal,
			tempPath,
			removedCount,
			previewPath: data.sprPath,
			removedByReason: { empty: emptyCount, unused: unusedCount, duplicate: duplicateCount }
		};
	} catch (error) {
		unlisten();
		throw error;
	}
}
