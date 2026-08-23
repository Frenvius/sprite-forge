export type ThingCategory = string;
export const ThingCategory = {
	ITEM: 'item' as ThingCategory,
	OUTFIT: 'outfit' as ThingCategory,
	EFFECT: 'effect' as ThingCategory,
	MISSILE: 'missile' as ThingCategory
} as const;

export const THING_CATEGORY_VALUES: Record<string, number> = {
	[ThingCategory.ITEM]: 1,
	[ThingCategory.OUTFIT]: 2,
	[ThingCategory.EFFECT]: 3,
	[ThingCategory.MISSILE]: 4
};

export const SPRITE_SIZE = 32;
export const SPRITE_PIXELS = SPRITE_SIZE * SPRITE_SIZE;
export const SPRITE_DATA_SIZE = SPRITE_PIXELS * 4;

export const DAT_FILE_POSITIONS = {
	SIGNATURE: 0,
	ITEMS_COUNT: 4,
	OUTFITS_COUNT: 6,
	EFFECTS_COUNT: 8,
	MISSILES_COUNT: 10
} as const;

export const SPR_FILE_POSITIONS = {
	LENGTH: 4,
	SIGNATURE: 0
} as const;

export const SPR_FILE_SIZES = {
	ADDRESS: 4,
	HEADER_U16: 6,
	HEADER_U32: 8
} as const;

export interface CategoryRenderConfig {
	addonSlots: boolean;
	frameGroups: boolean;
	scenePreview: boolean;
	listLayerCount?: number;
	layerCompositing: boolean;
	listPatternXClamp?: number;
	resetFrameOnPause: boolean;
	skipFirstIdleFrame: boolean;
	defaultFrameDuration: number;
}

export interface CategoryDef {
	label: string;
	startId: number;
	id: ThingCategory;
	base?: ThingCategory;
	defaults?: Partial<ThingType>;
	rendering?: CategoryRenderConfig;
}

export interface FormatConfig {
	name: string;
	spriteSize: number;
	properties?: unknown[];
	categories: CategoryDef[];
}

export const TIBIA_FORMAT_CONFIG: FormatConfig = {
	name: 'Tibia',
	spriteSize: 32,
	categories: [
		{
			startId: 100,
			label: 'Item',
			id: ThingCategory.ITEM,
			rendering: {
				addonSlots: false,
				frameGroups: false,
				scenePreview: false,
				layerCompositing: false,
				resetFrameOnPause: false,
				defaultFrameDuration: 500,
				skipFirstIdleFrame: false
			}
		},
		{
			startId: 1,
			label: 'Outfit',
			id: ThingCategory.OUTFIT,
			defaults: { frames: 3, patternX: 4, isAnimation: true },
			rendering: {
				addonSlots: true,
				listLayerCount: 1,
				frameGroups: true,
				scenePreview: true,
				listPatternXClamp: 2,
				layerCompositing: true,
				resetFrameOnPause: true,
				skipFirstIdleFrame: true,
				defaultFrameDuration: 300
			}
		},
		{
			startId: 1,
			label: 'Effect',
			id: ThingCategory.EFFECT,
			rendering: {
				addonSlots: false,
				frameGroups: false,
				scenePreview: false,
				layerCompositing: false,
				resetFrameOnPause: false,
				defaultFrameDuration: 100,
				skipFirstIdleFrame: false
			}
		},
		{
			startId: 1,
			label: 'Missile',
			id: ThingCategory.MISSILE,
			defaults: { patternX: 3, patternY: 3 },
			rendering: {
				addonSlots: false,
				frameGroups: false,
				scenePreview: false,
				layerCompositing: false,
				defaultFrameDuration: 75,
				resetFrameOnPause: false,
				skipFirstIdleFrame: false
			}
		}
	]
};

export interface FrameDuration {
	minimum: number;
	maximum: number;
}

