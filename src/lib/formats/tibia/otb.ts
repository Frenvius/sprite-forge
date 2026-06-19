import type { ThingType, AssetData } from './types';

import { invoke } from '@tauri-apps/api/core';

export const SERVER_ITEM_TYPE = {
	None: 0,
	Ground: 1,
	Fluid: 12,
	Splash: 11,
	Container: 2,
	Deprecated: 14
} as const;

export const TILE_STACK_ORDER = {
	Top: 3,
	None: 0,
	Border: 1,
	Bottom: 2
} as const;

export interface XmlAttr {
	key: string;
	value: string;
	tag?: boolean;
	children?: XmlAttr[];
}

export interface ServerItem {
	type: number;
	name: string;
	tradeAs: number;

	plural?: string;
	serverId: number;
	clientId: number;
	movable: boolean;
	nameXml?: string;
	article?: string;
	multiUse: boolean;
	readable: boolean;
	hangable: boolean;
	hookEast: boolean;
	forceUse: boolean;
	stackable: boolean;
	rotatable: boolean;
	hookSouth: boolean;
	lightLevel: number;
	lightColor: number;
	stackOrder: number;
	unpassable: boolean;
	pickupable: boolean;
	ignoreLook: boolean;
	fullGround: boolean;
	groundSpeed: number;
	canNotDecay: boolean;
	isAnimation: boolean;
	minimapColor: number;
	maxReadChars: number;

	spriteHash: number[];
	hasElevation: boolean;
	blockMissiles: boolean;
	hasStackOrder: boolean;
	clientCharges: boolean;
	blockPathfinder: boolean;
	floorChangeDown: boolean;
	floorChangeEast: boolean;
	floorChangeWest: boolean;
	floorChangeNorth: boolean;

	floorChangeSouth: boolean;
	maxReadWriteChars: number;
	xmlAttributes?: XmlAttr[];
	allowDistanceRead: boolean;
}

interface OtbFileRaw {
	buildNumber: number;
	items: ServerItem[];
	majorVersion: number;
	minorVersion: number;
}

export interface OtbMeta {
	buildNumber: number;
	majorVersion: number;
	minorVersion: number;
}

export interface ServerItemData {
	meta: OtbMeta;
	otbPath: string;
	xmlPath?: string;
	profileId: string;
	xmlExisted: boolean;
	items: Map<number, ServerItem>;
	byClientId: Map<number, number[]>;
}

const PROFILE_IDS = ['tfs0.3.6', 'tfs0.4', 'tfs0.5', 'tfs1.0', 'tfs1.1', 'tfs1.2', 'tfs1.4', 'tfs1.6'];
const PROFILE_MARKER = /<!--\s*sprite-forge:\s*profile=([\w.]+)\s*-->/;

export function deduceProfileId(minorVersion: number): string {
	const v = minorVersion;
	if (v >= 1100) return 'tfs1.6';
	if (v >= 1090) return 'tfs1.2';
	if (v >= 1031) return 'tfs1.1';
	if (v >= 1000) return 'tfs1.0';
	if (v >= 800) return 'tfs0.4';
	return 'tfs0.3.6';
}

function profileCacheKey(otbPath: string): string {
	return `sprite-forge-otb-profile:${otbPath}`;
}

export function loadCachedProfile(otbPath: string): null | string {
	try {
		if (typeof window === 'undefined') return null;
		const v = localStorage.getItem(profileCacheKey(otbPath));
		return v && PROFILE_IDS.includes(v) ? v : null;
	} catch {
		return null;
	}
}

export function saveCachedProfile(otbPath: string, profileId: string): void {
	try {
		if (typeof window !== 'undefined') localStorage.setItem(profileCacheKey(otbPath), profileId);
	} catch {
		void 0;
	}
}

interface ItemsXmlEntry {
	plural?: string;
	nameXml?: string;
	article?: string;
	attributes: XmlAttr[];
}

export async function readOtbRaw(path: string): Promise<OtbFileRaw> {
	return await invoke<OtbFileRaw>('read_otb_file', { path });
}

export async function writeOtbFile(path: string, meta: OtbMeta, items: ServerItem[]): Promise<void> {
	const sorted = [...items].sort((a, b) => a.serverId - b.serverId);
	await invoke('write_otb_file', {
		path,
		data: {
			items: sorted,
			buildNumber: meta.buildNumber,
			majorVersion: meta.majorVersion,
			minorVersion: meta.minorVersion
		}
	});
}

