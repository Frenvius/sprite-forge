import type { ObdCardProps } from './types';

import React from 'react';
import { Copy, Check } from 'lucide-react';

import { cn } from '~/lib/utils';
import { CATEGORY_NAME } from '~/lib/formats/tibia/obdViewer';

export const ObdCard = ({ row, fill, thumb, focused, onFocus, selected, onToggle }: ObdCardProps) => {
	const canvasRef = React.useRef<null | HTMLCanvasElement>(null);

	React.useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !thumb || thumb.w === 0 || thumb.h === 0) return;
		canvas.width = thumb.w;
		canvas.height = thumb.h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const expected = thumb.w * thumb.h * 4;
		if (thumb.rgba.length < expected) return;
		ctx.putImageData(new ImageData(new Uint8ClampedArray(thumb.rgba.slice(0, expected)), thumb.w, thumb.h), 0, 0);
	}, [thumb]);

	const cat = CATEGORY_NAME[row.category] ?? 'item';

	return (
		<button
			type="button"
			onClick={() => onFocus(row)}
			className={cn(
				'group relative flex h-[112px] flex-col overflow-hidden rounded-lg border bg-secondary/40 text-left transition-colors',
				fill ? 'w-full' : 'w-[88px]',
				focused ? 'border-primary ring-2 ring-primary' : selected ? 'border-primary/60' : 'border-border hover:border-primary/50'
			)}
		>
			<div
				role="checkbox"
				aria-checked={selected}
				onClick={(e) => {
					e.stopPropagation();
					onToggle(row.recordIndex);
				}}
				className={cn(
					'absolute right-1 top-1 z-10 flex h-4 w-4 cursor-pointer items-center justify-center rounded border transition-colors',
					selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background/80 hover:border-primary'
				)}
			>
				{selected && <Check className="h-3 w-3" />}
			</div>

			{row.isDup && (
				<div
					title="Duplicate"
					className="absolute left-1 top-1 z-10 flex h-4 items-center gap-0.5 rounded bg-amber-500/90 px-1 text-[9px] font-bold text-black"
				>
					<Copy className="h-2.5 w-2.5" />
				</div>
			)}

			<div className="flex h-[68px] items-center justify-center bg-[conic-gradient(#0000_90deg,#80808022_0_180deg,#0000_0_270deg,#80808022_0)] bg-[length:16px_16px] p-1.5">
				<canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} className="max-h-full max-w-full object-contain" />
			</div>

			<div className="flex flex-col gap-0.5 border-t border-border/50 px-1.5 py-1">
				<span className="truncate text-[11px] font-medium text-foreground">{row.name || `${cat} ${row.sourceId}`}</span>
				<span className="flex items-center justify-between text-[9px] uppercase tracking-wide text-muted-foreground">
					<span>{cat}</span>
					<span>#{row.sourceId}</span>
				</span>
			</div>
		</button>
	);
};
