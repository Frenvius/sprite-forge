import { Trash2 } from 'lucide-react';

import { Input } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import { Button } from '~/components/ui/button';
import { type AttrRowProps } from '~/components/PropertiesPanel/ServerSection/types';
import { Select, SelectItem, SelectValue, SelectTrigger, SelectContent } from '~/components/ui/select';

const isTrue = (v: string) => v === '1' || v.toLowerCase() === 'true';

export const AttrRow = ({ def, attr, onChange, onRemove }: AttrRowProps) => {
	const nested = !!attr.children && attr.children.length > 0;
	const type = def?.type ?? 'string';

	let control;
	if (nested) {
		control = <Input disabled value="(nested)" className="h-7 text-xs flex-1" />;
	} else if (def?.values && def.values.length > 0) {
		control = (
			<Select value={attr.value} onValueChange={onChange}>
				<SelectTrigger className="h-7 text-xs flex-1">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{def.values.map((v) => (
						<SelectItem key={v} value={v} className="text-xs">
							{v}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	} else if (type === 'boolean') {
		control = (
			<div className="flex-1 flex items-center">
				<Switch className="scale-75" checked={isTrue(attr.value)} onCheckedChange={(c) => onChange(c ? '1' : '0')} />
			</div>
		);
	} else {
		control = (
			<Input
				value={attr.value}
				className="h-7 text-xs flex-1"
				onChange={(e) => onChange(e.target.value)}
				type={type === 'number' ? 'number' : 'text'}
			/>
		);
	}

	return (
		<div className="flex items-center gap-1.5">
			<span title={attr.key} className="text-[11px] text-foreground w-28 flex-shrink-0 truncate">
				{attr.key}
			</span>
			{control}
			<Button
				size="icon"
				variant="ghost"
				onClick={onRemove}
				className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
			>
				<Trash2 className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
};
