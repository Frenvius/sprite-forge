export enum ThingCategory {
	ITEM = 'item',
	OUTFIT = 'outfit',
	EFFECT = 'effect',
	MISSILE = 'missile'
}

export const THING_CATEGORY_VALUES: Record<ThingCategory, number> = {
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
	defaults?: Partial<ThingType>;
	rendering?: CategoryRenderConfig;
}

export interface FormatConfig {
	name: string;
	spriteSize: number;
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
	category: ThingCategory;
	isGroundBorder: boolean;
	noMoveAnimation: boolean;
	isFluidContainer: boolean;

	hasDefaultAction: boolean;
	texturePatterns?: number[];
	marketRestrictLevel: number;
	upgradeClassification?: number;
	frameGroupsData?: FrameGroup[];
	frameDurations: FrameDuration[];
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
	extended: boolean;
	itemsCount: number;
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

export function getCategoryMap(data: AssetData, category: ThingCategory): Map<number, ThingType> {
	switch (category) {
		case ThingCategory.ITEM:
			return data.items;
		case ThingCategory.OUTFIT:
			return data.outfits;
		case ThingCategory.EFFECT:
			return data.effects;
		case ThingCategory.MISSILE:
			return data.missiles;
	}
}

export function getCategoryCount(data: AssetData, category: ThingCategory): number {
	switch (category) {
		case ThingCategory.ITEM:
			return data.itemsCount;
		case ThingCategory.OUTFIT:
			return data.outfitsCount;
		case ThingCategory.EFFECT:
			return data.effectsCount;
		case ThingCategory.MISSILE:
			return data.missilesCount;
	}
}

export function setCategoryCount(data: AssetData, category: ThingCategory, count: number): void {
	switch (category) {
		case ThingCategory.ITEM:
			data.itemsCount = count;
			break;
		case ThingCategory.OUTFIT:
			data.outfitsCount = count;
			break;
		case ThingCategory.EFFECT:
			data.effectsCount = count;
			break;
		case ThingCategory.MISSILE:
			data.missilesCount = count;
			break;
	}
}

export function getCategoryStartId(config: FormatConfig, category: ThingCategory): number {
	return config.categories.find((c) => c.id === category)?.startId ?? 1;
}

export function getCategoryRenderConfig(config: FormatConfig, category: ThingCategory): undefined | CategoryRenderConfig {
	return config.categories.find((c) => c.id === category)?.rendering;
}

export function createThingType(id: number, category: ThingCategory, config?: FormatConfig): ThingType {
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
		label: '8.50',
		supportsExtended: false,
		datSignature: 0x4ae97492,
		sprSignature: 0x4acb5230,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 854,
		label: '8.54',
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
		label: '8.60',
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
		value: 960,
		label: '9.60',
		supportsExtended: true,
		datSignature: 0x4ffa74cc,
		sprSignature: 0x4ffa74f9,
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
		value: 1030,
		label: '10.30',
		supportsExtended: true,
		datSignature: 0x52a59036,
		sprSignature: 0x52a5905f,
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
		value: 1050,
		label: '10.50',
		supportsExtended: true,
		datSignature: 0x53b6460e,
		sprSignature: 0x53b64639,
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
		value: 1098,
		label: '10.98',
		datSignature: 0x42a3,
		supportsExtended: true,
		sprSignature: 0x57bbd603,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	}
];
