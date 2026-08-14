import type { TemplateItem } from '~/lib/formats/tibia';
import type { SheetTiles } from '~/usecase/util/templateSheet';

import React from 'react';

import { SPRITE_SIZE } from '~/lib/formats/tibia';

interface ItemThumbProps {
	max?: number;
	item: TemplateItem;
	sheet: null | SheetTiles;
}

export const ItemThumb = ({ item, sheet, max = 48 }: ItemThumbProps) => {
	const canvasRef = React.useRef<HTMLCanvasElement>(null);
	const { width, height } = item.geometry;

	React.useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!sheet) return;

		for (let h = 0; h < height; h++) {
			for (let w = 0; w < width; w++) {
				const cell = item.cells[h * width + w];
				if (cell === undefined || cell < 0) continue;
				const tile = sheet.getTile(cell);
				if (!tile) continue;
				const image = new ImageData(new Uint8ClampedArray(tile.rgbaPixels), SPRITE_SIZE, SPRITE_SIZE);
				ctx.putImageData(image, (width - w - 1) * SPRITE_SIZE, (height - h - 1) * SPRITE_SIZE);
			}
		}
	}, [item, sheet, width, height]);

	const scale = Math.min(max / (width * SPRITE_SIZE), max / (height * SPRITE_SIZE));

	return (
		<canvas
			ref={canvasRef}
			width={width * SPRITE_SIZE}
			height={height * SPRITE_SIZE}
			className="[image-rendering:pixelated]"
			style={{ width: width * SPRITE_SIZE * scale, height: height * SPRITE_SIZE * scale }}
		/>
	);
};
