import { MarketCategory } from './types';

export type PropertyFieldType = 'text' | 'toggle' | 'number' | 'select' | 'color-8bit' | 'toggle-mode' | 'toggle-number';

export interface PropertyField {
	key: string;
	label: string;
	show?: string;
	undo?: boolean;
	indent?: boolean;
	valueKey?: string;
	type: PropertyFieldType;
	enabledBy?: string | string[];
	modeLabels?: [string, string];
	selectOptions?: Array<{ label: string; value: number }>;
}

export interface PropertyFieldGrid {
	columns: 2;
	type: 'grid';
	indent?: boolean;
	fields: PropertyField[];
}

export type SectionField = PropertyField | PropertyFieldGrid;

export interface PropertySection {
	title: string;
	kind: 'schema';
	column: 1 | 2 | 3;
	fields: SectionField[];
	responsiveHideUnless?: string;
	show: true | string | string[];
}

export interface CustomSection {
	id: string;
	kind: 'custom';
	column: 1 | 2 | 3;
	show: true | string | string[];
}

export type SchemaEntry = CustomSection | PropertySection;

const MARKET_OPTIONS = Object.entries(MarketCategory)
	.filter(([key]) => isNaN(Number(key)))
	.map(([key, value]) => ({ value: Number(value), label: key.replace(/_/g, ' ') }));

export const FLAG_DEPENDENT_VALUES: Record<string, Array<{ key: string; reset: number | string }>> = {};

