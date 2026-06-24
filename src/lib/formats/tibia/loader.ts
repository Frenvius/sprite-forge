import * as lz4 from 'lz4js';
import { log } from '@/lib/log';
import { join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import { loadDatFile } from './datReader';
import { SpriteReader } from './spriteReader';
import { decodeDatResponse } from './datDecoder';
import {
	Sprite,
	AssetData,
	ThingType,
	ClientVersion,
	getSpriteIndex,
	CLIENT_VERSIONS,
	isValidSpriteId,
	TIBIA_FORMAT_CONFIG,
	getCategoryRenderConfig
} from './types';

function collectThumbnailIds(things: Iterable<ThingType>, into: Set<number>): void {
	for (const thing of things) {
		if (!thing.spriteIndex || thing.spriteIndex.length === 0) continue;
		const clamp = getCategoryRenderConfig(TIBIA_FORMAT_CONFIG, thing.category)?.listPatternXClamp;
		const defaultPatternX = clamp && thing.patternX > clamp ? clamp : 0;
		for (let h = 0; h < thing.height; h++) {
			for (let w = 0; w < thing.width; w++) {
				const index = getSpriteIndex(thing, w, h, 0, defaultPatternX, 0, 0, 0);
				if (index < thing.spriteIndex.length) {
					const spriteId = thing.spriteIndex[index];
					if (spriteId && isValidSpriteId(spriteId)) into.add(spriteId);
				}
			}
		}
	}
}

async function readBinaryFile(path: string): Promise<Uint8Array> {
	const bytes = await invoke<Uint8Array>('read_file', { path });
	return bytes;
}

async function readSignature(path: string): Promise<number> {
	const response = await invoke<Uint8Array | ArrayBuffer>('read_file_header', { path, bytes: 4 });
	const buffer = response instanceof Uint8Array ? response : new Uint8Array(response);
	if (buffer.length < 4) {
		throw new Error(`File ${path} is too small to contain a signature`);
	}
	return (buffer[0] | (buffer[1] << 8) | (buffer[2] << 16) | (buffer[3] << 24)) >>> 0;
}

export function detectVersionFromSignature(signature: number): null | ClientVersion {
	return CLIENT_VERSIONS.find((v) => v.datSignature === signature || v.sprSignature === signature) || null;
}

export function getVersionBySignatures(datSig: number, sprSig: number): null | ClientVersion {
	return CLIENT_VERSIONS.find((v) => v.datSignature === datSig && v.sprSignature === sprSig) || null;
}

export interface DatHeader {
	signature: number;
	itemsCount: number;
	outfitsCount: number;
	effectsCount: number;
	missilesCount: number;
	version: null | ClientVersion;
}

export interface SprHeader {
	signature: number;
	extended: boolean;
	spriteCount: number;
}

export interface OtfiData {
	extended: boolean;
	spriteSize?: number;
	frameGroups: boolean;
	spritesFile?: string;
	transparency: boolean;
	metadataFile?: string;
	frameDurations: boolean;
	spriteDataSize?: number;
}

export async function writeOtfiFile(datPath: string, data: AssetData): Promise<void> {
	const slash = Math.max(datPath.lastIndexOf('\\'), datPath.lastIndexOf('/'));
	const dirWithSep = slash >= 0 ? datPath.slice(0, slash + 1) : '';
	const datName = slash >= 0 ? datPath.slice(slash + 1) : datPath;
	const baseName = datName.replace(/\.dat$/i, '');
	const sprName = (data.sprPath ?? '').replace(/^.*[\\/]/, '') || `${baseName}.spr`;
	const contents = [
		'DatSpr',
		`  extended: ${data.extended}`,
		`  transparency: ${data.transparency}`,
		`  frame-durations: ${data.frameDurations}`,
		`  frame-groups: ${data.frameGroups}`,
		`  metadata-file: ${datName}`,
		`  sprites-file: ${sprName}`,
		''
	].join('\n');
	await invoke('write_file_text', { contents, path: `${dirWithSep}${baseName}.otfi` });
}

function parseOtml(content: string): Record<string, string> {
	const result: Record<string, string> = {};
	const lines = content.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || !trimmed.includes(':')) continue;

		const colonIndex = trimmed.indexOf(':');
		const key = trimmed.substring(0, colonIndex).trim();
		const value = trimmed.substring(colonIndex + 1).trim();

		if (key && value) {
			result[key] = value;
		}
	}

	return result;
}