export interface Sprite {
	id: number;
	isEmpty: boolean;
	pixels?: Uint8Array;
	transparent: boolean;
	imageData?: ImageData;
	rgbaPixels: Uint8Array;
	compressedPixels?: Uint8Array;
}

export interface ThingType {
	id: number;
	width: number;
	height: number;
	layers: number;
	frames: number;
	cloth: boolean;
	offsetX: number;
	offsetY: number;
	usable: boolean;
	patternX: number;

	patternY: number;
	patternZ: number;
	isOnTop: boolean;
	isFluid: boolean;
	miniMap: boolean;

	lensHelp: number;
	exactSize: number;
	isGround: boolean;
	forceUse: boolean;

	multiUse: boolean;
	writable: boolean;
	hangable: boolean;

	hasLight: boolean;
	dontHide: boolean;
	elevation: number;
	clothSlot: number;

	loopCount: number;
	hasBones: boolean;
	stackable: boolean;
	rotatable: boolean;
	lightLevel: number;
	lightColor: number;

	hasOffset: boolean;
	marketName: string;
	wrappable: boolean;
	topEffect: boolean;
	startFrame: number;

	groundSpeed: number;
	isOnBottom: boolean;
	pickupable: boolean;

	isVertical: boolean;
	isLensHelp: boolean;
	ignoreLook: boolean;

	hasCharges: boolean;
	isContainer: boolean;
	floorChange: boolean;

	miniMapColor: number;
	marketShowAs: number;

	unwrappable: boolean;
	isAnimation: boolean;
	spriteIndex: number[];

	writableOnce: boolean;
	maxTextLength: number;
	isUnpassable: boolean;
	isUnmoveable: boolean;
	blockMissile: boolean;
	isHorizontal: boolean;
	hasElevation: boolean;
	isFullGround: boolean;

	isMarketItem: boolean;
	marketTradeAs: number;

	defaultAction: number;
	animationMode: number;
	bonesOffsetX: number[];
	bonesOffsetY: number[];
	blockPathfind: boolean;
	isTranslucent: boolean;
	isLyingObject: boolean;

	animateAlways: boolean;
	marketCategory: number;
	frameGroups?: number[];
	isGroundBorder: boolean;
	noMoveAnimation: boolean;
	isFluidContainer: boolean;
	hasDefaultAction: boolean;

	texturePatterns?: number[];
	marketRestrictLevel: number;
	upgradeClassification?: number;
	frameGroupsData?: FrameGroup[];
	frameDurations: FrameDuration[];
	category: string | ThingCategory;
	marketRestrictProfession: number;
	unknownFlags?: Array<{ orig: number; remapped: number }>;
}

export interface FrameGroup {
	type: number;
	width: number;
	height: number;
	layers: number;
	frames: number;
	patternX: number;
	patternY: number;
	patternZ: number;
	exactSize: number;
	loopCount?: number;
	startFrame?: number;
	isAnimation: boolean;
	spriteIndex: number[];
	animationMode?: number;
	frameDurations?: FrameDuration[];
}

export enum MarketCategory {
	Food = 6,
	Legs = 8,
	Boots = 3,
	Axes = 17,
	Armors = 1,
	Others = 9,
	Rings = 11,
	Runes = 12,
	Tools = 14,
	Clubs = 18,
	Amulets = 2,
	Swords = 20,
	Potions = 10,
	Shields = 13,
	Distance = 19,
	Containers = 4,
	Decoration = 5,
	Valuables = 15,
	Ammunition = 16,
	Wands_Rods = 21,
	Helmets_Hats = 7,
	Tibia_Coins = 23,
	Premium_Scrolls = 22,
	Creature_Products = 24
}

export interface ClientVersion {
	value: number;
	label: string;
	datSignature: number;
	sprSignature: number;
	supportsExtended: boolean;
	supportsAlphaChannel: boolean;
	supportsFrameDurations: boolean;
}

