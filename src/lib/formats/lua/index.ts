import type { ServerItemData } from '~/lib/formats/tibia/otb';

import { invoke } from '@tauri-apps/api/core';

import { toCamelKey, toSnakeKey } from './keys';
import { ByteWriter } from '~/lib/formats/tibia/compiler';
import { parseRgbaSprites } from '~/lib/formats/tibia/loader';
import { collectReferencedSpriteIds } from '~/lib/formats/tibia/transfer';
import { getDefaultProfileId } from '~/lib/formats/tibia/serverAttributes';
import { type ItemRow, serverItemsToAttrs, buildServerItemData } from './serverItems';
import { ForgeThing, forgeThings, forgeListTools, forgeLoadAssets, forgeLoadItemdb } from '~/adapter/forge';
import {
	registerFormat,
	type RemovedReason,
	type RemovedSprite,
	type FormatHandler,
	type OptimizeResult
} from '~/lib/formats/registry';
import {
	AssetData,
	ThingType,
	type Sprite,
	FormatConfig,
	ClientVersion,
	ThingCategory,
	type CategoryDef
} from '~/lib/formats/tibia/types';

async function loadSpritesScripted(data: AssetData, ids: number[]): Promise<void> {
	const uncached = ids.filter((id) => id > 0 && !data.sprites.has(id));
	if (uncached.length === 0) return;
	const unique = [...new Set(uncached)];
	try {
		const resp = await invoke<Uint8Array>('forge_read_sprites', { ids: unique });
		const parsed = parseRgbaSprites(resp, data.transparency);
		for (const sp of parsed) data.sprites.set(sp.id, sp);
	} catch (err) {
		console.error('lua loadSprites failed', err);
	}
}

function hashRgba(px: Uint8Array): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < px.length; i++) {
		h ^= px[i];
		h = (h * 0x01000193) >>> 0;
	}
	return h.toString(16) + ':' + px.length;
}

async function optimizeScripted(
	data: AssetData,
	onProgress?: (m: string, c: number, t: number) => void
): Promise<OptimizeResult> {
	const steps = 3;
	let step = 0;
	if (onProgress) onProgress('Scanning used sprites...', step++, steps);

	const used = new Set<number>();
	const scan = (t: ThingType) => {
		for (const id of t.spriteIndex ?? []) if (id > 0) used.add(id);
		for (const g of t.frameGroupsData ?? []) for (const id of g.spriteIndex ?? []) if (id > 0) used.add(id);
	};
	for (const t of data.items.values()) scan(t);
	for (const t of data.outfits.values()) scan(t);
	for (const t of data.effects.values()) scan(t);
	for (const t of data.missiles.values()) scan(t);

	const usedIds = [...used].sort((a, b) => a - b);
	if (usedIds.length === 0) throw new Error('Optimize aborted: no sprites referenced.');
	await loadSpritesScripted(data, usedIds);

	if (onProgress) onProgress('Deduplicating...', step++, steps);

	const oldTotal = data.spritesCount;
	const byHash = new Map<string, number[]>();
	const canonical = new Map<number, number>();
	const pxEq = (a: Uint8Array, b: Uint8Array) => {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
		return true;
	};
	for (const id of usedIds) {
		const sp = data.sprites.get(id);
		if (!sp || sp.isEmpty || sp.rgbaPixels?.length !== 4096) {
			canonical.set(id, 0);
			continue;
		}
		const h = hashRgba(sp.rgbaPixels);
		const bucket = byHash.get(h) ?? [];
		const match = bucket.find((cid) => pxEq(data.sprites.get(cid)!.rgbaPixels, sp.rgbaPixels));
		if (match !== undefined) canonical.set(id, match);
		else {
			bucket.push(id);
			byHash.set(h, bucket);
			canonical.set(id, id);
		}
	}

	const canonNew = new Map<number, number>();
	const newSprites = new Map<number, Sprite>();
	let next = 1;
	for (const id of usedIds) {
		const canon = canonical.get(id)!;
		if (canon === 0) continue;
		if (!canonNew.has(canon)) {
			const nid = next++;
			canonNew.set(canon, nid);
			newSprites.set(nid, { ...data.sprites.get(canon)!, id: nid });
		}
	}

	const finalRemap = new Map<number, number>();
	for (const id of usedIds) finalRemap.set(id, canonNew.get(canonical.get(id)!) ?? 0);

	const remap = (t: ThingType) => {
		if (t.spriteIndex) t.spriteIndex = t.spriteIndex.map((id) => (id > 0 ? (finalRemap.get(id) ?? 0) : 0));
		for (const g of t.frameGroupsData ?? []) {
			if (g.spriteIndex) g.spriteIndex = g.spriteIndex.map((id) => (id > 0 ? (finalRemap.get(id) ?? 0) : 0));
		}
	};
	for (const t of data.items.values()) remap(t);
	for (const t of data.outfits.values()) remap(t);
	for (const t of data.effects.values()) remap(t);
	for (const t of data.missiles.values()) remap(t);

	data.sprites.clear();
	for (const [nid, sp] of newSprites) data.sprites.set(nid, sp);
	data.spritesCount = next - 1;

	const w = new Uint8Array(4 + newSprites.size * (4 + 4096));
	const dv = new DataView(w.buffer);
	dv.setUint32(0, newSprites.size, true);
	let wo = 4;
	for (const [nid, sp] of newSprites) {
		dv.setUint32(wo, nid, true);
		wo += 4;
		w.set(sp.rgbaPixels, wo);
		wo += 4096;
	}
	await invoke('forge_set_sprites', w);

	const removed: RemovedSprite[] = [];
	const removedByReason: Record<RemovedReason, number> = { empty: 0, unused: 0, duplicate: 0 };
	for (let id = 1; id <= oldTotal; id++) {
		const canon = canonical.get(id);
		if (canon === undefined) {
			removed.push({ id, reason: 'unused' });
			removedByReason.unused++;
		} else if (canon === 0) {
			removed.push({ id, reason: 'empty' });
			removedByReason.empty++;
		} else if (canon !== id) {
			removed.push({ id, duplicateOf: canon, reason: 'duplicate' });
			removedByReason.duplicate++;
		}
	}

	if (onProgress) onProgress('Optimization complete', steps, steps);
	return {
		removed,
		oldTotal,
		removedByReason,
		newTotal: next - 1,
		tempPath: data.sprPath!,
		removedCount: Math.max(0, oldTotal - (next - 1))
	};
}

