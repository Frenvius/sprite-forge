import { useMemo } from 'react';

import { cn } from '~/lib/utils';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { from8Bit, generate8BitColorGridFlat } from '~/lib/formats/tibia/eightBitColors';

interface EightBitColorPickerProps {
	value: number;
	disabled?: boolean;
	className?: string;
	onChange: (value: number) => void;
}

const GRID_COLUMNS = 18;

export const EightBitColorPicker = ({ value, onChange, disabled, className }: EightBitColorPickerProps) => {
	const displayValue = isNaN(value) ? 0 : Math.floor(value);
	const clampedValue = Math.max(0, Math.min(215, displayValue));
	const [r, g, b] = from8Bit(clampedValue);
	const displayColor = `rgb(${r}, ${g}, ${b})`;

	const colorGrid = useMemo(() => generate8BitColorGridFlat(), []);

	const handleChange = (newValue: number) => {
		const clamped = Math.max(0, Math.min(215, Math.floor(newValue)));
		onChange(clamped);
	};

	return (
		<div className={cn('flex items-center gap-2', className)}>
			<Input
				min={0}
				max={215}
				type="number"
				disabled={disabled}
				value={displayValue}
				className="h-7 w-16 text-xs font-mono text-right bg-background/50 shadow-sm hover:bg-background/80 transition-colors px-1"
				onChange={(e) => {
					const numValue = Number(e.target.value);
					if (!isNaN(numValue)) {
						handleChange(numValue);
					}
				}}
			/>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						disabled={disabled}
						style={{ backgroundColor: displayColor }}
						className="w-7 h-7 p-0 shrink-0 border-border bg-background/50"
					>
						<span className="sr-only">Pick color</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-auto p-2">
					<div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))` }}>
						{colorGrid.map((colorIndex, gridIndex) => {
							if (colorIndex === null) {
								return <div key={`empty-${gridIndex}`} className="w-4 h-4 rounded-[1px] border border-border/10 bg-muted/30" />;
							}
							const [r, g, b] = from8Bit(colorIndex);
							const color = `rgb(${r}, ${g}, ${b})`;
							const matchesValue = clampedValue === colorIndex;
							return (
								<button
									key={`grid-${gridIndex}`}
									title={`Color ID: ${colorIndex}`}
									style={{ backgroundColor: color }}
									onClick={() => handleChange(colorIndex)}
									className={cn(
										'w-4 h-4 rounded-[1px] border border-border/20 hover:scale-125 hover:z-10 transition-transform',
										matchesValue && 'ring-1 ring-primary border-primary z-10'
									)}
								/>
							);
						})}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
};
