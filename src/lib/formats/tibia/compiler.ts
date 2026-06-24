import type { Sprite, AssetData, ThingType, FrameDuration } from './types';

import { invoke } from '@tauri-apps/api/core';

import { writeOtfiFile } from './loader';
import { createCommit, readOnDiskSprites } from '../../versionControl';
import { ThingCategory, getCategoryStartId, TIBIA_FORMAT_CONFIG } from './types';

export class ByteWriter {
	private buf: Uint8Array;
	private view: DataView;
	private len = 0;

	constructor(initialCapacity = 1 << 20) {
		this.buf = new Uint8Array(initialCapacity);
		this.view = new DataView(this.buf.buffer);
	}

	private ensure(extra: number): void {
		if (this.len + extra <= this.buf.length) return;
		let cap = this.buf.length;
		while (cap < this.len + extra) cap *= 2;
		const grown = new Uint8Array(cap);
		grown.set(this.buf.subarray(0, this.len));
		this.buf = grown;
		this.view = new DataView(this.buf.buffer);
	}

	u8(v: number): void {
		this.ensure(1);
		this.view.setUint8(this.len, v & 0xff);
		this.len += 1;
	}

	i8(v: number): void {
		this.ensure(1);
		this.view.setInt8(this.len, v);
		this.len += 1;
	}

	bool(v: boolean): void {
		this.u8(v ? 1 : 0);
	}

	u16(v: number): void {
		this.ensure(2);
		this.view.setUint16(this.len, v & 0xffff, true);
		this.len += 2;
	}

	i16(v: number): void {
		this.ensure(2);
		this.view.setInt16(this.len, v, true);
		this.len += 2;
	}

	u32(v: number): void {
		this.ensure(4);
		this.view.setUint32(this.len, v >>> 0, true);
		this.len += 4;
	}

	i32(v: number): void {
		this.ensure(4);
		this.view.setInt32(this.len, v, true);
		this.len += 4;
	}

	str(s: string): void {
		const bytes = new TextEncoder().encode(s ?? '');
		this.u16(bytes.length);
		this.ensure(bytes.length);
		this.buf.set(bytes, this.len);
		this.len += bytes.length;
	}

	bytes(data: Uint8Array): void {
		this.ensure(data.length);
		this.buf.set(data, this.len);
		this.len += data.length;
	}

	u32Array(arr: number[]): void {
		this.u32(arr.length);
		for (const v of arr) this.u32(v);
	}

	i16ArrayU8Len(arr: number[]): void {
		this.u8(arr.length);
		for (const v of arr) this.i16(v);
	}

	frameDurations(arr?: FrameDuration[]): void {
		const list = arr ?? [];
		this.u16(list.length);
		for (const d of list) {
			this.u32(d.minimum);
			this.u32(d.maximum);
		}
	}

	finish(): Uint8Array {
		return this.buf.slice(0, this.len);
	}
}

