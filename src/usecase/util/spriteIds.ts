export const nextSpriteBase = (sprites: Map<number, unknown>, spritesCount: number): number => {
	let base = spritesCount + 1;
	for (const id of sprites.keys()) if (id >= base) base = id + 1;
	return base;
};