export interface AssetData {
	datPath?: string;
	sprPath?: string;
	otbPath?: string;
	xmlPath?: string;
	formatId?: string;
	extended: boolean;
	itemsCount: number;
	itemdbPath?: string;
	spritesCount: number;

	outfitsCount: number;
	effectsCount: number;
	frameGroups: boolean;
	transparency: boolean;
	missilesCount: number;

	version: ClientVersion;
	frameDurations: boolean;
	sprites: Map<number, Sprite>;
	items: Map<number, ThingType>;
	outfits: Map<number, ThingType>;
	effects: Map<number, ThingType>;
	missiles: Map<number, ThingType>;
	things?: Map<string, Map<number, ThingType>>;
	serverItems?: import('./otb').ServerItemData;
}

export function isValidSpriteId(spriteId: number, spritesCount?: number): boolean {
	if (spriteId <= 0) return false;
	if (spritesCount !== undefined && spriteId > spritesCount) return false;
	return true;
}

export function getTextureIndex(
	thing: ThingType,
	layer: number,
	patternX: number,
	patternY: number,
	patternZ: number,
	frame: number
): number {
	return (
		((((frame % thing.frames) * thing.patternZ + patternZ) * thing.patternY + patternY) * thing.patternX + patternX) *
			thing.layers +
		layer
	);
}

export function getSpriteIndex(
	thing: ThingType,
	width: number,
	height: number,
	layer: number,
	patternX: number,
	patternY: number,
	patternZ: number,
	frame: number
): number {
	return (
		((((((frame % thing.frames) * thing.patternZ + patternZ) * thing.patternY + patternY) * thing.patternX + patternX) *
			thing.layers +
			layer) *
			thing.height +
			height) *
			thing.width +
		width
	);
}

let virtualBaseResolver: (cat: string) => string = (c) => c;

export function setVirtualCategoryResolver(fn: (cat: string) => string): void {
	virtualBaseResolver = fn;
}

export function resolveBaseCategory(category: string | ThingCategory): string {
	return virtualBaseResolver(String(category));
}

export function getCategoryMap(data: AssetData, category: string | ThingCategory): Map<number, ThingType> {
	const resolved = virtualBaseResolver(String(category));
	switch (resolved) {
		case ThingCategory.ITEM:
			return data.items;
		case ThingCategory.OUTFIT:
			return data.outfits;
		case ThingCategory.EFFECT:
			return data.effects;
		case ThingCategory.MISSILE:
			return data.missiles;
	}
	if (!data.things) data.things = new Map();
	let m = data.things.get(resolved);
	if (!m) {
		m = new Map();
		data.things.set(resolved, m);
	}
	return m;
}

export function getCategoryCount(data: AssetData, category: string | ThingCategory): number {
	const resolved = virtualBaseResolver(String(category));
	switch (resolved) {
		case ThingCategory.ITEM:
			return data.itemsCount;
		case ThingCategory.OUTFIT:
			return data.outfitsCount;
		case ThingCategory.EFFECT:
			return data.effectsCount;
		case ThingCategory.MISSILE:
			return data.missilesCount;
	}
	return data.things?.get(resolved)?.size ?? 0;
}

export function setCategoryCount(data: AssetData, category: string | ThingCategory, count: number): void {
	const resolved = virtualBaseResolver(String(category));
	switch (resolved) {
		case ThingCategory.ITEM:
			data.itemsCount = count;
			return;
		case ThingCategory.OUTFIT:
			data.outfitsCount = count;
			return;
		case ThingCategory.EFFECT:
			data.effectsCount = count;
			return;
		case ThingCategory.MISSILE:
			data.missilesCount = count;
			return;
	}
}

export function getCategoryStartId(config: FormatConfig, category: string | ThingCategory): number {
	return config.categories.find((c) => c.id === category)?.startId ?? 1;
}

export function isVirtualCategory(config: FormatConfig, category: string | ThingCategory): boolean {
	const cat = config.categories.find((c) => c.id === category);
	return !!(cat?.base && cat.base !== cat.id);
}

