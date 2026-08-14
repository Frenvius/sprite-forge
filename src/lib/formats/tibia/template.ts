import type { ThingType, FormatConfig, ThingCategory } from './types';

import { invoke } from '@tauri-apps/api/core';

import { SPRITE_SIZE, createThingType, TIBIA_FORMAT_CONFIG } from './types';

export const TEMPLATE_VERSION = 1;

export interface TemplateGeometry {
	width: number;
	height: number;
	layers: number;
	frames: number;
	patternX: number;
	patternY: number;
	patternZ: number;
}

export interface TemplateItem {
	label: string;
	cells: number[];
	category: ThingCategory;
	props: Partial<ThingType>;
	geometry: TemplateGeometry;
}

export interface SpriteTemplate {
	name: string;
	tile: number;
	version: number;
	createdAt: string;
	items: TemplateItem[];
	sheet: { cols: number; rows: number };
}

export const GEOMETRY_KEYS: Array<keyof TemplateGeometry> = [
	'width',
	'height',
	'layers',
	'frames',
	'patternX',
	'patternY',
	'patternZ'
];

const NON_PROP_KEYS = new Set<string>([...GEOMETRY_KEYS, 'id', 'category', 'spriteIndex', 'frameGroupsData', 'unknownFlags']);

export const templateCellCount = (geometry: TemplateGeometry): number =>
	geometry.width *
	geometry.height *
	geometry.layers *
	geometry.frames *
	geometry.patternX *
	geometry.patternY *
	geometry.patternZ;

export const templateGeometryOf = (thing: ThingType): TemplateGeometry => ({
	width: thing.width,
	height: thing.height,
	layers: thing.layers,
	frames: thing.frames,
	patternX: thing.patternX,
	patternY: thing.patternY,
	patternZ: thing.patternZ
});

export const templatePropsOf = (thing: ThingType): Partial<ThingType> => {
	const props: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(thing)) {
		if (NON_PROP_KEYS.has(key) || value === undefined) continue;
		props[key] = value;
	}
	return props as Partial<ThingType>;
};

export const templateItemToThing = (
	item: TemplateItem,
	id: number,
	spriteIndex: number[],
	config: FormatConfig = TIBIA_FORMAT_CONFIG
): ThingType => {
	const thing = createThingType(id, item.category, config);
	Object.assign(thing, item.props, item.geometry, { id, spriteIndex, category: item.category });
	if (!thing.exactSize) thing.exactSize = SPRITE_SIZE;
	return thing;
};

export const templateFromThing = (thing: ThingType, cells: number[], label: string): TemplateItem => ({
	label,
	cells,
	props: templatePropsOf(thing),
	geometry: templateGeometryOf(thing),
	category: thing.category as ThingCategory
});

export const listTemplates = async (): Promise<SpriteTemplate[]> => {
	const raw = await invoke<string[]>('list_templates');
	const parsed: SpriteTemplate[] = [];
	for (const entry of raw) {
		try {
			const template = JSON.parse(entry) as SpriteTemplate;
			if (template?.name && Array.isArray(template.items)) parsed.push(template);
		} catch {
			continue;
		}
	}
	return parsed.sort((a, b) => a.name.localeCompare(b.name));
};

export const saveTemplate = async (template: SpriteTemplate): Promise<string> =>
	invoke<string>('save_template', { name: template.name, content: JSON.stringify(template) });

export const deleteTemplate = async (name: string): Promise<void> => invoke('delete_template', { name });