export function encodeThing(w: ByteWriter, t: ThingType): void {
	w.u32(t.id);
	w.u8(t.width);
	w.u8(t.height);
	w.u8(t.exactSize);
	w.u8(t.layers);
	w.u8(t.patternX);
	w.u8(t.patternY);
	w.u8(t.patternZ);
	w.u8(t.frames);

	w.bool(t.isGround);
	w.bool(t.isGroundBorder);
	w.bool(t.isOnBottom);
	w.bool(t.isOnTop);
	w.bool(t.isContainer);
	w.bool(t.stackable);
	w.bool(t.multiUse);
	w.bool(t.forceUse);
	w.bool(t.hasCharges);
	w.bool(t.writable);
	w.bool(t.writableOnce);
	w.bool(t.isFluidContainer);
	w.bool(t.isFluid);
	w.bool(t.isUnpassable);
	w.bool(t.isUnmoveable);
	w.bool(t.blockMissile);
	w.bool(t.blockPathfind);
	w.bool(t.noMoveAnimation);
	w.bool(t.pickupable);
	w.bool(t.hangable);
	w.bool(t.isVertical);
	w.bool(t.isHorizontal);
	w.bool(t.rotatable);
	w.bool(t.hasLight);
	w.bool(t.dontHide);
	w.bool(t.floorChange);
	w.bool(t.isTranslucent);
	w.bool(t.hasOffset);
	w.bool(t.hasElevation);
	w.bool(t.isLyingObject);
	w.bool(t.animateAlways);
	w.bool(t.miniMap);
	w.bool(t.isLensHelp);
	w.bool(t.isFullGround);
	w.bool(t.ignoreLook);
	w.bool(t.cloth);
	w.bool(t.isMarketItem);
	w.bool(t.hasDefaultAction);
	w.bool(t.wrappable);
	w.bool(t.unwrappable);
	w.bool(t.usable);
	w.bool(t.topEffect);
	w.bool(t.hasBones);

	w.u16(t.groundSpeed);
	w.u16(t.maxTextLength);
	w.u16(t.lightLevel);
	w.u16(t.lightColor);
	w.i16(t.offsetX);
	w.i16(t.offsetY);
	w.u16(t.elevation);
	w.u16(t.miniMapColor);
	w.u16(t.lensHelp);
	w.u16(t.clothSlot);
	w.u16(t.marketCategory);
	w.u16(t.marketTradeAs);
	w.u16(t.marketShowAs);
	w.u16(t.marketRestrictProfession);
	w.u16(t.marketRestrictLevel);
	w.u16(t.defaultAction);
	w.u8(t.animationMode);
	w.i32(t.loopCount);
	w.i8(t.startFrame);

	w.str(t.marketName);

	w.i16ArrayU8Len(t.bonesOffsetX ?? []);
	w.i16ArrayU8Len(t.bonesOffsetY ?? []);

	w.frameDurations(t.frameDurations);
	w.u32Array(t.spriteIndex ?? []);

	const groups = t.frameGroupsData ?? [];
	w.u8(groups.length);
	for (const g of groups) {
		w.u8(g.type);
		w.u8(g.width);
		w.u8(g.height);
		w.u8(g.exactSize);
		w.u8(g.layers);
		w.u8(g.patternX);
		w.u8(g.patternY);
		w.u8(g.patternZ);
		w.u8(g.frames);
		w.u8(g.animationMode ?? 0);
		w.i32(g.loopCount ?? 0);
		w.i8(g.startFrame ?? 0);
		w.frameDurations(g.frameDurations);
		w.u32Array(g.spriteIndex ?? []);
	}
}

function collectThings(
	map: Map<number, ThingType>,
	category: ThingCategory
): { maxId: number; minId: number; things: ThingType[] } {
	const minId = getCategoryStartId(TIBIA_FORMAT_CONFIG, category);

	let maxId = minId;
	const things: ThingType[] = [];

	for (const thing of map.values()) {
		if (thing.category === category) {
			things.push(thing);
			if (thing.id > maxId) {
				maxId = thing.id;
			}
		}
	}

	return { maxId, minId, things };
}

function collectModifiedSprites(
	data: AssetData,
	modifiedItems: Map<string, { id: number; data: ThingType; category: ThingCategory }>
): Map<number, Sprite> {
	const modifiedSprites = new Map<number, Sprite>();

	for (const item of modifiedItems.values()) {
		if (item.data.spriteIndex) {
			for (const spriteId of item.data.spriteIndex) {
				if (!modifiedSprites.has(spriteId)) {
					const sprite = data.sprites.get(spriteId);
					if (sprite) {
						modifiedSprites.set(spriteId, sprite);
					}
				}
			}
		}

		if (item.data.frameGroupsData) {
			for (const group of item.data.frameGroupsData) {
				if (group.spriteIndex) {
					for (const spriteId of group.spriteIndex) {
						if (!modifiedSprites.has(spriteId)) {
							const sprite = data.sprites.get(spriteId);
							if (sprite) {
								modifiedSprites.set(spriteId, sprite);
							}
						}
					}
				}
			}
		}
	}

	return modifiedSprites;
}