interface LuaCategoryRendering {
	addon_slots?: boolean;
	frame_groups?: boolean;
	scene_preview?: boolean;
	list_layer_count?: number;
	layer_compositing?: boolean;
	list_pattern_x_clamp?: number;
	reset_frame_on_pause?: boolean;
	skip_first_idle_frame?: boolean;
	default_frame_duration?: number;
}

interface LuaCategory {
	id: string;
	label: string;
	start_id: number;
	rendering?: LuaCategoryRendering;
}

interface LuaFormatMeta {
	id: string;
	ext: string;
	name: string;
	exts: string[];
	sprite_size: number;
	properties?: unknown[];
	kind: 'file' | 'folder';
	alpha_channel?: boolean;
	categories: LuaCategory[];
	load_dialog_title?: string;
	companion?: { ext: string; label: string };
}

interface SchemaKeyField {
	key?: string;
	type?: string;
	valueKey?: string;
	fields?: SchemaKeyField[];
}
interface SchemaKeySection {
	fields?: SchemaKeyField[];
}
const collectSchemaKeys = (schema: unknown[] | undefined): string[] => {
	const out = new Set<string>();
	const walk = (f: SchemaKeyField) => {
		if (f.key) out.add(f.key);
		if (f.valueKey) out.add(f.valueKey);
		if (f.fields) for (const c of f.fields) walk(c);
	};
	for (const s of schema ?? []) {
		const sec = s as SchemaKeySection;
		if (sec.fields) for (const f of sec.fields) walk(f);
	}
	return [...out];
};

const deepCamel = (v: unknown): unknown => {
	if (Array.isArray(v)) return v.map(deepCamel);
	if (v && typeof v === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[toCamelKey(k)] = deepCamel(val);
		return out;
	}
	return v;
};

const toCategoryDef = (c: LuaCategory): CategoryDef => ({
	label: c.label,
	startId: c.start_id,
	id: c.id as ThingCategory,
	rendering: c.rendering
		? {
				addonSlots: !!c.rendering.addon_slots,
				frameGroups: !!c.rendering.frame_groups,
				scenePreview: !!c.rendering.scene_preview,
				listLayerCount: c.rendering.list_layer_count,
				layerCompositing: !!c.rendering.layer_compositing,
				listPatternXClamp: c.rendering.list_pattern_x_clamp,
				resetFrameOnPause: !!c.rendering.reset_frame_on_pause,
				skipFirstIdleFrame: !!c.rendering.skip_first_idle_frame,
				defaultFrameDuration: c.rendering.default_frame_duration ?? 100
			}
		: undefined
});

