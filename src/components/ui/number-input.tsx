import * as React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

import { cn } from '~/lib/utils';

export interface NumberInputProps extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange'> {
	step?: number;
	onChange?: (value: number | string) => void;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
	({ min, max, value, onChange, step = 1, disabled, className, ...props }, ref) => {
		const [internalValue, setInternalValue] = React.useState<string>(String(value ?? ''));

		React.useEffect(() => {
			setInternalValue(String(value ?? ''));
		}, [value]);

		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value;
			setInternalValue(newValue);
			if (onChange) {
				onChange(newValue);
			}
		};

		const handleIncrement = () => {
			const current = Number(internalValue) || 0;
			const newValue = current + step;
			const finalValue = max !== undefined ? Math.min(newValue, Number(max)) : newValue;
			setInternalValue(String(finalValue));
			if (onChange) {
				onChange(finalValue);
			}
		};

		const handleDecrement = () => {
			const current = Number(internalValue) || 0;
			const newValue = current - step;
			const finalValue = min !== undefined ? Math.max(newValue, Number(min)) : newValue;
			setInternalValue(String(finalValue));
			if (onChange) {
				onChange(finalValue);
			}
		};

		const canIncrement = max === undefined || Number(internalValue) < Number(max);
		const canDecrement = min === undefined || Number(internalValue) > Number(min);

		return (
			<div className="relative flex items-center">
				<input
					ref={ref}
					min={min}
					max={max}
					step={step}
					type="number"
					disabled={disabled}
					value={internalValue}
					onChange={handleChange}
					style={{
						...props.style,
						paddingRight: '1.1rem',
						WebkitAppearance: 'none',
						MozAppearance: 'textfield'
					}}
					className={cn(
						'flex h-7 w-full rounded-md border border-input bg-background/50 px-2 py-1 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
						className
					)}
					{...props}
				/>
				<div className="absolute right-0.5 top-1 bottom-1 flex flex-col items-center justify-center gap-[1px]">
					<button
						type="button"
						onClick={handleIncrement}
						disabled={disabled || !canIncrement}
						className="flex items-center justify-center h-3 w-4 rounded-sm p-0 hover:bg-secondary/80 active:bg-secondary disabled:opacity-50 disabled:pointer-events-none transition-colors"
					>
						<ChevronUp className="h-2.5 w-2.5" />
					</button>
					<button
						type="button"
						onClick={handleDecrement}
						disabled={disabled || !canDecrement}
						className="flex items-center justify-center h-3 w-4 rounded-sm p-0 hover:bg-secondary/80 active:bg-secondary disabled:opacity-50 disabled:pointer-events-none transition-colors"
					>
						<ChevronDown className="h-2.5 w-2.5" />
					</button>
				</div>
			</div>
		);
	}
);
NumberInput.displayName = 'NumberInput';

export { NumberInput };
