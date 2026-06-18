import type { Sprite, AssetData, ThingType } from './types';

import * as lz4 from 'lz4js';
import { invoke } from '@tauri-apps/api/core';

import { parseRgbaSprites } from './loader';
import { ByteWriter, encodeThing } from './compiler';
import { ThingCategory, THING_CATEGORY_VALUES } from './types';

export type ExportFormat = 'png' | 'bmp' | 'jpg' | 'obd' | 'sfp';

export type ImportSource = 'sfp' | 'obd';

const FLAG_TRANSPARENCY = 0b0000_0010;

const SPRITE_DATA_SIZE = 4096;

const CATEGORY_BY_VALUE: Record<number, ThingCategory> = {
	1: ThingCategory.ITEM,
	2: ThingCategory.OUTFIT,
	3: ThingCategory.EFFECT,
	4: ThingCategory.MISSILE
};

export interface ImportEntry {
	name: string;
	index: number;
	width: number;
	height: number;
	frames: number;
	layers: number;
	thumbW: number;
	thumbH: number;
	sourceId: number;
	thumb: Uint8Array;
	spriteCount: number;
	category: ThingCategory;
}

export interface ImportManifest {
	flags: number;
	source: ImportSource;
	clientVersion: number;
	entries: ImportEntry[];
}

function writeFileList(w: ByteWriter, files: Uint8Array[]): void {
	w.u32(files.length);
	for (const f of files) {
		w.u32(f.length);
		w.bytes(f);
	}
}

interface ExportSprite {
	kind: number;
	localId: number;
	bytes: Uint8Array;
}

interface ExportBundle {
	things: ThingType[];
	sprites: ExportSprite[];
}

export function collectReferencedSpriteIds(things: ThingType[]): number[] {
	const ids = new Set<number>();
	for (const thing of things) {
		for (const id of thing.spriteIndex ?? []) {
			if (id > 0) ids.add(id);
		}
		for (const group of thing.frameGroupsData ?? []) {
			for (const id of group.spriteIndex ?? []) {
				if (id > 0) ids.add(id);
			}
		}
	}
	return Array.from(ids);
}

function remapIndex(arr: number[] | undefined, map: Map<number, number>): number[] {
	return (arr ?? []).map((id) => (id > 0 ? (map.get(id) ?? 0) : 0));
}

function buildExportBundle(things: ThingType[], data: AssetData): ExportBundle {
	const localMap = new Map<number, number>();
	const sprites: ExportSprite[] = [];
	let nextLocal = 1;

	const ensureLocal = (spriteId: number): number => {
		if (spriteId <= 0) return 0;
		const existing = localMap.get(spriteId);
		if (existing) return existing;

		const local = nextLocal++;
		localMap.set(spriteId, local);

		const sprite = data.sprites.get(spriteId);
		if (!sprite || sprite.isEmpty) {
			sprites.push({ kind: 0, localId: local, bytes: new Uint8Array(0) });
		} else if (sprite.compressedPixels && sprite.compressedPixels.length > 0) {
			sprites.push({ kind: 1, localId: local, bytes: sprite.compressedPixels });
		} else {
			sprites.push({ kind: 2, localId: local, bytes: sprite.rgbaPixels });
		}
		return local;
	};

	const remappedThings = things.map((thing) => {
		const clone: ThingType = JSON.parse(JSON.stringify(thing));
		clone.spriteIndex = remapIndex(thing.spriteIndex, new Map());
		for (const id of thing.spriteIndex ?? []) ensureLocal(id);
		for (const group of thing.frameGroupsData ?? []) {
			for (const id of group.spriteIndex ?? []) ensureLocal(id);
		}
		clone.spriteIndex = remapIndex(thing.spriteIndex, localMap);
		if (clone.frameGroupsData && thing.frameGroupsData) {
			for (let i = 0; i < clone.frameGroupsData.length; i++) {
				clone.frameGroupsData[i].spriteIndex = remapIndex(thing.frameGroupsData[i]?.spriteIndex, localMap);
			}
		}
		return clone;
	});

	return { sprites, things: remappedThings };
}

function flagsFor(data: AssetData): number {
	return data.transparency ? FLAG_TRANSPARENCY : 0;
}

function writeSprites(w: ByteWriter, sprites: ExportSprite[]): void {
	w.u32(sprites.length);
	for (const sprite of sprites) {
		w.u32(sprite.localId);
		w.u8(sprite.kind);
		w.u32(sprite.bytes.length);
		if (sprite.bytes.length > 0) w.bytes(sprite.bytes);
	}
}

export async function exportPack(
	things: ThingType[],
	data: AssetData,
	outPath: string,
	appendPath: null | string
): Promise<void> {
	const bundle = buildExportBundle(things, data);

	const w = new ByteWriter(1 << 20);
	w.u8(appendPath ? 1 : 0);
	w.str(outPath);
	w.str(appendPath ?? '');
	w.u16(data.version.value);
	w.u8(flagsFor(data));

	w.u32(bundle.things.length);
	for (let i = 0; i < bundle.things.length; i++) {
		const thing = bundle.things[i];
		w.u8(THING_CATEGORY_VALUES[things[i].category]);
		w.str(things[i].marketName || `${things[i].category} ${things[i].id}`);
		const tw = new ByteWriter(4096);
		encodeThing(tw, thing);
		const thingBytes = tw.finish();
		w.u32(thingBytes.length);
		w.bytes(thingBytes);
	}

	writeSprites(w, bundle.sprites);

	await invoke('export_pack_bin', w.finish());
}