function parseAttributeElements(parent: Element): XmlAttr[] {
	const out: XmlAttr[] = [];
	for (const child of Array.from(parent.children)) {
		if (child.tagName !== 'attribute') continue;
		const key = child.getAttribute('key') ?? '';
		const value = child.getAttribute('value') ?? '';
		const nested = parseAttributeElements(child);
		const attr: XmlAttr = { key, value };
		if (nested.length > 0) attr.children = nested;
		out.push(attr);
	}
	return out;
}

const RESERVED_TAG_ATTRS = new Set(['id', 'fromid', 'toid', 'name', 'article', 'plural']);

export function parseItemsXml(text: string): Map<number, ItemsXmlEntry> {
	const result = new Map<number, ItemsXmlEntry>();
	const doc = new DOMParser().parseFromString(text, 'application/xml');
	if (doc.querySelector('parsererror')) {
		throw new Error('items.xml is not valid XML');
	}

	const buildEntry = (el: Element): ItemsXmlEntry => {
		const tagAttrs: XmlAttr[] = [];
		for (const attr of Array.from(el.attributes)) {
			if (RESERVED_TAG_ATTRS.has(attr.name)) continue;
			tagAttrs.push({ tag: true, key: attr.name, value: attr.value });
		}
		return {
			nameXml: el.getAttribute('name') ?? undefined,
			plural: el.getAttribute('plural') ?? undefined,
			article: el.getAttribute('article') ?? undefined,
			attributes: [...tagAttrs, ...parseAttributeElements(el)]
		};
	};

	for (const el of Array.from(doc.querySelectorAll('items > item, item'))) {
		const idAttr = el.getAttribute('id');
		const fromId = el.getAttribute('fromid');
		const toId = el.getAttribute('toid');

		if (idAttr != null) {
			const id = parseInt(idAttr, 10);
			if (!Number.isNaN(id)) result.set(id, buildEntry(el));
		} else if (fromId != null && toId != null) {
			const from = parseInt(fromId, 10);
			const to = parseInt(toId, 10);
			if (!Number.isNaN(from) && !Number.isNaN(to) && to - from < 100000) {
				for (let id = from; id <= to; id++) result.set(id, buildEntry(el));
			}
		}
	}

	return result;
}

export function buildServerItems(
	otb: OtbFileRaw,
	xml: null | Map<number, ItemsXmlEntry>,
	otbPath: string,
	xmlPath: string,
	xmlExisted: boolean,
	profileId: string
): ServerItemData {
	const items = new Map<number, ServerItem>();
	const byClientId = new Map<number, number[]>();

	for (const raw of otb.items) {
		const item: ServerItem = { ...raw };
		const x = xml?.get(raw.serverId);
		if (x) {
			item.nameXml = x.nameXml;
			item.article = x.article;
			item.plural = x.plural;
			item.xmlAttributes = x.attributes.length > 0 ? x.attributes : undefined;
		}
		items.set(item.serverId, item);

		const list = byClientId.get(item.clientId);
		if (list) list.push(item.serverId);
		else byClientId.set(item.clientId, [item.serverId]);
	}

	return {
		items,
		otbPath,
		xmlPath,
		profileId,
		xmlExisted,
		byClientId,
		meta: {
			buildNumber: otb.buildNumber,
			majorVersion: otb.majorVersion,
			minorVersion: otb.minorVersion
		}
	};
}

function deriveXmlPath(otbPath: string): string {
	const sep = otbPath.includes('\\') ? '\\' : '/';
	const dir = otbPath.slice(0, otbPath.lastIndexOf(sep) + 1);
	return `${dir}items.xml`;
}

export async function loadServerItems(otbPath: string, xmlPath?: string): Promise<ServerItemData> {
	const otb = await readOtbRaw(otbPath);
	let xml: null | Map<number, ItemsXmlEntry> = null;
	let markerProfile: null | string = null;
	const xmlExisted = !!xmlPath;
	if (xmlPath) {
		try {
			const text = await invoke<string>('read_file_text', { path: xmlPath });
			xml = parseItemsXml(text);
			const m = text.match(PROFILE_MARKER);
			if (m && PROFILE_IDS.includes(m[1])) markerProfile = m[1];
		} catch (err) {
			console.error('Failed to read items.xml:', err);
		}
	}
	const writeXmlPath = xmlPath ?? deriveXmlPath(otbPath);
	const profileId = markerProfile ?? loadCachedProfile(otbPath) ?? deduceProfileId(otb.minorVersion);
	return buildServerItems(otb, xml, otbPath, writeXmlPath, xmlExisted, profileId);
}