function fixSpriteIndex(thing: ThingType): void {
	const total = thing.width * thing.height * thing.patternX * thing.patternY * thing.patternZ * thing.frames * thing.layers;

	if (thing.frameGroupsData && thing.frameGroupsData.length > 0) {
		for (const group of thing.frameGroupsData) {
			const groupTotal =
				group.width * group.height * group.layers * group.patternX * group.patternY * group.patternZ * group.frames;

			if (!group.spriteIndex) {
				group.spriteIndex = [];
			}

			if (group.spriteIndex.length !== groupTotal) {
				console.warn(
					`Fixing frame group sprite index for ${thing.category} ${thing.id}: expected ${groupTotal} sprites but has ${group.spriteIndex.length}. Filling with empty sprites.`
				);
				group.spriteIndex = new Array(groupTotal).fill(0);
			}
		}
	}

	if (!thing.spriteIndex) {
		thing.spriteIndex = [];
	}

	if (thing.spriteIndex.length !== total) {
		console.warn(
			`Fixing sprite index for ${thing.category} ${thing.id}: expected ${total} sprites but has ${thing.spriteIndex.length}. Filling with empty sprites.`
		);

		thing.spriteIndex = new Array(total).fill(0);
	}
}

export async function compileDatFile(path: string, data: AssetData): Promise<void> {
	const itemsData = collectThings(data.items, ThingCategory.ITEM);
	const outfitsData = collectThings(data.outfits, ThingCategory.OUTFIT);
	const effectsData = collectThings(data.effects, ThingCategory.EFFECT);
	const missilesData = collectThings(data.missiles, ThingCategory.MISSILE);

	for (let i = 0; i < itemsData.things.length; i++) {
		const item = itemsData.things[i];
		if (item) {
			const total = item.width * item.height * item.patternX * item.patternY * item.patternZ * item.frames * item.layers;

			if (total > 0) {
				fixSpriteIndex(item);
			}

			if (total > 4096 || total === 0) {
				console.error(`CORRUPT ITEM at index ${i}:`, {
					id: item.id,
					width: item.width,
					height: item.height,
					frames: item.frames,
					layers: item.layers,
					totalSprites: total,
					category: item.category,
					patternX: item.patternX,
					patternY: item.patternY,
					patternZ: item.patternZ,
					spriteIndexLength: item.spriteIndex?.length || 0
				});
			}
		}
	}

	for (let i = 0; i < outfitsData.things.length; i++) {
		const outfit = outfitsData.things[i];
		if (outfit) {
			const total =
				outfit.width * outfit.height * outfit.patternX * outfit.patternY * outfit.patternZ * outfit.frames * outfit.layers;

			if (total > 0) {
				fixSpriteIndex(outfit);
			}

			if (total > 4096 || total === 0) {
				console.error(`CORRUPT OUTFIT at index ${i}:`, {
					id: outfit.id,
					width: outfit.width,
					totalSprites: total,
					height: outfit.height,
					frames: outfit.frames,
					layers: outfit.layers,
					category: outfit.category,
					patternX: outfit.patternX,
					patternY: outfit.patternY,
					patternZ: outfit.patternZ,
					spriteIndexLength: outfit.spriteIndex?.length || 0
				});
			}
		}
	}

	for (let i = 0; i < effectsData.things.length; i++) {
		const effect = effectsData.things[i];
		if (effect) {
			const total =
				effect.width * effect.height * effect.patternX * effect.patternY * effect.patternZ * effect.frames * effect.layers;
			if (total > 0) {
				fixSpriteIndex(effect);
			}
		}
	}

	for (let i = 0; i < missilesData.things.length; i++) {
		const missile = missilesData.things[i];
		if (missile) {
			const total =
				missile.width * missile.height * missile.patternX * missile.patternY * missile.patternZ * missile.frames * missile.layers;
			if (total > 0) {
				fixSpriteIndex(missile);
			}
		}
	}

	const w = new ByteWriter(4 << 20);
	w.u32(data.version.datSignature);
	w.u32(data.version.value);
	w.bool(data.extended);
	w.bool(data.frameDurations);
	w.bool(data.frameGroups);
	w.u16(itemsData.minId);
	w.u16(itemsData.maxId);
	w.u16(outfitsData.minId);
	w.u16(outfitsData.maxId);
	w.u16(effectsData.minId);
	w.u16(effectsData.maxId);
	w.u16(missilesData.minId);
	w.u16(missilesData.maxId);
	w.str(path);

	for (const category of [itemsData.things, outfitsData.things, effectsData.things, missilesData.things]) {
		w.u32(category.length);
		for (const thing of category) encodeThing(w, thing);
	}

	await invoke('write_dat_bin', w.finish());
}

