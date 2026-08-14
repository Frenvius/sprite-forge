import { test, expect } from 'bun:test';

import { getSpriteIndex, createThingType, TIBIA_FORMAT_CONFIG } from './types';
import { templateFromThing, templateCellCount, templateItemToThing } from './template';

const wall = () => {
	const thing = createThingType(202, 'item', TIBIA_FORMAT_CONFIG);
	thing.height = 2;
	thing.isUnpassable = true;
	thing.blockMissile = true;
	thing.spriteIndex = [13, 5];
	return thing;
};

test('template round trip keeps geometry, props and cell order', () => {
	const source = wall();
	const cells = source.spriteIndex.map((id) => id - 1);
	const item = templateFromThing(source, cells, 'wall vertical');

	expect(item.geometry.height).toBe(2);
	expect(item.props.isUnpassable).toBe(true);
	expect(item.props.blockMissile).toBe(true);
	expect(item.cells).toEqual([12, 4]);

	const rebuilt = templateItemToThing(item, 500, [70, 71]);
	expect(rebuilt.id).toBe(500);
	expect(rebuilt.height).toBe(2);
	expect(rebuilt.isUnpassable).toBe(true);
	expect(rebuilt.spriteIndex).toEqual([70, 71]);
});

test('cell count matches the sprite index layout', () => {
	const thing = createThingType(1, 'outfit', TIBIA_FORMAT_CONFIG);
	thing.width = 2;
	thing.height = 2;
	thing.layers = 2;
	thing.frames = 3;
	thing.patternX = 4;

	const geometry = {
		width: thing.width,
		height: thing.height,
		layers: thing.layers,
		frames: thing.frames,
		patternX: thing.patternX,
		patternY: thing.patternY,
		patternZ: thing.patternZ
	};

	const total = templateCellCount(geometry);
	expect(total).toBe(2 * 2 * 2 * 3 * 4);

	const last = getSpriteIndex(
		thing,
		thing.width - 1,
		thing.height - 1,
		thing.layers - 1,
		thing.patternX - 1,
		0,
		0,
		thing.frames - 1
	);
	expect(last).toBe(total - 1);
});
