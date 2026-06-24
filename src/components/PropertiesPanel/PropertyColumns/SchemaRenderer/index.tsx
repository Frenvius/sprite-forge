import type { ThingType } from '~/lib/formats/tibia';
import type { Visibility } from '~/usecase/context/PropertiesContext/types';
import type { SectionField, PropertyField, PropertySection, PropertyFieldGrid } from '~/lib/formats/tibia/propertySchema';

import { cn } from '~/lib/utils';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import { NumberInput } from '~/components/ui/number-input';
import { EightBitColorPicker } from '~/components/EightBitColorPicker';
import { PropertyWithUndo } from '~/components/PropertiesPanel/PropertyWithUndo';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from '~/components/ui/select';

interface FieldProps {
	inGrid?: boolean;
	field: PropertyField;
	draftItem: ThingType;
	onChange: (property: string, value: any) => void;
}

function isEnabled(draftItem: ThingType, enabledBy?: string | string[]): boolean {
	if (!enabledBy) return true;
	if (Array.isArray(enabledBy)) return enabledBy.some((k) => !!(draftItem as any)[k]);
	return !!(draftItem as any)[enabledBy];
}

function MaybeUndo({ undo, property, children }: { undo: boolean; property: string; children: React.ReactNode }) {
	if (!undo) return <>{children}</>;
	return <PropertyWithUndo property={property}>{children}</PropertyWithUndo>;
}

function SchemaField({ field, inGrid, onChange, draftItem }: FieldProps) {
	const enabled = isEnabled(draftItem, field.enabledBy);
	const undo = field.undo !== false;
	const labelClass = field.indent || inGrid ? 'text-[10px] text-muted-foreground' : 'text-xs text-muted-foreground';

	if (inGrid) {
		return (
			<div className="flex flex-col gap-1">
				<Label className={labelClass}>{field.label}</Label>
				{renderControl(field, draftItem, onChange, enabled, undo)}
			</div>
		);
	}

	const indentClass = field.indent ? 'pl-2 border-l-2 border-border/30' : '';

	if (field.type === 'toggle-number') {
		return (
			<div className={cn('flex items-center justify-between', indentClass)}>
				<Label className={labelClass}>{field.label}</Label>
				<div className="flex items-center gap-2">
					<MaybeUndo undo={undo} property={field.valueKey!}>
						<NumberInput
							className="h-7 w-16 text-right"
							disabled={!(draftItem as any)[field.key]}
							value={(draftItem as any)[field.valueKey!] || 0}
							onChange={(val) => onChange(field.valueKey!, val)}
						/>
					</MaybeUndo>
					<MaybeUndo undo={undo} property={field.key}>
						<Switch checked={(draftItem as any)[field.key]} onCheckedChange={(checked) => onChange(field.key, checked)} />
					</MaybeUndo>
				</div>
			</div>
		);
	}

	if (field.type === 'toggle-mode') {
		const [offLabel, onLabel] = field.modeLabels || ['Off', 'On'];
		return (
			<div className={cn('flex items-center justify-between', indentClass)}>
				<Label className={labelClass}>{field.label}</Label>
				<div className="flex items-center gap-2">
					<span className="text-[10px] text-muted-foreground">{(draftItem as any)[field.key] === 0 ? offLabel : onLabel}</span>
					<MaybeUndo undo={undo} property={field.key}>
						<Switch
							checked={(draftItem as any)[field.key] === 1}
							onCheckedChange={(checked) => onChange(field.key, checked ? 1 : 0)}
						/>
					</MaybeUndo>
				</div>
			</div>
		);
	}

	return (
		<div className={cn('flex items-center justify-between', indentClass)}>
			<Label className={labelClass}>{field.label}</Label>
			{renderControl(field, draftItem, onChange, enabled, undo)}
		</div>
	);
}

function renderControl(
	field: PropertyField,
	draftItem: ThingType,
	onChange: (property: string, value: any) => void,
	enabled: boolean,
	undo: boolean
) {
	switch (field.type) {
		case 'toggle':
			return (
				<MaybeUndo undo={undo} property={field.key}>
					<Switch
						disabled={!enabled}
						checked={(draftItem as any)[field.key]}
						onCheckedChange={(checked) => onChange(field.key, checked)}
					/>
				</MaybeUndo>
			);

		case 'number':
			return (
				<MaybeUndo undo={undo} property={field.key}>
					<NumberInput
						disabled={!enabled}
						className="h-7 w-16 text-right"
						value={(draftItem as any)[field.key] || 0}
						onChange={(val) => onChange(field.key, val)}
					/>
				</MaybeUndo>
			);

		case 'text':
			return (
				<Input
					disabled={!enabled}
					value={(draftItem as any)[field.key] || ''}
					onChange={(e) => onChange(field.key, e.target.value)}
					className="h-7 w-full text-xs bg-background/50 shadow-sm hover:bg-background/80 transition-colors"
				/>
			);

		case 'select':
			return (
				<Select
					disabled={!enabled}
					value={String((draftItem as any)[field.key] || 1)}
					onValueChange={(val) => onChange(field.key, parseInt(val))}
				>
					<SelectTrigger className="h-7 w-full text-xs bg-background/50 shadow-sm hover:bg-background/80 transition-colors">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{field.selectOptions?.map((opt) => (
							<SelectItem key={opt.value} value={String(opt.value)}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);

		case 'color-8bit':
			return (
				<EightBitColorPicker
					disabled={!enabled}
					value={(draftItem as any)[field.key] || 0}
					onChange={(val) => onChange(field.key, val)}
				/>
			);

		default:
			return null;
	}
}

function SchemaGrid({
	grid,
	onChange,
	draftItem
}: {
	draftItem: ThingType;
	grid: PropertyFieldGrid;
	onChange: (property: string, value: any) => void;
}) {
	return (
		<div className={cn('grid grid-cols-2 gap-2', grid.indent && 'pl-2 border-l-2 border-border/30')}>
			{grid.fields.map((field) => (
				<SchemaField inGrid field={field} key={field.key} onChange={onChange} draftItem={draftItem} />
			))}
		</div>
	);
}

function isFieldVisible(field: SectionField, visibility: Record<string, boolean>): boolean {
	if (field.type === 'grid') return true;
	if (!field.show) return true;
	return !!visibility[field.show];
}

export function SchemaSection({
	section,
	onChange,
	draftItem,
	visibility
}: {
	draftItem: ThingType;
	section: PropertySection;
	visibility: Visibility & Record<string, boolean>;
	onChange: (property: string, value: any) => void;
}) {
	const visible =
		section.show === true
			? true
			: Array.isArray(section.show)
				? section.show.every((k) => (k.startsWith('!') ? !visibility[k.slice(1)] : !!visibility[k]))
				: !!visibility[section.show];

	if (!visible) return null;

	const responsiveHide = section.responsiveHideUnless && !visibility[section.responsiveHideUnless] ? 'min-[1400px]:hidden' : '';

	return (
		<div className={responsiveHide}>
			<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
				<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">{section.title}</h4>
			</div>
			<div className="space-y-2 pl-1">
				{section.fields.map((field) => {
					if (!isFieldVisible(field, visibility)) return null;

					if (field.type === 'grid') {
						return (
							<SchemaGrid grid={field} onChange={onChange} draftItem={draftItem} key={field.fields.map((f) => f.key).join('-')} />
						);
					}

					return <SchemaField field={field} key={field.key} onChange={onChange} draftItem={draftItem} />;
				})}
			</div>
		</div>
	);
}