export async function compileSprFile(path: string, data: AssetData, modifiedSprites: Map<number, Sprite>): Promise<void> {
	const w = new ByteWriter(1 << 20);
	w.bool(data.extended);
	w.u32(data.version.sprSignature);
	w.u32(data.spritesCount);
	w.str(data.sprPath ?? '');
	w.str(path);

	w.u32(modifiedSprites.size);
	for (const id of modifiedSprites.keys()) {
		const sprite = data.sprites.get(id);
		const isEmpty = sprite ? sprite.isEmpty : true;
		const compressed = sprite && !isEmpty ? (sprite.compressedPixels ?? new Uint8Array(0)) : new Uint8Array(0);
		w.u32(id);
		w.bool(isEmpty);
		w.u32(compressed.length);
		if (compressed.length > 0) w.bytes(compressed);
	}

	await invoke('copy_spr_file_with_mods', w.finish());
}

export async function updateSpritesInSpr(
	path: string,
	data: AssetData,
	modifiedSprites: Map<number, Sprite>,
	spritesCount: number
): Promise<void> {
	const allSprites = Array.from(modifiedSprites.keys()).map((id) => {
		const sprite = data.sprites.get(id);
		if (sprite) {
			return {
				id: sprite.id,
				isEmpty: sprite.isEmpty,
				compressedPixels: sprite.compressedPixels ?? new Uint8Array(0)
			};
		} else {
			return {
				id: id,
				isEmpty: true,
				compressedPixels: new Uint8Array(0)
			};
		}
	});

	const w = new ByteWriter(1 << 20);
	w.bool(data.extended);
	w.u32(spritesCount);
	w.str(path);
	w.u32(allSprites.length);
	for (const sprite of allSprites) {
		w.u32(sprite.id);
		w.bool(sprite.isEmpty);
		const len = sprite.isEmpty ? 0 : (sprite.compressedPixels?.length ?? 0);
		w.u32(len);
		if (len > 0) w.bytes(sprite.compressedPixels);
	}

	try {
		await invoke('update_spr_sprites_bin', w.finish());
	} catch (error) {
		if (error instanceof Error && error.message.includes('FULL_REWRITE_REQUIRED')) {
			console.log('Sprite count changed, falling back to full SPR rewrite...');
			await compileSprFile(path, data, modifiedSprites);
		} else if (typeof error === 'string' && error.includes('FULL_REWRITE_REQUIRED')) {
			console.log('Sprite count changed, falling back to full SPR rewrite...');
			await compileSprFile(path, data, modifiedSprites);
		} else {
			throw error;
		}
	}
}

export interface CompileFilesArgs {
	data: AssetData;
	datPath: string;
	sprPath: string;
	directlyModifiedSprites: Map<number, Sprite>;
	onProgress?: (stage: string, current: number, total: number) => void;
	modifiedItems: Map<string, { id: number; data: ThingType; category: ThingCategory }>;
	originalItems: Map<string, { id: number; data: ThingType; category: ThingCategory }>;
}

