import type { ImportEntry } from '@/lib/formats/tibia';

import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface EntryCardProps {
	selected: boolean;
	entry: ImportEntry;
	onToggle: (index: number) => void;
}

export const EntryCard = ({ entry, selected, onToggle }: EntryCardProps) => {
	const canvasRef = React.useRef<null | HTMLCanvasElement>(null);

	React.useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || entry.thumbW === 0 || entry.thumbH === 0) return;
		canvas.width = entry.thumbW;
		canvas.height = entry.thumbH;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const expected = entry.thumbW * entry.thumbH * 4;
		if (entry.thumb.length < expected) return;
		const image = new ImageData(new Uint8ClampedArray(entry.thumb.slice(0, expected)), entry.thumbW, entry.thumbH);
		ctx.putImageData(image, 0, 0);
	}, [entry]);

	return (
		<button
			type="button"
			onClick={() => onToggle(entry.index)}
			className={cn(
				'group relative flex flex-col overflow-hidden rounded-lg border bg-secondary/40 text-left transition-colors',
				selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
			)}
		>
			<div
				className={cn(
					'absolute right-1.5 top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded border',
					selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background/80'
				)}
			>
				{selected && <Check className="h-3 w-3" />}
			</div>

			<div className="flex h-[72px] items-center justify-center bg-[conic-gradient(#0000_90deg,#80808022_0_180deg,#0000_0_270deg,#80808022_0)] bg-[length:16px_16px] p-2">
				<canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} className="max-h-full max-w-full object-contain" />
			</div>

			<div className="flex flex-col gap-0.5 border-t border-border/50 px-2 py-1.5">
				<span className="truncate text-xs font-medium text-foreground">
					{entry.name || `${entry.category} ${entry.sourceId}`}
				</span>
				<span className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
					<span>{entry.category}</span>
					<span>#{entry.sourceId}</span>
				</span>
			</div>
		</button>
	);
};
