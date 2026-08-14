import React from 'react';

import { SPRITE_SIZE } from '~/lib/formats/tibia';

interface CellCanvasProps {
	scale?: number;
	pixels?: Uint8Array;
}

export const CellCanvas = ({ pixels, scale = 2 }: CellCanvasProps) => {
	const canvasRef = React.useRef<HTMLCanvasElement>(null);

	React.useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!pixels) return;

		const image = new ImageData(new Uint8ClampedArray(pixels), SPRITE_SIZE, SPRITE_SIZE);
		ctx.putImageData(image, 0, 0);
	}, [pixels]);

	return (
		<canvas
			ref={canvasRef}
			width={SPRITE_SIZE}
			height={SPRITE_SIZE}
			className="[image-rendering:pixelated]"
			style={{ width: SPRITE_SIZE * scale, height: SPRITE_SIZE * scale }}
		/>
	);
};