export async function compileFiles(args: CompileFilesArgs): Promise<void> {
	const { data, datPath, sprPath, onProgress, modifiedItems, originalItems, directlyModifiedSprites } = args;
	const startTime = Date.now();

	try {
		if (onProgress) onProgress('Collecting modified sprites...', 0, 5);
		const modifiedSpritesFromItems = collectModifiedSprites(data, modifiedItems);
		const modifiedSprites = new Map([...modifiedSpritesFromItems, ...directlyModifiedSprites]);

		if (onProgress) onProgress('Capturing previous sprite state...', 1, 5);
		const beforeSprites = await captureBeforeSprites(data, sprPath, modifiedSprites);

		if (onProgress) onProgress('Writing DAT file...', 2, 5);
		await invoke('backup_file', { path: datPath });
		await compileDatFile(datPath, data);
		await writeOtfiFile(datPath, data);

		if (onProgress) onProgress('Updating SPR file...', 3, 5);
		if (modifiedSprites.size > 0) {
			await invoke('backup_file', { path: sprPath });
			await updateSpritesInSpr(sprPath, data, modifiedSprites, data.spritesCount);
		}

		if (onProgress) onProgress('Creating version control commit...', 4, 5);
		const commitMessage = `Compile: ${modifiedItems.size} items, ${modifiedSprites.size} sprites modified`;
		try {
			const itemEntries = new Map<
				string,
				{ id: number; category: ThingCategory; after: null | ThingType; before: null | ThingType }
			>();
			for (const [key, mod] of modifiedItems.entries()) {
				const original = originalItems.get(key);
				itemEntries.set(key, {
					id: mod.id,
					after: mod.data,
					category: mod.category,
					before: original ? original.data : null
				});
			}

			const spriteEntries = new Map<
				number,
				{
					after: null | { transparent: boolean; compressedPixels: Uint8Array };
					before: null | { transparent: boolean; compressedPixels: Uint8Array };
				}
			>();
			for (const [id, sprite] of modifiedSprites.entries()) {
				const before = beforeSprites.get(id) ?? null;
				const isAfterEmpty = !data.sprites.has(id) || sprite.isEmpty;
				spriteEntries.set(id, {
					before,
					after: isAfterEmpty
						? null
						: { transparent: sprite.transparent, compressedPixels: sprite.compressedPixels ?? new Uint8Array(0) }
				});
			}

			await createCommit({
				items: itemEntries,
				message: commitMessage,
				sprites: spriteEntries
			});
		} catch (commitError) {
			console.error('Compile succeeded but version history commit failed:', commitError);
		}

		if (onProgress) onProgress('Compile complete', 5, 5);

		const duration = Date.now() - startTime;
		console.log(`Compile complete in ${duration}ms: ${modifiedItems.size} items, ${modifiedSprites.size} sprites`);
	} catch (error) {
		console.error('Compile failed:', error);
		throw error;
	}
}

async function captureBeforeSprites(
	data: AssetData,
	sprPath: string,
	modifiedSprites: Map<number, Sprite>
): Promise<Map<number, null | { transparent: boolean; compressedPixels: Uint8Array }>> {
	const result = new Map<number, null | { transparent: boolean; compressedPixels: Uint8Array }>();
	if (modifiedSprites.size === 0) return result;

	const ids = Array.from(modifiedSprites.keys()).filter((id) => id > 0 && id <= data.spritesCount);
	if (ids.length === 0) {
		for (const id of modifiedSprites.keys()) result.set(id, null);
		return result;
	}

	try {
		const onDisk = await readOnDiskSprites(sprPath, ids, data.extended);
		for (const id of modifiedSprites.keys()) {
			const disk = onDisk.get(id);
			if (!disk || disk.isEmpty) {
				result.set(id, null);
			} else {
				result.set(id, { transparent: data.transparency, compressedPixels: disk.compressedPixels });
			}
		}
	} catch (e) {
		console.error('Failed to read pre-compile sprite state, before-state will be empty:', e);
		for (const id of modifiedSprites.keys()) result.set(id, null);
	}

	return result;
}

export async function fullRecompile(
	data: AssetData,
	datPath: string,
	sprPath: string,
	onProgress?: (stage: string, current: number, total: number) => void
): Promise<void> {
	const startTime = Date.now();

	try {
		if (onProgress) onProgress('Writing DAT file...', 0, 2);
		await invoke('backup_file', { path: datPath });
		await compileDatFile(datPath, data);
		await writeOtfiFile(datPath, data);

		if (onProgress) onProgress('Writing SPR file...', 1, 2);
		await invoke('backup_file', { path: sprPath });
		await compileSprFile(sprPath, data, new Map());

		if (onProgress) onProgress('Full recompile complete', 2, 2);

		const duration = Date.now() - startTime;
		console.log(`Full recompile complete in ${duration}ms`);
	} catch (error) {
		console.error('Full recompile failed:', error);
		throw error;
	}
}
