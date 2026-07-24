import type { Sprite } from '~/lib/formats/tibia';
import type { RemovedSprite } from '~/lib/formats/registry';

import React from 'react';

import { cn } from '~/lib/utils';
import { REASON_META } from '~/components/SpriteOptimizerDialog/constants';

const CHECKER = 'repeating-conic-gradient(rgba(255,255,255,0.06) 0% 25%, transparent 0% 50%) 50% / 8px 8px';

interface RemovedSpriteTileProps {
	size: number;
	sprite?: Sprite;
	entry: RemovedSprite;
}

export function RemovedSpriteTile({ size, entry, sprite }: RemovedSpriteTileProps) {
	const canvasRef = React.useRef<HTMLCanvasElement>(null);
	const meta = REASON_META[entry.reason];

	React.useEffect(() => {
		const ctx = canvasRef.current?.getContext('2d');
		if (!ctx) return;

		ctx.clearRect(0, 0, size, size);
		if (!sprite || sprite.isEmpty || sprite.rgbaPixels?.length !== size * size * 4) return;

		const image = ctx.createImageData(size, size);
		image.data.set(sprite.rgbaPixels);
		ctx.putImageData(image, 0, 0);
	}, [sprite, size]);

	const title =
		entry.reason === 'duplicate'
			? `#${entry.id} - duplicate of #${entry.duplicateOf}`
			: `#${entry.id} - ${entry.reason === 'empty' ? 'blank sprite' : 'not referenced by any object'}`;

	return (
		<div
			title={title}
			style={{ background: CHECKER }}
			className={cn('group relative h-9 w-9 overflow-hidden rounded-md border transition-colors', meta.tile)}
		>
			<canvas width={size} height={size} ref={canvasRef} className="h-full w-full" style={{ imageRendering: 'pixelated' }} />
			<span className={cn('absolute left-1 top-1 h-1.5 w-1.5 rounded-full ring-1 ring-background/70', meta.dot)} />
			<span className="absolute inset-x-0 bottom-0 bg-background/80 text-center text-[9px] leading-[11px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
				{entry.id}
			</span>
		</div>
	);
}