export async function exportObd(thing: ThingType, data: AssetData, outPath: string): Promise<void> {
	const bundle = buildExportBundle([thing], data);

	const w = new ByteWriter(1 << 20);
	w.str(outPath);
	w.u16(data.version.value);
	w.u8(flagsFor(data));
	w.u8(THING_CATEGORY_VALUES[thing.category]);

	const tw = new ByteWriter(4096);
	encodeThing(tw, bundle.things[0]);
	const thingBytes = tw.finish();
	w.u32(thingBytes.length);
	w.bytes(thingBytes);

	writeSprites(w, bundle.sprites);

	await invoke('export_obd_bin', w.finish());
}

function parseManifest(buffer: Uint8Array, source: ImportSource): ImportManifest {
	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	const decoder = new TextDecoder();
	let offset = 0;

	offset += 1;
	const clientVersion = view.getUint16(offset, true);
	offset += 2;
	const flags = view.getUint8(offset);
	offset += 1;
	const entryCount = view.getUint32(offset, true);
	offset += 4;

	const entries: ImportEntry[] = [];
	for (let i = 0; i < entryCount; i++) {
		const categoryValue = view.getUint8(offset);
		offset += 1;
		const sourceId = view.getUint32(offset, true);
		offset += 4;
		const width = view.getUint8(offset);
		offset += 1;
		const height = view.getUint8(offset);
		offset += 1;
		const layers = view.getUint8(offset);
		offset += 1;
		const frames = view.getUint8(offset);
		offset += 1;
		const nameLen = view.getUint16(offset, true);
		offset += 2;
		const name = decoder.decode(buffer.subarray(offset, offset + nameLen));
		offset += nameLen;
		const thumbW = view.getUint16(offset, true);
		offset += 2;
		const thumbH = view.getUint16(offset, true);
		offset += 2;
		const thumbLen = view.getUint32(offset, true);
		offset += 4;
		const thumb = buffer.slice(offset, offset + thumbLen);
		offset += thumbLen;
		const spriteCount = view.getUint32(offset, true);
		offset += 4;

		entries.push({
			name,
			width,
			thumb,
			frames,
			height,
			layers,
			thumbW,
			thumbH,
			index: i,
			sourceId,
			spriteCount,
			category: CATEGORY_BY_VALUE[categoryValue] ?? ThingCategory.ITEM
		});
	}

	return { flags, source, entries, clientVersion };
}

export async function readSfpManifest(bytes: Uint8Array): Promise<ImportManifest> {
	const response = await invoke<Uint8Array>('read_pack_manifest_bin', bytes);
	const buffer = response instanceof Uint8Array ? response : new Uint8Array(response);
	return parseManifest(buffer, 'sfp');
}

export async function readObdManifest(files: Uint8Array[]): Promise<ImportManifest> {
	const w = new ByteWriter(1 << 16);
	writeFileList(w, files);
	const response = await invoke<Uint8Array>('read_obd_manifest_bin', w.finish());
	const buffer = response instanceof Uint8Array ? response : new Uint8Array(response);
	return parseManifest(buffer, 'obd');
}

export interface ExtractResult {
	sprites: Sprite[];
	things: ThingType[];
}

function parseExtractResponse(buffer: Uint8Array, transparency: boolean): ExtractResult {
	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	const decoder = new TextDecoder();
	let offset = 0;

	const thingCount = view.getUint32(offset, true);
	offset += 4;

	const things: ThingType[] = [];
	for (let i = 0; i < thingCount; i++) {
		const jsonLen = view.getUint32(offset, true);
		offset += 4;
		const json = decoder.decode(buffer.subarray(offset, offset + jsonLen));
		offset += jsonLen;
		things.push(JSON.parse(json) as ThingType);
	}

	const compressed = buffer.slice(offset);
	const decompressed = compressed.length > 0 ? lz4.decompress(compressed) : new Uint8Array(4);
	const sprites = parseRgbaSprites(decompressed, transparency);

	return { things, sprites };
}

export async function extractSfpEntries(
	bytes: Uint8Array,
	indices: number[],
	baseSpriteId: number,
	transparency: boolean
): Promise<ExtractResult> {
	const w = new ByteWriter(bytes.length + 1024);
	w.u32(baseSpriteId);
	w.u32(indices.length);
	for (const index of indices) w.u32(index);
	w.bytes(bytes);

	const response = await invoke<Uint8Array>('extract_pack_entries_bin', w.finish());
	const buffer = response instanceof Uint8Array ? response : new Uint8Array(response);
	return parseExtractResponse(buffer, transparency);
}

export async function extractObdEntries(
	files: Uint8Array[],
	baseSpriteId: number,
	transparency: boolean
): Promise<ExtractResult> {
	const w = new ByteWriter(1 << 16);
	w.u8(transparency ? FLAG_TRANSPARENCY : 0);
	w.u32(baseSpriteId);
	writeFileList(w, files);

	const response = await invoke<Uint8Array>('extract_obd_bin', w.finish());
	const buffer = response instanceof Uint8Array ? response : new Uint8Array(response);
	return parseExtractResponse(buffer, transparency);
}

export async function readFileBytes(path: string): Promise<Uint8Array> {
	const r = await invoke<Uint8Array>('read_file', { path });
	return r instanceof Uint8Array ? r : new Uint8Array(r);
}

export { SPRITE_DATA_SIZE };