export function createServerItem(serverId: number, clientId: number): ServerItem {
	return {
		serverId,
		clientId,
		name: '',
		tradeAs: 0,
		lightLevel: 0,
		lightColor: 0,
		movable: false,
		groundSpeed: 0,
		spriteHash: [],
		multiUse: false,
		readable: false,
		hangable: false,
		hookEast: false,
		forceUse: false,
		minimapColor: 0,
		maxReadChars: 0,
		stackable: false,
		rotatable: false,
		hookSouth: false,
		unpassable: false,
		pickupable: false,
		ignoreLook: false,
		fullGround: false,
		canNotDecay: false,
		isAnimation: false,
		hasElevation: false,
		blockMissiles: false,
		hasStackOrder: false,
		clientCharges: false,
		maxReadWriteChars: 0,
		blockPathfinder: false,
		floorChangeDown: false,
		floorChangeEast: false,
		floorChangeWest: false,
		floorChangeNorth: false,
		floorChangeSouth: false,
		allowDistanceRead: false,
		type: SERVER_ITEM_TYPE.None,
		stackOrder: TILE_STACK_ORDER.None
	};
}

function thingType(thing: ThingType): number {
	if (thing.isGround) return SERVER_ITEM_TYPE.Ground;
	if (thing.isContainer) return SERVER_ITEM_TYPE.Container;
	if (thing.isFluidContainer) return SERVER_ITEM_TYPE.Fluid;
	if (thing.isFluid) return SERVER_ITEM_TYPE.Splash;
	return SERVER_ITEM_TYPE.None;
}

export function syncFromThingType(server: ServerItem, thing: ThingType, syncType: boolean, clientVersion: number): void {
	if (syncType) {
		server.type = thingType(thing);
	}

	server.unpassable = thing.isUnpassable;
	server.blockMissiles = thing.blockMissile;
	server.blockPathfinder = thing.blockPathfind;
	server.hasElevation = thing.hasElevation;
	server.multiUse = thing.multiUse;
	server.pickupable = thing.pickupable;
	server.movable = !thing.isUnmoveable;
	server.stackable = thing.stackable;
	server.readable = thing.writable || thing.writableOnce || (thing.isLensHelp && thing.lensHelp === 1112);
	server.rotatable = thing.rotatable;
	server.hangable = thing.hangable;
	server.hookSouth = thing.isVertical;
	server.hookEast = thing.isHorizontal;
	server.ignoreLook = thing.ignoreLook;
	server.allowDistanceRead = false;

	if (clientVersion >= 1010) {
		server.forceUse = thing.forceUse;
		server.fullGround = thing.isFullGround;
	} else {
		server.forceUse = false;
		server.fullGround = false;
	}

	server.clientCharges = false;
	server.isAnimation = thing.frames > 1;

	server.lightLevel = thing.lightLevel;
	server.lightColor = thing.lightColor;

	if (thing.isGround) {
		server.groundSpeed = thing.groundSpeed;
	}

	server.minimapColor = thing.miniMapColor;
	server.maxReadWriteChars = thing.writable ? thing.maxTextLength : 0;
	server.maxReadChars = thing.writableOnce ? thing.maxTextLength : 0;

	if (thing.isGroundBorder) {
		server.stackOrder = TILE_STACK_ORDER.Border;
		server.hasStackOrder = true;
	} else if (thing.isOnBottom) {
		server.stackOrder = TILE_STACK_ORDER.Bottom;
		server.hasStackOrder = true;
	} else if (thing.isOnTop) {
		server.stackOrder = TILE_STACK_ORDER.Top;
		server.hasStackOrder = true;
	} else {
		server.stackOrder = TILE_STACK_ORDER.None;
		server.hasStackOrder = false;
	}

	if (thing.marketName && thing.marketName.length > 0) {
		server.name = thing.marketName;
	}
	if (thing.marketTradeAs !== 0) {
		server.tradeAs = thing.marketTradeAs;
	}
}

export function createServerItemFromThing(thing: ThingType, serverId: number, clientVersion: number): ServerItem {
	const item = createServerItem(serverId, thing.id);
	syncFromThingType(item, thing, true, clientVersion);
	item.spriteHash = new Array(16).fill(0);
	return item;
}

export interface OtbReconcileResult {
	synced: number;
	created: number;
}

export function reconcileServerItems(data: AssetData, autoSync: boolean, clientVersion: number): OtbReconcileResult {
	const sd = data.serverItems;
	if (!sd) return { synced: 0, created: 0 };

	let maxServerId = 0;
	for (const id of sd.items.keys()) if (id > maxServerId) maxServerId = id;

	let created = 0;
	let synced = 0;

	for (const thing of data.items.values()) {
		const serverIds = sd.byClientId.get(thing.id);
		if (serverIds && serverIds.length > 0) {
			if (autoSync) {
				for (const sid of serverIds) {
					const server = sd.items.get(sid);
					if (server) {
						syncFromThingType(server, thing, false, clientVersion);
						synced++;
					}
				}
			}
		} else {
			const newItem = createServerItemFromThing(thing, ++maxServerId, clientVersion);
			sd.items.set(newItem.serverId, newItem);
			sd.byClientId.set(thing.id, [newItem.serverId]);
			created++;
		}
	}

	return { synced, created };
}