export async function readOtfiFile(folderPath: string, baseName = 'Tibia'): Promise<null | OtfiData> {
	const patterns = [
		await join(folderPath, `${baseName}.otfi`),
		await join(folderPath, `${baseName}.dat.otfi`),
		await join(folderPath, 'Tibia.otfi'),
		await join(folderPath, 'Tibia.dat.otfi')
	];

	for (const path of patterns) {
		try {
			const content = await invoke<string>('read_file_text', { path });

			const data = parseOtml(content);

			return {
				extended: data['extended'] === 'true',
				frameGroups: data['frame-groups'] === 'true',
				transparency: data['transparency'] === 'true',
				spritesFile: data['sprites-file'] || undefined,
				metadataFile: data['metadata-file'] || undefined,
				frameDurations: data['frame-durations'] === 'true',
				spriteSize: data['sprite-size'] ? parseInt(data['sprite-size'], 10) : undefined,
				spriteDataSize: data['sprite-data-size'] ? parseInt(data['sprite-data-size'], 10) : undefined
			};
		} catch {
			continue;
		}
	}

	return null;
}

export async function readDatHeader(path: string): Promise<DatHeader> {
	const response = await invoke<Uint8Array | ArrayBuffer>('read_file_header', { path, bytes: 12 });

	const buffer = response instanceof Uint8Array ? response : new Uint8Array(response);

	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

	const signature = view.getUint32(0, true);
	const itemsCount = view.getUint16(4, true);
	const outfitsCount = view.getUint16(6, true);
	const effectsCount = view.getUint16(8, true);
	const missilesCount = view.getUint16(10, true);

	const version = detectVersionFromSignature(signature);

	return {
		version,
		signature,
		itemsCount,
		outfitsCount,
		effectsCount,
		missilesCount
	};
}

export async function readSprHeader(path: string): Promise<SprHeader> {
	const response = await invoke<Uint8Array | ArrayBuffer>('read_file_header', { path, bytes: 8 });

	const buffer = response instanceof Uint8Array ? response : new Uint8Array(response);

	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

	const signature = view.getUint32(0, true);

	const version = detectVersionFromSignature(signature);
	const extended = version?.supportsExtended ?? false;

	let spriteCount: number;
	if (extended) {
		spriteCount = view.getUint32(4, true);
	} else {
		spriteCount = view.getUint16(4, true);
	}

	return {
		extended,
		signature,
		spriteCount
	};
}

export async function loadTibiaDat(
	path: string,
	version: ClientVersion,
	onProgress?: (current: number, total: number) => void
): Promise<{
	signature: number;
	itemsCount: number;
	outfitsCount: number;
	effectsCount: number;
	missilesCount: number;
	items: Map<number, ThingType>;
	outfits: Map<number, ThingType>;
	effects: Map<number, ThingType>;
	missiles: Map<number, ThingType>;
}> {
	const buffer = await readBinaryFile(path);
	const extended = version.supportsExtended;
	const frameDurations = version.supportsFrameDurations;

	return await loadDatFile(buffer, extended, frameDurations, onProgress, version);
}

interface RustSprHeader {
	signature: number;
	extended: boolean;
	sprite_count: number;
}

export async function loadTibiaSpr(
	path: string,
	version: ClientVersion,
	enableTransparency?: boolean,
	extendedOverride?: boolean
): Promise<{ path: string; header: RustSprHeader; transparency: boolean }> {
	const extended = extendedOverride ?? version.supportsExtended;
	const transparency = enableTransparency ?? version.supportsAlphaChannel;
	console.log(
		`[loadTibiaSpr] Loading ${path} with version ${version.label}. Transparency: ${transparency} (Requested: ${enableTransparency}, Default: ${version.supportsAlphaChannel})`
	);

	const header = await invoke<RustSprHeader>('open_spr_file', {
		path,
		extended
	});

	return {
		path,
		header,
		transparency
	};
}

export async function selectDatFile(): Promise<null | string> {
	const selected = await open({
		multiple: false,
		title: 'Select Tibia.dat file',
		filters: [
			{
				extensions: ['dat'],
				name: 'Tibia DAT Files'
			}
		]
	});

	return selected as null | string;
}

export async function selectSprFile(): Promise<null | string> {
	const selected = await open({
		multiple: false,
		title: 'Select Tibia.spr file',
		filters: [
			{
				extensions: ['spr'],
				name: 'Tibia SPR Files'
			}
		]
	});

	return selected as null | string;
}

