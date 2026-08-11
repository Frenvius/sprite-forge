import type { ThingType } from '~/lib/formats/tibia/types';

import { toCamelKey, toSnakeKey } from './keys';
import { getServerProfile } from '~/lib/formats/tibia/serverAttributes';
import { type ServerItem, createServerItem, type ServerItemData, createServerItemFromThing } from '~/lib/formats/tibia/otb';

export interface ItemRow {
	id: number;
	name: string;
	kind: number;
	group: number;
	flags: number;
	client: number;
	attrs: Record<string, number | string | boolean>;
}

const ARTICLE = 'article';
const PLURAL = 'plural';

const RESERVED = new Set(['serverId', 'nameXml', 'spriteHash', 'xmlAttributes']);

const coerceForField = (current: unknown, value: number | string | boolean): unknown => {
	if (typeof current === 'boolean') {
		if (typeof value === 'boolean') return value;
		if (typeof value === 'number') return value !== 0;
		const s = String(value).toLowerCase();
		return s !== '' && s !== '0' && s !== 'false';
	}
	if (typeof current === 'number') {
		const n = Number(value);
		return Number.isFinite(n) ? n : 0;
	}
	return String(value);
};

export function buildServerItemData(
	rows: ItemRow[],
	things: Map<number, ThingType>,
	profileId: string,
	clientVersion: number,
	sourcePath: string
): ServerItemData {
	const items = new Map<number, ServerItem>();
	const byClientId = new Map<number, number[]>();

	for (const row of rows) {
		const clientId = row.client > 0 ? row.client : row.id;
		const thing = things.get(clientId);
		const item = thing ? createServerItemFromThing(thing, row.id, clientVersion) : createServerItem(row.id, clientId);

		item.name = row.name;
		item.type = row.group;

		const xmlAttributes: ServerItem['xmlAttributes'] = [];
		for (const [key, value] of Object.entries(row.attrs ?? {})) {
			if (key === ARTICLE) {
				item.article = String(value);
				continue;
			}
			if (key === PLURAL) {
				item.plural = String(value);
				continue;
			}
			const camel = toCamelKey(key);
			if (!RESERVED.has(camel) && camel in item) {
				(item as unknown as Record<string, unknown>)[camel] = coerceForField(
					(item as unknown as Record<string, unknown>)[camel],
					value
				);
				continue;
			}
			xmlAttributes.push({ key, value: typeof value === 'boolean' ? (value ? '1' : '0') : String(value) });
		}
		if (xmlAttributes.length > 0) item.xmlAttributes = xmlAttributes;

		items.set(item.serverId, item);
		const list = byClientId.get(clientId);
		if (list) list.push(item.serverId);
		else byClientId.set(clientId, [item.serverId]);
	}

	return {
		items,
		profileId,
		byClientId,
		xmlExisted: false,
		otbPath: sourcePath,
		meta: { buildNumber: 0, majorVersion: 0, minorVersion: 0 }
	};
}

export function serverItemsToAttrs(data: ServerItemData): Record<number, Record<string, number | string | boolean>> {
	const profile = getServerProfile(data.profileId);
	const out: Record<number, Record<string, number | string | boolean>> = {};

	for (const item of data.items.values()) {
		const bag: Record<string, number | string | boolean> = {};

		// Every scalar field of the item model, snake_cased. The format script
		// picks what it understands and ignores the rest.
		for (const [field, value] of Object.entries(item)) {
			if (RESERVED.has(field)) continue;
			if (typeof value === 'boolean' || typeof value === 'number') bag[toSnakeKey(field)] = value;
			else if (typeof value === 'string' && value.length > 0) bag[toSnakeKey(field)] = value;
		}

		for (const attr of item.xmlAttributes ?? []) {
			const def = profile.byKey.get(attr.key);
			if (def?.type === 'number') {
				const parsed = Number(attr.value);
				bag[attr.key] = Number.isFinite(parsed) ? parsed : 0;
			} else if (def?.type === 'boolean') {
				bag[attr.key] = attr.value !== '' && attr.value !== '0' && attr.value.toLowerCase() !== 'false';
			} else {
				bag[attr.key] = attr.value;
			}
		}

		out[item.serverId] = bag;
	}

	return out;
}
