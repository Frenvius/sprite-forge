import type { AttrDef, ServerProfile } from '@/lib/formats/tibia';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DEDICATED_KEYS } from '@/lib/formats/tibia';
import { Plus, Search, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const TYPE_TAG: Record<string, string> = {
	number: 'num',
	string: 'text',
	boolean: 'bool'
};

interface AddAttributesPopoverProps {
	usedKeys: Set<string>;
	profile: ServerProfile;
	onAdd: (keys: string[]) => void;
}

export const AddAttributesPopover = ({ onAdd, profile, usedKeys }: AddAttributesPopoverProps) => {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const groups = useMemo(() => {
		const q = search.trim().toLowerCase();
		const byCategory = new Map<string, AttrDef[]>();
		for (const d of profile.attributes) {
			if (DEDICATED_KEYS.has(d.key) || usedKeys.has(d.key)) continue;
			if (q && !d.key.toLowerCase().includes(q)) continue;
			const list = byCategory.get(d.category);
			if (list) list.push(d);
			else byCategory.set(d.category, [d]);
		}
		return Array.from(byCategory.entries());
	}, [profile, usedKeys, search]);

	const toggle = (key: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	const commit = () => {
		if (selected.size > 0) onAdd(Array.from(selected));
		setSelected(new Set());
		setSearch('');
		setOpen(false);
	};

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) {
			setSelected(new Set());
			setSearch('');
		}
	};

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs text-foreground flex items-center justify-between gap-1.5 hover:bg-accent/50 transition-colors"
				>
					<span className="flex items-center gap-1.5">
						<Plus className="h-3.5 w-3.5" />
						Add attribute
					</span>
					<ChevronDown className="h-4 w-4 opacity-50" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
				<div className="p-2 border-b border-border/50">
					<div className="relative">
						<Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
						<Input
							autoFocus
							value={search}
							className="h-7 text-xs pl-7"
							placeholder="Search attributes…"
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
				</div>

				<div className="max-h-72 overflow-y-auto sf-cq">
					<div className="p-2 space-y-2">
						{groups.length === 0 && (
							<div className="text-[11px] text-muted-foreground italic py-4 text-center">No matching attributes.</div>
						)}
						{groups.map(([category, defs]) => (
							<div key={category}>
								<div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 pb-1">{category}</div>
								<div className="sf-attr-grid gap-x-2 gap-y-0.5">
									{defs.map((d) => (
										<button
											key={d.key}
											type="button"
											onClick={() => toggle(d.key)}
											className="flex items-center gap-2 rounded px-1.5 py-1 text-xs text-left hover:bg-secondary/60"
										>
											<Checkbox checked={selected.has(d.key)} className="h-3.5 w-3.5 pointer-events-none" />
											<span className="truncate flex-1">{d.key}</span>
											{d.values ? (
												<span className="text-[9px] text-muted-foreground flex-shrink-0">list</span>
											) : (
												<span className="text-[9px] text-muted-foreground flex-shrink-0">{TYPE_TAG[d.type]}</span>
											)}
										</button>
									))}
								</div>
							</div>
						))}
					</div>
				</div>

				<div className="p-2 border-t border-border/50 flex items-center justify-between">
					<span className="text-[11px] text-muted-foreground">{selected.size} selected</span>
					<Button size="sm" onClick={commit} className="h-7 text-xs" disabled={selected.size === 0}>
						Add {selected.size > 0 ? `(${selected.size})` : ''}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
};