export async function selectTibiaFolder(): Promise<null | { datPath: string; sprPath: string }> {
	const selected = await open({
		directory: true,
		multiple: false,
		title: 'Select folder containing Tibia.dat and Tibia.spr'
	});

	if (!selected || typeof selected !== 'string') {
		return null;
	}

	const datPath = await join(selected, 'Tibia.dat');
	const sprPath = await join(selected, 'Tibia.spr');

	return { datPath, sprPath };
}

let loadEpoch = 0;

export interface LoadOverrides {
	extended?: boolean;
	frameGroups?: boolean;
	frameDurations?: boolean;
}

export async function loadTibiaData(
	datPath: string,
	sprPath: string,
	version?: ClientVersion,
	transparency?: boolean,
	onProgress?: (stage: string, current: number, total: number) => void,
	overrides?: LoadOverrides,
	serverPaths?: { otbPath?: string; xmlPath?: string }
): Promise<AssetData> {
	const startTime = performance.now();
	const myEpoch = ++loadEpoch;

	let detectedVersion = version;
	if (!detectedVersion) {
		if (onProgress) onProgress('Detecting version...', 0, 100);
		const [datSig, sprSig] = await Promise.all([readSignature(datPath), readSignature(sprPath)]);
		detectedVersion =
			getVersionBySignatures(datSig, sprSig) ?? detectVersionFromSignature(datSig) ?? detectVersionFromSignature(sprSig);
		if (!detectedVersion) {
			throw new Error(`Unknown signatures - DAT: 0x${datSig.toString(16)}, SPR: 0x${sprSig.toString(16)}`);
		}
	}

	if (onProgress) onProgress('Loading files...', 10, 100);

	const extendedOverride = overrides?.extended;
	const effectiveExtended = extendedOverride ?? detectedVersion.supportsExtended;

	const [datResponse, sprData] = await Promise.all([
		invoke<Uint8Array>('parse_dat_file_bin', {
			path: datPath,
			extended: overrides?.extended,
			version: detectedVersion.value,
			frameGroups: overrides?.frameGroups,
			frameDurations: overrides?.frameDurations
		}),
		loadTibiaSpr(sprPath, detectedVersion, transparency, extendedOverride)
	]);

	if (onProgress) onProgress('Parsing metadata...', 70, 100);
	const datBuf = datResponse instanceof Uint8Array ? datResponse : new Uint8Array(datResponse);
	const datData = decodeDatResponse(datBuf);

	const sprites = new Map<number, Sprite>();

	try {
		if (onProgress) onProgress('Preloading sprites...', 95, 100);

		const FIRST_PAGE = 100;
		const firstPageThumbs = new Set<number>();
		const collectFirstPage = (things: Iterable<ThingType>) => {
			let n = 0;
			for (const thing of things) {
				collectThumbnailIds([thing], firstPageThumbs);
				if (++n >= FIRST_PAGE) break;
			}
		};
		collectFirstPage(datData.items.values());
		collectFirstPage(datData.outfits.values());
		collectFirstPage(datData.effects.values());
		collectFirstPage(datData.missiles.values());

		if (firstPageThumbs.size > 0) {
			await loadSpriteIdsLz4(sprPath, Array.from(firstPageThumbs), sprData.transparency, sprites);
		}
		if (onProgress) onProgress('Preloading sprites...', 100, 100);
	} catch (err) {
		log.error('Failed to preload first-page thumbnails', err);
	}

	const FULL_PRELOAD_MAX_SPRITES = 60000;
	if (sprData.header.sprite_count <= FULL_PRELOAD_MAX_SPRITES) {
		setTimeout(() => {
			if (myEpoch !== loadEpoch) return;
			void preloadSprites(
				sprPath,
				sprData.header.sprite_count,
				sprData.transparency,
				sprites,
				sprData.header.sprite_count,
				undefined,
				() => myEpoch === loadEpoch
			).catch((err) => log.error('Background full preload failed', err));
		}, 400);
	}

	let serverItems: AssetData['serverItems'];
	if (serverPaths?.otbPath) {
		try {
			if (onProgress) onProgress('Loading server items (OTB)...', 98, 100);
			const { loadServerItems } = await import('./otb');
			serverItems = await loadServerItems(serverPaths.otbPath, serverPaths.xmlPath);
		} catch (err) {
			log.error('Failed to load items.otb', err);
		}
	}

	const totalTime = performance.now();
	console.log(`[loadTibiaData] Total loading time: ${(totalTime - startTime).toFixed(0)}ms`);

	if (onProgress) onProgress('Ready', 100, 100);

	return {
		sprites,
		datPath,
		serverItems,
		items: datData.items,
		sprPath: sprData.path,
		version: detectedVersion,
		outfits: datData.outfits,
		effects: datData.effects,
		missiles: datData.missiles,
		extended: effectiveExtended,
		otbPath: serverPaths?.otbPath,
		xmlPath: serverPaths?.xmlPath,
		itemsCount: datData.itemsCount,
		transparency: sprData.transparency,
		outfitsCount: datData.outfitsCount,
		effectsCount: datData.effectsCount,
		missilesCount: datData.missilesCount,
		spritesCount: sprData.header.sprite_count,
		frameGroups: overrides?.frameGroups ?? detectedVersion.value >= 1057,
		frameDurations: overrides?.frameDurations ?? detectedVersion.supportsFrameDurations
	};
}