function escapeXml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hasXmlData(item: ServerItem): boolean {
	return !!(
		(item.nameXml && item.nameXml.length > 0) ||
		(item.article && item.article.length > 0) ||
		(item.plural && item.plural.length > 0) ||
		(item.xmlAttributes && item.xmlAttributes.length > 0)
	);
}

function writeAttrs(attrs: XmlAttr[], indent: string): string {
	let out = '';
	for (const attr of attrs) {
		if (attr.children && attr.children.length > 0) {
			const valuePart = attr.value ? ` value="${escapeXml(attr.value)}"` : '';
			out += `${indent}<attribute key="${escapeXml(attr.key)}"${valuePart}>\n`;
			out += writeAttrs(attr.children, indent + '\t');
			out += `${indent}</attribute>\n`;
		} else {
			out += `${indent}<attribute key="${escapeXml(attr.key)}" value="${escapeXml(attr.value)}" />\n`;
		}
	}
	return out;
}

function xmlSignature(item: ServerItem): string {
	return JSON.stringify([item.nameXml ?? '', item.article ?? '', item.plural ?? '', item.xmlAttributes ?? []]);
}

function writeItemTag(start: ServerItem, end: null | ServerItem): string {
	let tag = '\t<item';
	if (end && end.serverId !== start.serverId) {
		tag += ` fromid="${start.serverId}" toid="${end.serverId}"`;
	} else {
		tag += ` id="${start.serverId}"`;
	}
	if (start.article && start.article.length > 0) tag += ` article="${escapeXml(start.article)}"`;
	if (start.nameXml != null) tag += ` name="${escapeXml(start.nameXml)}"`;
	if (start.plural && start.plural.length > 0) tag += ` plural="${escapeXml(start.plural)}"`;

	const all = start.xmlAttributes ?? [];
	for (const attr of all) {
		if (attr.tag) tag += ` ${attr.key}="${escapeXml(attr.value)}"`;
	}

	const children = all.filter((a) => !a.tag);
	if (children.length > 0) {
		tag += '>\n';
		tag += writeAttrs(children, '\t\t');
		tag += '\t</item>\n';
	} else {
		tag += ' />\n';
	}
	return tag;
}

export function serializeItemsXml(items: ServerItem[], profileId?: string): string {
	const sorted = [...items].sort((a, b) => a.serverId - b.serverId);

	let body = '';
	let i = 0;
	while (i < sorted.length) {
		const item = sorted[i];
		if (!hasXmlData(item)) {
			i++;
			continue;
		}

		const sig = xmlSignature(item);
		const hasChildren = (item.xmlAttributes?.length ?? 0) > 0;
		let end = i;
		if (!hasChildren) {
			while (
				end + 1 < sorted.length &&
				sorted[end + 1].serverId === sorted[end].serverId + 1 &&
				hasXmlData(sorted[end + 1]) &&
				(sorted[end + 1].xmlAttributes?.length ?? 0) === 0 &&
				xmlSignature(sorted[end + 1]) === sig
			) {
				end++;
			}
		}

		body += writeItemTag(item, end > i ? sorted[end] : null);
		i = end + 1;
	}

	const marker = profileId ? `\t<!-- sprite-forge: profile=${profileId} -->\n` : '';
	return `<?xml version="1.0" encoding="UTF-8"?>\n<items>\n${marker}${body}</items>\n`;
}

export async function writeItemsXml(path: string, items: ServerItem[], profileId?: string): Promise<void> {
	const content = serializeItemsXml(items, profileId);
	await invoke('write_json_file', { path, content });
}

export async function compileServerItems(data: AssetData, autoSync: boolean, clientVersion: number): Promise<OtbReconcileResult> {
	const sd = data.serverItems;
	if (!sd) return { synced: 0, created: 0 };

	const result = reconcileServerItems(data, autoSync, clientVersion);

	const items = Array.from(sd.items.values());
	await writeOtbFile(sd.otbPath, sd.meta, items);
	if (sd.xmlPath && (sd.xmlExisted || items.some(hasXmlData))) {
		await writeItemsXml(sd.xmlPath, items, sd.profileId);
	}

	return result;
}
