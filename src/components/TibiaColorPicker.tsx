import { cn } from '~/lib/utils';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { generateOutfitColorPalette } from '~/lib/formats/tibia/outfit';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';

interface TibiaColorPickerProps {
	value: number;
	disabled?: boolean;
	className?: string;
	onChange: (value: number) => void;
}

// Generate the exact Tibia outfit color palette (133 colors using HSI model)
const OUTFIT_COLORS = generateOutfitColorPalette();

export const TibiaColorPicker = ({ value, onChange, disabled, className }: TibiaColorPickerProps) => {
	// Support color IDs up to 255 (Tibia's max)
	// Values >= 133 wrap around using modulo in getOutfitColor
	const displayValue = isNaN(value) ? 0 : Math.floor(value);
	const paletteIndex = displayValue >= OUTFIT_COLORS.length ? displayValue % OUTFIT_COLORS.length : displayValue;
	const displayColor = OUTFIT_COLORS[paletteIndex] || OUTFIT_COLORS[0];

	const handleChange = (newValue: number) => {
		// Allow values 0-255, but clamp to prevent negative or extremely large values
		const clamped = Math.max(0, Math.min(255, Math.floor(newValue)));
		onChange(clamped);
	};

	return (
		<div className={cn('flex items-center gap-2', className)}>
			<Input
				min={0}
				max={255}
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
					<div className="grid gap-[1px]" style={{ gridTemplateColumns: 'repeat(19, minmax(0, 1fr))' }}>
						{OUTFIT_COLORS.map((color, index) => {
							// Check if this palette color matches the current value (accounting for wrapping)
							const matchesValue =
								displayValue === index || (displayValue >= OUTFIT_COLORS.length && displayValue % OUTFIT_COLORS.length === index);
							return (
								<button
									key={index}
									style={{ backgroundColor: color }}
									onClick={() => handleChange(index)}
									title={`Color ID: ${index}${displayValue >= OUTFIT_COLORS.length ? ` (wraps from ${displayValue})` : ''}`}
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