export function getSpriteWindowStart(spriteId: number, windowSize: number = 100): number {
	return Math.floor(spriteId / windowSize) * windowSize;
}

const SPRITE_DATA_SIZE = 4096;

export function parseRgbaSprites(response: Uint8Array | ArrayBuffer, transparency: boolean): Sprite[] {
	let view: DataView;
	let buffer: Uint8Array;

	if (response instanceof Uint8Array) {
		view = new DataView(response.buffer, response.byteOffset, response.byteLength);
		buffer = response;
	} else if (response instanceof ArrayBuffer) {
		view = new DataView(response);
		buffer = new Uint8Array(response);
	} else {
		console.error('Unexpected response type:', response);
		return [];
	}

	const sprites: Sprite[] = [];
	let offset = 0;

	if (view.byteLength < 4) return [];

	const count = view.getUint32(offset, true);
	offset += 4;

	for (let i = 0; i < count; i++) {
		if (offset + 9 > view.byteLength) break;

		const id = view.getUint32(offset, true);
		offset += 4;

		const isEmpty = view.getUint8(offset) === 1;
		offset += 1;

		const compressedLen = view.getUint32(offset, true);
		offset += 4;

		let compressedPixels: Uint8Array;
		if (compressedLen > 0) {
			if (offset + compressedLen > view.byteLength) {
				console.error(`Parse error: sprite ${id} compressed length ${compressedLen} exceeds buffer`);
				break;
			}
			compressedPixels = buffer.slice(offset, offset + compressedLen);
			offset += compressedLen;
		} else {
			compressedPixels = new Uint8Array(0);
		}

		if (offset + SPRITE_DATA_SIZE > view.byteLength) {
			console.error(`Parse error: sprite ${id} RGBA data exceeds buffer`);
			break;
		}

		const rgbaPixels = buffer.slice(offset, offset + SPRITE_DATA_SIZE);
		offset += SPRITE_DATA_SIZE;

		sprites.push({
			id,
			isEmpty,
			rgbaPixels,
			compressedPixels,
			transparent: transparency
		});
	}
	return sprites;
}

export function parseImportResponse(buffer: Uint8Array, transparency: boolean): { sprites: Sprite[]; updatedThing: ThingType } {
	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	let offset = 0;

	const jsonLen = view.getUint32(offset, true);
	offset += 4;

	const jsonBytes = buffer.slice(offset, offset + jsonLen);
	offset += jsonLen;
	const updatedThing = JSON.parse(new TextDecoder().decode(jsonBytes)) as ThingType;

	const compressedSprites = buffer.slice(offset);

	const decompressedSprites = lz4.decompress(compressedSprites);

	const sprites = parseRgbaSprites(decompressedSprites, transparency);

	return { sprites, updatedThing };
}

const DEFAULT_WINDOW_SIZE = 100;