export function toDisplayId(config: FormatConfig, category: string | ThingCategory, actualId: number): number {
	if (!isVirtualCategory(config, category)) return actualId;
	const startId = getCategoryStartId(config, category);
	return actualId - startId + 1;
}

export function fromDisplayId(config: FormatConfig, category: string | ThingCategory, displayId: number): number {
	if (!isVirtualCategory(config, category)) return displayId;
	const startId = getCategoryStartId(config, category);
	return displayId + startId - 1;
}

export function getCategoryRange(config: FormatConfig, category: string | ThingCategory): [number, number] {
	const cat = config.categories.find((c) => c.id === category);
	if (!cat) return [1, Number.POSITIVE_INFINITY];
	const base = cat.base ?? cat.id;
	const siblings = config.categories.filter((c) => (c.base ?? c.id) === base);
	const nextStart = siblings
		.map((c) => c.startId)
		.sort((a, b) => a - b)
		.find((s) => s > cat.startId);
	return [cat.startId, nextStart ? nextStart - 1 : Number.POSITIVE_INFINITY];
}

export function* iterAllThings(data: AssetData): Generator<ThingType> {
	const seen = new Set<Map<number, ThingType>>();
	const visit = (m: Map<number, ThingType>) => seen.add(m);
	const emit = function* (m: Map<number, ThingType>): Generator<ThingType> {
		if (seen.has(m)) return;
		visit(m);
		for (const t of m.values()) yield t;
	};
	yield* emit(data.items);
	yield* emit(data.outfits);
	yield* emit(data.effects);
	yield* emit(data.missiles);
	if (data.things) {
		for (const m of data.things.values()) yield* emit(m);
	}
}

export function getCategoryRenderConfig(
	config: FormatConfig,
	category: string | ThingCategory
): undefined | CategoryRenderConfig {
	return config.categories.find((c) => c.id === category)?.rendering;
}

export function createThingType(id: number, category: string | ThingCategory, config?: FormatConfig): ThingType {
	const thing: ThingType = {
		id,
		category,
		width: 1,
		height: 1,
		layers: 1,
		frames: 1,
		offsetX: 0,
		offsetY: 0,
		patternX: 1,
		patternY: 1,
		patternZ: 1,
		lensHelp: 0,
		elevation: 0,
		cloth: false,
		clothSlot: 0,
		loopCount: 0,
		lightLevel: 0,
		lightColor: 0,
		usable: false,
		startFrame: 0,
		groundSpeed: 0,
		isOnTop: false,
		isFluid: false,
		miniMap: false,
		marketName: '',
		spriteIndex: [],
		isGround: false,
		forceUse: false,
		multiUse: false,
		writable: false,
		hangable: false,
		hasLight: false,
		dontHide: false,
		miniMapColor: 0,
		marketShowAs: 0,
		hasBones: false,
		stackable: false,
		maxTextLength: 0,
		rotatable: false,
		hasOffset: false,
		marketTradeAs: 0,
		defaultAction: 0,
		wrappable: false,
		topEffect: false,
		animationMode: 0,
		bonesOffsetX: [],
		bonesOffsetY: [],
		isOnBottom: false,
		pickupable: false,
		isVertical: false,
		isLensHelp: false,
		ignoreLook: false,
		marketCategory: 0,
		hasCharges: false,
		isContainer: false,
		floorChange: false,
		unwrappable: false,
		isAnimation: false,
		frameDurations: [],
		writableOnce: false,
		isUnpassable: false,
		isUnmoveable: false,
		blockMissile: false,
		isHorizontal: false,
		hasElevation: false,
		isFullGround: false,
		isMarketItem: false,
		blockPathfind: false,
		isTranslucent: false,
		isLyingObject: false,
		animateAlways: false,
		isGroundBorder: false,
		exactSize: SPRITE_SIZE,
		noMoveAnimation: false,
		marketRestrictLevel: 0,
		isFluidContainer: false,
		hasDefaultAction: false,
		marketRestrictProfession: 0
	};

	const categoryDef = config?.categories.find((c) => c.id === category);
	if (categoryDef?.defaults) {
		Object.assign(thing, categoryDef.defaults);
	} else if (!config) {
		if (category === ThingCategory.OUTFIT) {
			thing.patternX = 4;
			thing.frames = 3;
			thing.isAnimation = true;
		} else if (category === ThingCategory.MISSILE) {
			thing.patternX = 3;
			thing.patternY = 3;
		}
	}

	return thing;
}

