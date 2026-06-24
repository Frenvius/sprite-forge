import type { ServerItem } from '~/lib/formats/tibia';

export const NO_ARTICLE = '__none__';

export const TYPE_OPTIONS = [
	{ value: 0, label: 'None' },
	{ value: 1, label: 'Ground' },
	{ value: 2, label: 'Container' },
	{ value: 11, label: 'Splash' },
	{ value: 12, label: 'Fluid' },
	{ value: 14, label: 'Deprecated' }
];

export const STACK_OPTIONS = [
	{ value: 0, label: 'None' },
	{ value: 1, label: 'Border' },
	{ value: 2, label: 'Bottom' },
	{ value: 3, label: 'Top' }
];

export const SYNCED_FLAGS: Array<{ label: string; key: keyof ServerItem }> = [
	{ key: 'unpassable', label: 'Unpassable' },
	{ key: 'movable', label: 'Movable' },
	{ key: 'blockMissiles', label: 'Block Missiles' },
	{ key: 'blockPathfinder', label: 'Block Pathfind' },
	{ key: 'hasElevation', label: 'Has Elevation' },
	{ key: 'multiUse', label: 'Multi Use' },
	{ key: 'pickupable', label: 'Pickupable' },
	{ key: 'stackable', label: 'Stackable' },
	{ key: 'forceUse', label: 'Force Use' },
	{ key: 'readable', label: 'Readable' },
	{ key: 'rotatable', label: 'Rotatable' },
	{ key: 'hangable', label: 'Hangable' },
	{ key: 'hookSouth', label: 'Hook South' },
	{ key: 'hookEast', label: 'Hook East' },
	{ key: 'ignoreLook', label: 'Ignore Look' },
	{ key: 'fullGround', label: 'Full Ground' },
	{ key: 'isAnimation', label: 'Is Animation' }
];

export const SYNCED_NUMBERS: Array<{ label: string; key: keyof ServerItem }> = [
	{ key: 'groundSpeed', label: 'Ground Speed' },
	{ key: 'lightLevel', label: 'Light Level' },
	{ key: 'lightColor', label: 'Light Color' },
	{ key: 'minimapColor', label: 'Minimap Color' },
	{ key: 'maxReadChars', label: 'Max Read Chars' },
	{ label: 'Max R/W Chars', key: 'maxReadWriteChars' },
	{ key: 'tradeAs', label: 'Trade As' }
];