export async function loadSpriteWindow(
	sprPath: string,
	spriteId: number,
	totalSprites: number,
	transparency: boolean,
	spriteCache: Map<number, Sprite>,
	windowSize: number = DEFAULT_WINDOW_SIZE
): Promise<void> {
	const WINDOW_SIZE = windowSize;

	const windowStart = getSpriteWindowStart(spriteId, WINDOW_SIZE);
	const startId = Math.max(1, windowStart);
	const endId = Math.min(startId + WINDOW_SIZE - 1, totalSprites);
	const count = endId - startId + 1;

	let allCached = true;
	for (let id = startId; id <= endId; id++) {
		if (!spriteCache.has(id)) {
			allCached = false;
			break;
		}
	}

	if (allCached) return;

	try {
		const response = await invoke<Uint8Array>('read_sprites_batch_rgba', {
			count,
			startId,
			path: sprPath,
			transparent: transparency
		});

		const batchedSprites = parseRgbaSprites(response, transparency);

		for (const sprite of batchedSprites) {
			spriteCache.set(sprite.id, sprite);
		}
	} catch (err) {
		log.error(`Failed to load sprite window ${startId}-${endId}`, err);
	}
}

export async function preloadSprites(
	sprPath: string,
	totalSprites: number,
	transparency: boolean,
	spriteCache: Map<number, Sprite>,
	count: number = 2000,
	onProgress?: (loaded: number, total: number) => void,
	shouldContinue?: () => boolean
): Promise<void> {
	const BATCH_SIZE = 500;
	const batches = Math.ceil(Math.min(count, totalSprites) / BATCH_SIZE);

	for (let i = 0; i < batches; i++) {
		if (shouldContinue && !shouldContinue()) return;

		const startId = i * BATCH_SIZE + 1;
		const batchCount = Math.min(BATCH_SIZE, totalSprites - startId + 1);

		if (batchCount <= 0) break;

		try {
			const response = await invoke<Uint8Array>('read_sprites_batch_rgba', {
				startId,
				path: sprPath,
				count: batchCount,
				transparent: transparency
			});

			const batchedSprites = parseRgbaSprites(response, transparency);

			for (const sprite of batchedSprites) {
				spriteCache.set(sprite.id, sprite);
			}

			if (onProgress) {
				onProgress(Math.min((i + 1) * BATCH_SIZE, count), count);
			}
		} catch (err) {
			log.error(`Failed to preload batch ${i + 1}/${batches}`, err);
		}

		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	}
}

export async function loadSpriteIds(
	sprPath: string,
	spriteIds: number[],
	transparency: boolean,
	spriteCache: Map<number, Sprite>
): Promise<void> {
	const uncachedIds = spriteIds.filter((id) => id > 0 && !spriteCache.has(id));

	if (uncachedIds.length === 0) return;

	const uniqueIds = [...new Set(uncachedIds)];

	try {
		const response = await invoke<Uint8Array>('read_sprites_rgba', {
			path: sprPath,
			ids: uniqueIds,
			transparent: transparency
		});

		const batchedSprites = parseRgbaSprites(response, transparency);

		for (const sprite of batchedSprites) {
			spriteCache.set(sprite.id, sprite);
		}
	} catch (err) {
		log.error(`Failed to load sprite list of ${uniqueIds.length} items`, err);
	}
}

export async function loadSpriteIdsLz4(
	sprPath: string,
	spriteIds: number[],
	transparency: boolean,
	spriteCache: Map<number, Sprite>
): Promise<void> {
	const uncachedIds = spriteIds.filter((id) => id > 0 && !spriteCache.has(id));

	if (uncachedIds.length === 0) return;

	const uniqueIds = [...new Set(uncachedIds)];

	try {
		const compressedResponse = await invoke<Uint8Array>('read_sprites_rgba_lz4', {
			path: sprPath,
			ids: uniqueIds,
			transparent: transparency
		});

		const compressedBuffer = compressedResponse instanceof Uint8Array ? compressedResponse : new Uint8Array(compressedResponse);

		const decompressed = lz4.decompress(compressedBuffer);

		const batchedSprites = parseRgbaSprites(decompressed, transparency);

		for (const sprite of batchedSprites) {
			spriteCache.set(sprite.id, sprite);
		}
	} catch (err) {
		log.error(`Failed to load sprite list (LZ4) of ${uniqueIds.length} items`, err);
		await loadSpriteIds(sprPath, spriteIds, transparency, spriteCache);
	}
}

export function getSpriteFromReader(reader: SpriteReader, spriteCache: Map<number, Sprite>, id: number): null | Sprite {
	if (spriteCache.has(id)) {
		return spriteCache.get(id)!;
	}

	const sprite = reader.readSprite(id);
	if (sprite) {
		spriteCache.set(id, sprite);
	}

	return sprite;
}