const toThingType = (t: ForgeThing, name: string): ThingType => {
	const tt: ThingType = {
		id: t.id,
		lensHelp: 0,
		cloth: false,
		clothSlot: 0,
		loopCount: 0,
		usable: false,
		lightLevel: 0,
		lightColor: 0,
		startFrame: 0,
		isFluid: false,
		miniMap: false,
		forceUse: false,
		multiUse: false,
		writable: false,
		hangable: false,
		hasLight: false,
		dontHide: false,
		hasBones: false,
		miniMapColor: 0,
		marketShowAs: 0,
		marketName: name,
		stackable: false,
		rotatable: false,
		wrappable: false,
		topEffect: false,
		maxTextLength: 0,
		marketTradeAs: 0,
		defaultAction: 0,
		animationMode: 0,
		bonesOffsetX: [],
		bonesOffsetY: [],
		pickupable: false,
		isVertical: false,
		isLensHelp: false,
		ignoreLook: false,
		hasCharges: false,
		marketCategory: 0,
		isOnTop: t.isOnTop,
		isContainer: false,
		floorChange: false,
		unwrappable: false,
		frameDurations: [],
		width: t.width || 1,
		writableOnce: false,
		isUnmoveable: false,
		blockMissile: false,
		isHorizontal: false,
		isFullGround: false,
		isMarketItem: false,
		isGround: t.isGround,
		blockPathfind: false,
		isTranslucent: false,
		isLyingObject: false,
		animateAlways: false,
		height: t.height || 1,
		layers: t.layers || 1,
		frames: t.frames || 1,
		hasOffset: t.hasOffset,
		noMoveAnimation: false,
		marketRestrictLevel: 0,
		offsetX: t.offsetX || 0,
		offsetY: t.offsetY || 0,
		isFluidContainer: false,
		hasDefaultAction: false,
		isOnBottom: t.isOnBottom,
		patternX: t.patternX || 1,
		patternY: t.patternY || 1,
		patternZ: t.patternZ || 1,
		elevation: t.elevation || 0,
		marketRestrictProfession: 0,
		exactSize: t.exactSize || 32,
		isUnpassable: t.isUnpassable,
		hasElevation: t.hasElevation,
		category: ThingCategory.ITEM,
		groundSpeed: t.groundSpeed || 0,
		spriteIndex: t.spriteIndex || [],
		isGroundBorder: t.isGroundBorder,
		isAnimation: (t.frames || 1) > 1
	};
	const attrs = t.attrs ?? {};
	const originalKeys: string[] = [];
	for (const [k, v] of Object.entries(attrs)) {
		(tt as unknown as Record<string, unknown>)[toCamelKey(k)] = v;
		originalKeys.push(k);
	}
	(tt as unknown as { _attrKeys?: string[] })._attrKeys = originalKeys;
	return tt;
};

