import type { ThingType, AssetData } from './types';

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import { log } from '~/lib/log';
import { getCategoryMap } from './types';
import { parseImportResponse } from './loader';
import { ByteWriter, encodeThing } from './compiler';

export interface ImportResult {
	error?: string;
	success: boolean;
	spriteIds?: number[];
	updatedThing?: ThingType;
}

export interface ImportOptions {
	isNew?: boolean;
}

export async function importObjectSheet(
	thing: ThingType,
	data: AssetData,
	file?: File | string,
	options?: ImportOptions
): Promise<ImportResult> {
	if (!data?.sprPath) return { success: false };

	let imageBytes: Uint8Array;

	try {
		if (file instanceof File) {
			imageBytes = new Uint8Array(await file.arrayBuffer());
		} else if (typeof file === 'string') {
			const result = await invoke<Uint8Array>('read_file', { path: file });
			imageBytes = result instanceof Uint8Array ? result : new Uint8Array(result as ArrayLike<number>);
		} else {
			const selected = await open({
				multiple: false,
				filters: [{ name: 'Image', extensions: ['png', 'bmp', 'jpg', 'jpeg'] }]
			});
			if (!selected || typeof selected !== 'string') {
				return { success: false };
			}
			const result = await invoke<Uint8Array>('read_file', { path: selected });
			imageBytes = result instanceof Uint8Array ? result : new Uint8Array(result as ArrayLike<number>);
		}
	} catch (e) {
		log.error('Failed to read image file', e);
		return { success: false };
	}

	let nextId = data.spritesCount + 1;
	for (const id of data.sprites.keys()) {
		if (id >= nextId) nextId = id + 1;
	}

	console.log('Importing sprite sheet...', {
		thingId: thing.id,
		nextSpriteId: nextId,
		category: thing.category,
		imageSize: imageBytes.length
	});

	try {
		const w = new ByteWriter(imageBytes.length + 8192);
		w.bool(data.transparency);
		w.u32(data.version.value);
		w.u32(nextId);
		w.bool(options?.isNew ?? false);
		w.str(data.sprPath);
		w.str(thing.category);
		encodeThing(w, thing);
		w.bytes(imageBytes);

		const response = await invoke<ArrayBuffer>('import_object_sheet_binary', w.finish());

		const buffer = response instanceof Uint8Array ? response : new Uint8Array(response);

		const { sprites, updatedThing } = parseImportResponse(buffer, data.transparency);

		console.log('Import parsed:', {
			thingId: updatedThing.id,
			width: updatedThing.width,
			spriteCount: sprites.length,
			frames: updatedThing.frames,
			layers: updatedThing.layers,
			height: updatedThing.height,
			patternX: updatedThing.patternX,
			patternY: updatedThing.patternY,
			patternZ: updatedThing.patternZ,
			spriteIds: sprites.slice(0, 5).map((s) => s.id),
			spriteIndexLength: updatedThing.spriteIndex?.length,
			spriteIndexFirst20: updatedThing.spriteIndex?.slice(0, 20)
		});

		let maxSpriteId = data.spritesCount;
		for (const sprite of sprites) {
			data.sprites.set(sprite.id, sprite);
			if (sprite.id > maxSpriteId) {
				maxSpriteId = sprite.id;
			}
		}

		if (maxSpriteId > data.spritesCount) {
			data.spritesCount = maxSpriteId;
		}

		const categoryMap = getCategoryMap(data, updatedThing.category);

		if (categoryMap.has(thing.id)) {
			categoryMap.set(thing.id, updatedThing);
		}

		Object.assign(thing, updatedThing);

		const spriteIds = sprites.map((s) => s.id);

		log.info(`Imported ${spriteIds.length} sprite(s) into ${updatedThing.category} ${updatedThing.id}`);
		return { spriteIds, updatedThing, success: true };
	} catch (err) {
		log.error('Import failed', err);
		const message = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);
		return { success: false, error: message };
	}
}