export const TIBIA_PROPERTY_SCHEMA: SchemaEntry[] = [
	{
		column: 1,
		kind: 'schema',
		title: 'Physics & Ground',
		show: 'showPhysicsGround',
		fields: [
			{ key: 'isGround', label: 'Is Ground', type: 'toggle-number', valueKey: 'groundSpeed' },
			{ type: 'toggle', key: 'isUnpassable', label: 'Unpassable' },
			{ type: 'toggle', key: 'isUnmoveable', label: 'Unmoveable' },
			{ type: 'toggle', key: 'noMoveAnimation', label: 'No Move Animation', show: 'showNoMoveAnimation' },
			{ type: 'toggle', key: 'blockPathfind', label: 'Block Pathfind' },
			{ type: 'toggle', key: 'blockMissile', label: 'Block Missiles' },
			{ type: 'toggle', key: 'isFullGround', label: 'Full Ground' }
		]
	},
	{
		column: 1,
		kind: 'schema',
		show: 'isItem',
		title: 'Appearance',
		fields: [
			{ key: 'isLensHelp', label: 'Lens Help', valueKey: 'lensHelp', show: 'showLensHelp', type: 'toggle-number' },
			{ type: 'toggle', key: 'isTranslucent', label: 'Translucent', show: 'showTranslucent' },
			{ type: 'toggle', key: 'dontHide', label: "Don't Hide", show: 'showDontHide' },
			{ type: 'toggle', key: 'ignoreLook', label: 'Ignore Look', show: 'showIgnoreLook' }
		]
	},
	{
		column: 1,
		show: true,
		kind: 'schema',
		title: 'Light',
		responsiveHideUnless: 'isOutfit',
		fields: [
			{ type: 'toggle', key: 'hasLight', label: 'Has Light' },
			{
				columns: 2,
				type: 'grid',
				indent: true,
				fields: [
					{ undo: false, label: 'Color', key: 'lightColor', type: 'color-8bit', enabledBy: 'hasLight' },
					{ type: 'number', key: 'lightLevel', label: 'Intensity', enabledBy: 'hasLight' }
				]
			}
		]
	},
	{
		column: 1,
		kind: 'schema',
		title: 'Flags',
		show: ['isOutfit', 'showAnimateAlways'],
		fields: [{ undo: false, type: 'toggle', key: 'animateAlways', label: 'Animate Always' }]
	},
	{
		column: 1,
		kind: 'schema',
		title: 'Market',
		show: 'showMarket',
		fields: [
			{ type: 'toggle', key: 'isMarketItem', label: 'Market Item' },
			{ undo: false, type: 'text', indent: true, label: 'Name', key: 'marketName', enabledBy: 'isMarketItem' },
			{
				columns: 2,
				type: 'grid',
				indent: true,
				fields: [
					{
						undo: false,
						type: 'select',
						label: 'Category',
						key: 'marketCategory',
						enabledBy: 'isMarketItem',
						selectOptions: MARKET_OPTIONS
					},
					{ undo: false, type: 'number', label: 'Trade As', key: 'marketTradeAs', enabledBy: 'isMarketItem' }
				]
			},
			{
				columns: 2,
				type: 'grid',
				indent: true,
				fields: [
					{ undo: false, type: 'number', label: 'Show As', key: 'marketShowAs', enabledBy: 'isMarketItem' },
					{ undo: false, type: 'number', label: 'Profession', enabledBy: 'isMarketItem', key: 'marketRestrictProfession' }
				]
			},
			{ undo: false, indent: true, type: 'number', label: 'Level', enabledBy: 'isMarketItem', key: 'marketRestrictLevel' }
		]
	},

	{
		column: 2,
		kind: 'schema',
		title: 'Interaction',
		show: 'showInteraction',
		fields: [
			{ type: 'toggle', key: 'pickupable', label: 'Pickupable' },
			{ type: 'toggle', key: 'stackable', label: 'Stackable' },
			{ type: 'toggle', key: 'hasCharges', label: 'Has Charges', show: 'showHasCharges' },
			{ type: 'toggle', key: 'isContainer', label: 'Container' },
			{ type: 'toggle', key: 'rotatable', label: 'Rotatable' },
			{ type: 'toggle', key: 'multiUse', label: 'Multi Use' },
			{ type: 'toggle', key: 'forceUse', label: 'Force Use' },
			{ key: 'usable', type: 'toggle', label: 'Usable', show: 'showUsable' },
			{ type: 'toggle', key: 'wrappable', label: 'Wrappable', show: 'showWrappable' },
			{ type: 'toggle', key: 'unwrappable', label: 'Unwrappable', show: 'showWrappable' }
		]
	},
	{
		column: 2,
		kind: 'schema',
		show: 'showHooks',
		title: 'Hooks & Hanging',
		fields: [
			{ type: 'toggle', key: 'hangable', label: 'Hangable', show: 'showHangable' },
			{ type: 'toggle', key: 'isHorizontal', label: 'Horizontal Hook' },
			{ type: 'toggle', key: 'isVertical', label: 'Vertical Hook' }
		]
	},
	{
		column: 2,
		kind: 'schema',
		title: 'Default Actions',
		show: 'showDefaultActions',
		fields: [{ type: 'toggle-number', key: 'hasDefaultAction', valueKey: 'defaultAction', label: 'Has Default Action' }]
	},
	{
		column: 2,
		kind: 'schema',
		title: 'Equipment',
		show: 'showEquipment',
		fields: [{ key: 'cloth', label: 'Is Cloth', type: 'toggle-number', valueKey: 'clothSlot' }]
	},
	{
		column: 2,
		kind: 'schema',
		title: 'Displacement',
		show: 'showDisplacement',
		responsiveHideUnless: 'isOutfit',
		fields: [
			{ type: 'toggle', key: 'hasOffset', label: 'Has Offset' },
			{
				columns: 2,
				type: 'grid',
				indent: true,
				fields: [
					{ label: 'X', type: 'number', key: 'offsetX', enabledBy: 'hasOffset' },
					{ label: 'Y', type: 'number', key: 'offsetY', enabledBy: 'hasOffset' }
				]
			},
			{
				label: 'Elevation',
				key: 'hasElevation',
				type: 'toggle-number',
				valueKey: 'elevation',
				show: 'showDisplacementElevation'
			}
		]
	},
	{ column: 2, kind: 'custom', show: 'isOutfit', id: 'outfit-addons' },

	{ column: 3, kind: 'custom', show: 'isOutfit', id: 'outfit-colors' },
	{
		column: 3,
		kind: 'schema',
		title: 'Flags',
		responsiveHideUnless: '_never',
		show: ['showAnimateAlways', '!isOutfit'],
		fields: [{ undo: false, type: 'toggle', key: 'animateAlways', label: 'Animate Always' }]
	},
	{
		column: 3,
		kind: 'schema',
		show: 'showWriting',
		title: 'Writing & Reading',
		fields: [
			{ type: 'toggle', key: 'writable', label: 'Writable' },
			{ type: 'toggle', key: 'writableOnce', label: 'Writable Once' },
			{
				indent: true,
				type: 'number',
				label: 'Max Chars',
				key: 'maxTextLength',
				enabledBy: ['writable', 'writableOnce']
			}
		]
	},
	{
		column: 3,
		kind: 'schema',
		title: 'Layer Position',
		show: 'showLayerPosition',
		fields: [
			{ type: 'toggle', key: 'isLyingObject', label: 'Lying Object' },
			{ type: 'toggle', key: 'isOnTop', label: 'Always On Top' },
			{ type: 'toggle', key: 'topEffect', label: 'Top Effect', show: 'showTopEffect' },
			{ type: 'toggle', key: 'isOnBottom', label: 'Always On Bottom' },
			{ type: 'toggle', key: 'isGroundBorder', label: 'Ground Border', show: 'showGroundBorder' },
			{ type: 'toggle', key: 'floorChange', label: 'Floor Change', show: 'showFloorChange' }
		]
	},
	{
		column: 3,
		kind: 'schema',
		title: 'Animation',
		show: 'showAnimationProperties',
		fields: [
			{ indent: true, type: 'toggle', key: 'isAnimation', label: 'Is Animation' },
			{
				indent: true,
				label: 'Mode',
				type: 'toggle-mode',
				key: 'animationMode',
				modeLabels: ['Async', 'Sync']
			},
			{ indent: true, type: 'number', key: 'loopCount', label: 'Loop Count' },
			{ indent: true, type: 'number', key: 'startFrame', label: 'Start Frame' }
		]
	},
	{
		column: 3,
		kind: 'schema',
		show: 'isItem',
		title: 'Fluids',
		fields: [
			{ type: 'toggle', key: 'isFluidContainer', label: 'Fluid Container' },
			{ type: 'toggle', key: 'isFluid', label: 'Is Fluid' }
		]
	},
	{
		column: 3,
		kind: 'schema',
		title: 'Minimap',
		show: 'showMinimap',
		responsiveHideUnless: 'isOutfit',
		fields: [
			{ type: 'toggle', key: 'miniMap', label: 'Show on Minimap' },
			{ undo: false, indent: true, label: 'Color', type: 'color-8bit', key: 'miniMapColor', enabledBy: 'miniMap' }
		]
	}
];

function registerDependent(flag: string, key: string, type: PropertyFieldType) {
	const list = (FLAG_DEPENDENT_VALUES[flag] ??= []);
	if (!list.some((d) => d.key === key)) list.push({ key, reset: type === 'text' ? '' : 0 });
}

for (const entry of TIBIA_PROPERTY_SCHEMA) {
	if (entry.kind !== 'schema') continue;
	for (const sectionField of entry.fields) {
		const fields = sectionField.type === 'grid' ? sectionField.fields : [sectionField];
		for (const field of fields) {
			if (field.valueKey) registerDependent(field.key, field.valueKey, 'number');
			if (!field.enabledBy) continue;
			for (const flag of Array.isArray(field.enabledBy) ? field.enabledBy : [field.enabledBy]) {
				registerDependent(flag, field.key, field.type);
			}
		}
	}
}