const makeHandler = (meta: LuaFormatMeta): FormatHandler => {
	const config: FormatConfig = {
		name: meta.name,
		spriteSize: meta.sprite_size,
		categories: meta.categories.map(toCategoryDef),
		properties: meta.properties ? (deepCamel(meta.properties) as unknown[]) : undefined
	};
	const version: ClientVersion = {
		value: 0,
		datSignature: 0,
		sprSignature: 0,
		label: meta.name,
		supportsExtended: false,
		supportsAlphaChannel: true,
		supportsFrameDurations: false
	};

	return {
		config,
		id: meta.id,
		exts: meta.exts,
		kind: meta.kind,
		companion: meta.companion,
		optimize: optimizeScripted,
		loadSprites: loadSpritesScripted,
		alphaChannel: !!meta.alpha_channel,
		loadSpritesLz4: loadSpritesScripted,
		loadDialogTitle: meta.load_dialog_title ?? `Select an ${meta.name} file`,

		async compile(req) {
			const { data } = req;
			if (!data.sprPath) throw new Error('No path to save');
			const seen = new Set<Map<number, ThingType>>();
			const things: ThingType[] = [];
			const pushFrom = (m: Map<number, ThingType>) => {
				if (seen.has(m)) return;
				seen.add(m);
				for (const t of m.values()) things.push(t);
			};
			if (data.things) for (const m of data.things.values()) pushFrom(m);
			pushFrom(data.items);
			pushFrom(data.outfits);
			pushFrom(data.effects);
			pushFrom(data.missiles);
			const ids = collectReferencedSpriteIds(things);
			await loadSpritesScripted(data, ids);

			const present = ids.filter((id) => (data.sprites.get(id)?.rgbaPixels?.length ?? 0) === 4096);

			const schemaAttrKeys = collectSchemaKeys(config.properties);
			const wireThings = things.map((t) => {
				const rec = t as unknown as Record<string, unknown>;
				const originalKeys = (rec._attrKeys as string[] | undefined) ?? [];
				const attrs: Record<string, unknown> = {};
				const knownCamel = new Set<string>();
				for (const orig of originalKeys) {
					const camel = toCamelKey(orig);
					attrs[orig] = rec[camel];
					knownCamel.add(camel);
				}
				for (const camel of schemaAttrKeys) {
					if (knownCamel.has(camel)) continue;
					if (!(camel in rec)) continue;
					attrs[toSnakeKey(camel)] = rec[camel];
				}
				const { _attrKeys, ...rest } = rec;
				void _attrKeys;
				return { ...rest, attrs };
			});
			const thingsJson = new TextEncoder().encode(JSON.stringify(wireThings));
			const pathBytes = new TextEncoder().encode(data.sprPath);

			const w = new ByteWriter(2 + pathBytes.length + 4 + thingsJson.length + 4 + present.length * (4 + 4096));
			w.u16(pathBytes.length);
			w.bytes(pathBytes);
			w.u32(thingsJson.length);
			w.bytes(thingsJson);
			w.u32(present.length);
			for (const id of present) {
				w.u32(id);
				w.bytes(data.sprites.get(id)!.rgbaPixels);
			}

			await invoke('backup_file', { path: data.sprPath });
			await invoke('forge_save_assets', w.finish());
			if (data.itemdbPath) {
				const attrs = data.serverItems ? serverItemsToAttrs(data.serverItems) : undefined;
				await invoke('backup_file', { path: data.itemdbPath });
				await invoke('forge_save_itemdb', { attrs, path: data.itemdbPath });
			}
			return null;
		},

		async load(req) {
			const primary = req.filePath ?? req.folderPath;
			const spriteCount = await forgeLoadAssets(primary);

			let itemdbPath: string | undefined;
			if (meta.companion) {
				const compExt = meta.companion.ext;
				const compRe = new RegExp(`\\.${meta.exts[0]}$`, 'i');
				const candidates = req.itemdbPath
					? [req.itemdbPath]
					: [primary.replace(compRe, `.${compExt}`), primary.replace(/[^\\/]+$/, meta.companion.label)];
				for (const cand of candidates) {
					if (cand === primary) continue;
					const ok = await forgeLoadItemdb(cand)
						.then(() => true)
						.catch(() => false);
					if (ok) {
						itemdbPath = cand;
						break;
					}
				}
			}

			const things = await forgeThings();
			const names = new Map<number, string>(await invoke<[number, string][]>('forge_item_names').catch(() => []));

			const items = new Map<number, ThingType>();
			const outfits = new Map<number, ThingType>();
			const effects = new Map<number, ThingType>();
			const missiles = new Map<number, ThingType>();
			const thingsByCat = new Map<string, Map<number, ThingType>>();
			thingsByCat.set('item', items);
			thingsByCat.set('outfit', outfits);
			thingsByCat.set('effect', effects);
			thingsByCat.set('missile', missiles);
			for (const cat of meta.categories) {
				if (!thingsByCat.has(cat.id)) thingsByCat.set(cat.id, new Map());
			}
			const mapFor = (catId: string): Map<number, ThingType> => {
				let m = thingsByCat.get(catId);
				if (!m) {
					m = new Map();
					thingsByCat.set(catId, m);
				}
				return m;
			};
			for (const t of things) {
				const catId = t.category || 'item';
				const tt = toThingType(t, names.get(t.id) ?? '');
				tt.category = catId;
				mapFor(catId).set(t.id, tt);
			}

			let serverItems: undefined | ServerItemData;
			if (itemdbPath) {
				const rows = await invoke<ItemRow[]>('forge_items').catch(() => []);
				if (rows.length > 0) {
					serverItems = buildServerItemData(rows, items, getDefaultProfileId(), version.value, itemdbPath);
				}
			}

			const data: AssetData = {
				items,
				outfits,
				effects,
				version,
				missiles,
				itemdbPath,
				serverItems,
				extended: false,
				datPath: primary,
				sprPath: primary,
				formatId: meta.id,
				frameGroups: false,
				sprites: new Map(),
				things: thingsByCat,
				frameDurations: false,
				itemsCount: items.size,
				spritesCount: spriteCount,
				outfitsCount: outfits.size,
				effectsCount: effects.size,
				missilesCount: missiles.size,
				transparency: !!req.transparency
			};

			return { data, formatConfig: config };
		}
	};
};

export const registerLuaFormats = async (): Promise<void> => {
	const list = await invoke<LuaFormatMeta[]>('forge_list_formats').catch(() => []);
	for (const meta of list) {
		try {
			const handler = makeHandler(meta);
			const tools = await forgeListTools(meta.id).catch(() => []);
			if (tools.length > 0) handler.tools = tools;
			registerFormat(handler);
		} catch (e) {
			console.error(`Failed to register lua format ${meta.id ?? meta.ext}:`, e);
		}
	}
};
