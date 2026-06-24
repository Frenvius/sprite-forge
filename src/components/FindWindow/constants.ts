import type { ViewMode } from './types';

import { ThingCategory } from '~/lib/formats/tibia';

export const CATEGORY_BYTE: Record<'all' | ThingCategory, number> = {
	all: 0,
	[ThingCategory.ITEM]: 1,
	[ThingCategory.OUTFIT]: 2,
	[ThingCategory.EFFECT]: 3,
	[ThingCategory.MISSILE]: 4
};

export const VIEW_MODES: ViewMode[] = ['list', 'grid', 'compact', 'large'];

export const PROPERTIES: Array<{ display: string; property: string }> = [
	{ display: 'Is Ground', property: 'isGround' },
	{ display: 'Ground Border', property: 'isGroundBorder' },
	{ display: 'Bottom', property: 'isOnBottom' },
	{ display: 'Top', property: 'isOnTop' },
	{ display: 'Has Light', property: 'hasLight' },
	{ display: 'Automap', property: 'miniMap' },
	{ display: 'Has Offset', property: 'hasOffset' },
	{ display: 'Has Elevation', property: 'hasElevation' },
	{ display: 'Equip', property: 'cloth' },
	{ display: 'Market', property: 'isMarketItem' },
	{ display: 'Writable', property: 'writable' },
	{ display: 'Writable Once', property: 'writableOnce' },
	{ display: 'Has Action', property: 'hasDefaultAction' },
	{ display: 'Container', property: 'isContainer' },
	{ display: 'Stackable', property: 'stackable' },
	{ display: 'Force Use', property: 'forceUse' },
	{ display: 'Multi Use', property: 'multiUse' },
	{ display: 'Fluid Container', property: 'isFluidContainer' },
	{ display: 'Fluid', property: 'isFluid' },
	{ display: 'Unpassable', property: 'isUnpassable' },
	{ display: 'Unmovable', property: 'isUnmoveable' },
	{ display: 'Block Missile', property: 'blockMissile' },
	{ property: 'blockPathfind', display: 'Block Pathfinder' },
	{ property: 'noMoveAnimation', display: 'No Move Animation' },
	{ display: 'Pickupable', property: 'pickupable' },
	{ display: 'Hangable', property: 'hangable' },
	{ display: 'Hook East', property: 'isHorizontal' },
	{ display: 'Hook South', property: 'isVertical' },
	{ display: 'Rotatable', property: 'rotatable' },
	{ property: 'dontHide', display: "Don't Hide" },
	{ display: 'Translucent', property: 'isTranslucent' },
	{ display: 'Lying Object', property: 'isLyingObject' },
	{ display: 'Animate Always', property: 'animateAlways' },
	{ display: 'Full Ground', property: 'isFullGround' },
	{ display: 'Ignore Look', property: 'ignoreLook' },
	{ display: 'Wrappable', property: 'wrappable' },
	{ display: 'Unwrappable', property: 'unwrappable' },
	{ display: 'Top effect', property: 'topEffect' },
	{ display: 'Useable', property: 'usable' },
	{ display: 'Has Charges', property: 'hasCharges' },
	{ display: 'Floor Change', property: 'floorChange' },
	{ display: 'Lens Help', property: 'isLensHelp' },
	{ display: 'Is Animation', property: 'isAnimation' }
];