export const CLIENT_VERSIONS: ClientVersion[] = [
	{
		value: 710,
		label: '7.10',
		supportsExtended: false,
		datSignature: 0x3dff4b2a,
		sprSignature: 0x3dff4aeb,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 730,
		label: '7.30',
		supportsExtended: false,
		datSignature: 0x411a6233,
		sprSignature: 0x411a6279,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 740,
		label: '7.40',
		supportsExtended: false,
		datSignature: 0x41bf619c,
		sprSignature: 0x41b9ea86,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 750,
		label: '7.50',
		supportsExtended: false,
		datSignature: 0x42f81973,
		sprSignature: 0x42f81949,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 755,
		label: '7.55',
		supportsExtended: false,
		datSignature: 0x437b2b8f,
		sprSignature: 0x434f9cde,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 760,
		label: '7.60',
		supportsExtended: false,
		datSignature: 0x439d5a33,
		sprSignature: 0x439852be,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 770,
		label: '7.70',
		supportsExtended: false,
		datSignature: 0x439d5a33,
		sprSignature: 0x439852be,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 780,
		label: '7.80',
		supportsExtended: false,
		datSignature: 0x44ce4743,
		sprSignature: 0x44ce4206,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 790,
		label: '7.90',
		supportsExtended: false,
		datSignature: 0x457d854e,
		sprSignature: 0x457957c8,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 792,
		label: '7.92',
		supportsExtended: false,
		datSignature: 0x459e7b73,
		sprSignature: 0x45880fe8,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 800,
		label: '8.00',
		supportsExtended: false,
		datSignature: 0x467fd7e6,
		sprSignature: 0x467f9e74,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 810,
		label: '8.10',
		supportsExtended: false,
		datSignature: 0x475d3747,
		sprSignature: 0x475d0b01,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 811,
		label: '8.11',
		supportsExtended: false,
		datSignature: 0x47f60e37,
		sprSignature: 0x47ebb9b2,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 820,
		label: '8.20',
		supportsExtended: false,
		datSignature: 0x486905aa,
		sprSignature: 0x4868ecc9,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 830,
		label: '8.30',
		supportsExtended: false,
		datSignature: 0x48da1fb6,
		sprSignature: 0x48c8e712,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 840,
		label: '8.40',
		supportsExtended: false,
		datSignature: 0x493d607a,
		sprSignature: 0x493d4e7c,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 841,
		label: '8.41',
		supportsExtended: false,
		datSignature: 0x49b7cc19,
		sprSignature: 0x49b140ea,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 842,
		label: '8.42',
		supportsExtended: false,
		datSignature: 0x49c233c9,
		sprSignature: 0x49b140ea,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 850,
		label: '8.50 v1',
		supportsExtended: false,
		datSignature: 0x4a49c5eb,
		sprSignature: 0x4a44fd4e,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 850,
		label: '8.50 v2',
		supportsExtended: false,
		datSignature: 0x4a4cc0dc,
		sprSignature: 0x4a44fd4e,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 850,
		label: '8.50 v3',
		supportsExtended: false,
		datSignature: 0x4ae97492,
		sprSignature: 0x4acb5230,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 852,
		label: '8.52',
		supportsExtended: false,
		datSignature: 0x4a4cc0dc,
		sprSignature: 0x4a44fd4e,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 853,
		label: '8.53',
		supportsExtended: false,
		datSignature: 0x4ae97492,
		sprSignature: 0x4acb5230,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 854,
		label: '8.54 v1',
		supportsExtended: false,
		datSignature: 0x4b1e2caa,
		sprSignature: 0x4b1e2c87,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 854,
		label: '8.54 v2',
		supportsExtended: false,
		datSignature: 0x4b0d46a9,
		sprSignature: 0x4b0d3aff,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 854,
		label: '8.54 v3',
		supportsExtended: false,
		datSignature: 0x4b28b89e,
		sprSignature: 0x4b1e2c87,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 855,
		label: '8.55',
		supportsExtended: false,
		datSignature: 0x4b98ff53,
		sprSignature: 0x4b913871,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 860,
		label: '8.60 v1',
		supportsExtended: false,
		datSignature: 0x4c28b721,
		sprSignature: 0x4c220594,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 860,
		label: '8.60 v2',
		supportsExtended: false,
		datSignature: 0x4c2c7993,
		sprSignature: 0x4c220594,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 861,
		label: '8.61',
		supportsExtended: false,
		datSignature: 0x4c6a4cbc,
		sprSignature: 0x4c63f145,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 862,
		label: '8.62',
		supportsExtended: false,
		datSignature: 0x4c973450,
		sprSignature: 0x4c63f145,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 870,
		label: '8.70',
		supportsExtended: false,
		datSignature: 0x4cfe22c5,
		sprSignature: 0x4cfd078a,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 871,
		label: '8.71',
		supportsExtended: false,
		datSignature: 0x4d41979e,
		sprSignature: 0x4d3d65d0,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 872,
		label: '8.72',
		supportsExtended: false,
		datSignature: 0x4dad1a1a,
		sprSignature: 0x4dad1a32,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 900,
		label: '9.00',
		supportsExtended: false,
		datSignature: 0x4dbaa20b,
		sprSignature: 0x4dad1a32,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 910,
		label: '9.10',
		supportsExtended: false,
		datSignature: 0x4e12daff,
		sprSignature: 0x4e12db27,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 920,
		label: '9.20',
		supportsExtended: false,
		datSignature: 0x4e807c08,
		sprSignature: 0x4e807c23,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 940,
		label: '9.40',
		supportsExtended: false,
		datSignature: 0x4ee71de5,
		sprSignature: 0x4ee71e06,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 944,
		label: '9.44 v0',
		supportsExtended: false,
		datSignature: 0x4f0eefbb,
		sprSignature: 0x4f0eefef,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 944,
		label: '9.44 v1',
		supportsExtended: false,
		datSignature: 0x4f105168,
		sprSignature: 0x4f1051d7,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 944,
		label: '9.44 v2',
		supportsExtended: false,
		datSignature: 0x4f16c0d7,
		sprSignature: 0x4f1051d7,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 944,
		label: '9.44 v3',
		supportsExtended: false,
		datSignature: 0x4f3131cf,
		sprSignature: 0x4f3131f6,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 946,
		label: '9.46',
		supportsExtended: false,
		datSignature: 0x4f75b7ab,
		sprSignature: 0x4f5dcef7,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 950,
		label: '9.50',
		supportsExtended: false,
		datSignature: 0x4f75b7ab,
		sprSignature: 0x4f75b7cd,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 952,
		label: '9.52',
		supportsExtended: false,
		datSignature: 0x4f857f6c,
		sprSignature: 0x4f857f8e,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 953,
		label: '9.53',
		supportsExtended: false,
		datSignature: 0x4fa11252,
		sprSignature: 0x4fa11282,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 954,
		label: '9.54',
		supportsExtended: false,
		datSignature: 0x4fd5956b,
		sprSignature: 0x4fd595b7,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 960,
		label: '9.60',
		supportsExtended: true,
		datSignature: 0x4ffa74cc,
		sprSignature: 0x4ffa74f9,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 961,
		label: '9.61',
		supportsExtended: true,
		datSignature: 0x50226f9d,
		sprSignature: 0x50226fbd,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 963,
		label: '9.63',
		supportsExtended: true,
		datSignature: 0x503cb933,
		sprSignature: 0x503cb954,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 970,
		label: '9.70',
		supportsExtended: true,
		datSignature: 0x5072a490,
		sprSignature: 0x5072a567,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 980,
		label: '9.80',
		supportsExtended: true,
		datSignature: 0x50c70674,
		sprSignature: 0x50c70753,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 981,
		label: '9.81',
		supportsExtended: true,
		datSignature: 0x50d1c5b6,
		sprSignature: 0x50d1c685,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 982,
		label: '9.82',
		supportsExtended: true,
		datSignature: 0x512cad09,
		sprSignature: 0x512cad68,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 983,
		label: '9.83',
		supportsExtended: true,
		datSignature: 0x51407b67,
		sprSignature: 0x51407bc7,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 985,
		label: '9.85',
		supportsExtended: true,
		datSignature: 0x51641a1b,
		sprSignature: 0x51641a84,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 986,
		label: '9.86',
		supportsExtended: true,
		datSignature: 0x5170e904,
		sprSignature: 0x5170e96f,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1010,
		label: '10.10',
		supportsExtended: true,
		datSignature: 0x51e3f8c3,
		sprSignature: 0x51e3f8e9,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1020,
		label: '10.20',
		supportsExtended: true,
		datSignature: 0x5236f129,
		sprSignature: 0x5236f14f,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1021,
		label: '10.21',
		supportsExtended: true,
		datSignature: 0x526a5068,
		sprSignature: 0x526a5090,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1030,
		label: '10.30',
		supportsExtended: true,
		datSignature: 0x52a59036,
		sprSignature: 0x52a5905f,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1031,
		label: '10.31',
		supportsExtended: true,
		datSignature: 0x52aed581,
		sprSignature: 0x52aed5a7,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1032,
		label: '10.32',
		supportsExtended: true,
		datSignature: 0x52d8d0a9,
		sprSignature: 0x52d8d0ce,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1034,
		label: '10.34',
		supportsExtended: true,
		datSignature: 0x52e74ab5,
		sprSignature: 0x52e74ada,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1035,
		label: '10.35',
		supportsExtended: true,
		datSignature: 0x52fdfc2c,
		sprSignature: 0x52fdfc54,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1036,
		label: '10.36',
		supportsExtended: true,
		datSignature: 0x53159c7e,
		sprSignature: 0x53159ca9,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1037,
		label: '10.37',
		supportsExtended: true,
		datSignature: 0x531ea82e,
		sprSignature: 0x531ea856,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1038,
		label: '10.38',
		supportsExtended: true,
		datSignature: 0x5333c199,
		sprSignature: 0x5333c1c3,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1039,
		label: '10.39',
		supportsExtended: true,
		datSignature: 0x535a50ad,
		sprSignature: 0x535a50d5,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1040,
		label: '10.40',
		supportsExtended: true,
		datSignature: 0x5379984d,
		sprSignature: 0x53799876,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1041,
		label: '10.41',
		supportsExtended: true,
		datSignature: 0x5383504e,
		sprSignature: 0x53835077,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1050,
		label: '10.50',
		supportsExtended: true,
		datSignature: 0x53b6460e,
		sprSignature: 0x53b64639,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1051,
		label: '10.51',
		supportsExtended: true,
		datSignature: 0x53c8cc17,
		sprSignature: 0x53c8cc3f,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1052,
		label: '10.52',
		supportsExtended: true,
		datSignature: 0x53e898bd,
		sprSignature: 0x53e898e5,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1053,
		label: '10.53',
		supportsExtended: true,
		datSignature: 0x53fad76e,
		sprSignature: 0x53fad799,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1054,
		label: '10.54',
		supportsExtended: true,
		datSignature: 0x540d3a47,
		sprSignature: 0x53e898e5,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1055,
		label: '10.55',
		supportsExtended: true,
		datSignature: 0x54128727,
		sprSignature: 0x54128755,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1056,
		label: '10.56',
		supportsExtended: true,
		datSignature: 0x542143b0,
		sprSignature: 0x542143de,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1057,
		label: '10.57',
		supportsExtended: true,
		datSignature: 0x542535f9,
		sprSignature: 0x54253627,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1058,
		label: '10.58',
		supportsExtended: true,
		datSignature: 0x542d12e7,
		sprSignature: 0x542d1315,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1059,
		label: '10.59',
		supportsExtended: true,
		datSignature: 0x5434084b,
		sprSignature: 0x54340879,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1060,
		label: '10.60',
		supportsExtended: true,
		datSignature: 0x5448d9c7,
		sprSignature: 0x5448da10,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1061,
		label: '10.61',
		supportsExtended: true,
		datSignature: 0x5448d9c7,
		sprSignature: 0x5448da10,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1062,
		label: '10.62',
		supportsExtended: true,
		datSignature: 0x54622638,
		sprSignature: 0x54622667,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1063,
		label: '10.63',
		supportsExtended: true,
		datSignature: 0x546b502a,
		sprSignature: 0x546b505e,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1064,
		label: '10.64',
		supportsExtended: true,
		datSignature: 0x547f05be,
		sprSignature: 0x547f0632,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1070,
		label: '10.70',
		supportsExtended: true,
		datSignature: 0x5481bb97,
		sprSignature: 0x5481bc06,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1071,
		label: '10.71',
		datSignature: 0x334f,
		supportsExtended: true,
		sprSignature: 0x548e9efe,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1072,
		label: '10.72',
		datSignature: 0x3729,
		supportsExtended: true,
		sprSignature: 0x54b37b99,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1073,
		label: '10.73',
		datSignature: 0x374d,
		supportsExtended: true,
		sprSignature: 0x54bc95ae,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1074,
		label: '10.74',
		datSignature: 0x375e,
		supportsExtended: true,
		sprSignature: 0x54c5fab2,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1075,
		label: '10.75',
		datSignature: 0x3775,
		supportsExtended: true,
		sprSignature: 0x54d85085,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1076,
		label: '10.76',
		datSignature: 0x37df,
		supportsExtended: true,
		sprSignature: 0x54f03ce9,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1077,
		label: '10.77',
		datSignature: 0x38de,
		supportsExtended: true,
		sprSignature: 0x5525213d,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1090,
		label: '10.90',
		datSignature: 0x3f26,
		supportsExtended: true,
		sprSignature: 0x565ee171,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1091,
		label: '10.91',
		datSignature: 0x3f81,
		supportsExtended: true,
		sprSignature: 0x56bc8198,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1092,
		label: '10.92',
		datSignature: 0x4086,
		supportsExtended: true,
		sprSignature: 0x570742b8,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1093,
		label: '10.93 test',
		datSignature: 0x40ff,
		supportsExtended: true,
		sprSignature: 0x57161dea,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1093,
		label: '10.93',
		datSignature: 0x413f,
		supportsExtended: true,
		sprSignature: 0x5726e657,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1094,
		label: '10.94',
		datSignature: 0x41e5,
		supportsExtended: true,
		sprSignature: 0x57459d43,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1095,
		label: '10.95',
		datSignature: 0x41f3,
		supportsExtended: true,
		sprSignature: 0x575a84bd,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1098,
		label: '10.98',
		datSignature: 0x42a3,
		supportsExtended: true,
		sprSignature: 0x57bbd603,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1099,
		label: '10.99',
		datSignature: 0x4347,
		supportsExtended: true,
		sprSignature: 0x57ff106b,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1286,
		label: '12.86',
		datSignature: 0x4a10,
		supportsExtended: true,
		sprSignature: 0x59e48e02,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	}
];
