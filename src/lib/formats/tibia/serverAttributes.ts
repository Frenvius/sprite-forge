import tfs04 from './attributes/tfs0.4.xml?raw';
import tfs05 from './attributes/tfs0.5.xml?raw';
import tfs10 from './attributes/tfs1.0.xml?raw';
import tfs11 from './attributes/tfs1.1.xml?raw';
import tfs12 from './attributes/tfs1.2.xml?raw';
import tfs14 from './attributes/tfs1.4.xml?raw';
import tfs16 from './attributes/tfs1.6.xml?raw';
import tfs036 from './attributes/tfs0.3.6.xml?raw';

export type AttrType = 'string' | 'number' | 'boolean';

export interface AttrDef {
	key: string;
	tag: boolean;
	type: AttrType;
	category: string;
	values?: string[];
}

export interface ServerProfile {
	id: string;
	label: string;
	attributes: AttrDef[];
	supportsFromToId: boolean;
	byKey: Map<string, AttrDef>;
}

const RAW: Array<{ id: string; xml: string }> = [
	{ xml: tfs036, id: 'tfs0.3.6' },
	{ xml: tfs04, id: 'tfs0.4' },
	{ xml: tfs05, id: 'tfs0.5' },
	{ xml: tfs10, id: 'tfs1.0' },
	{ xml: tfs11, id: 'tfs1.1' },
	{ xml: tfs12, id: 'tfs1.2' },
	{ xml: tfs14, id: 'tfs1.4' },
	{ xml: tfs16, id: 'tfs1.6' }
];

export const DEFAULT_PROFILE_ID = 'tfs1.6';

export const DEDICATED_KEYS = new Set(['name', 'article', 'plural', 'description']);

function parseProfile(fallbackId: string, xml: string): ServerProfile {
	const doc = new DOMParser().parseFromString(xml, 'application/xml');
	const root = doc.querySelector('attributes');
	const id = root?.getAttribute('server') || fallbackId;
	const label = root?.getAttribute('displayName') || id;
	const supportsFromToId = root?.getAttribute('supportsFromToId') === 'true';

	const attributes: AttrDef[] = [];
	const byKey = new Map<string, AttrDef>();

	for (const cat of Array.from(doc.querySelectorAll('category'))) {
		const category = cat.getAttribute('name') || 'General';
		for (const el of Array.from(cat.querySelectorAll('attribute'))) {
			const key = el.getAttribute('key');
			if (!key) continue;
			const rawType = el.getAttribute('type') || 'string';
			const type: AttrType = rawType === 'number' || rawType === 'boolean' ? rawType : 'string';
			const valuesRaw = el.getAttribute('values');
			const def: AttrDef = {
				key,
				type,
				category,
				tag: el.getAttribute('placement') === 'tag',
				values: valuesRaw ? valuesRaw.split(',').map((v) => v.trim()) : undefined
			};
			attributes.push(def);
			byKey.set(key, def);
		}
	}

	return { id, label, byKey, attributes, supportsFromToId };
}

let cache: null | ServerProfile[] = null;

export function getServerProfiles(): ServerProfile[] {
	if (!cache) cache = RAW.map((r) => parseProfile(r.id, r.xml));
	return cache;
}

export function getServerProfile(id: string): ServerProfile {
	const profiles = getServerProfiles();
	return profiles.find((p) => p.id === id) ?? profiles.find((p) => p.id === DEFAULT_PROFILE_ID) ?? profiles[0];
}

export function defaultValueFor(def: AttrDef): string {
	if (def.values && def.values.length > 0) return def.values[0];
	if (def.type === 'boolean') return '0';
	if (def.type === 'number') return '0';
	return '';
}
