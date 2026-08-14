import type { ItemsStripProps } from '~/components/TemplateEditorWindow/types';

import { Trash2, Pencil } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { ItemThumb } from '~/components/TemplateEditorWindow/ItemThumb';

export const ItemsStrip = ({ items, sheet, onEdit, selected, onSelect, onRemove, editingIndex }: ItemsStripProps) => {
	const toggle = (index: number, additive: boolean) => {
		const next = additive ? new Set(selected) : new Set<number>();
		if (next.has(index)) next.delete(index);
		else next.add(index);
		onSelect(next);
	};

	return (
		<div className="flex h-full flex-col overflow-hidden rounded-lg bg-card shadow-island-lg">
			<div className="flex h-8 items-center justify-between gap-2 border-b border-border/50 bg-secondary/80 px-3">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
					Template items <span className="ml-1 font-normal text-muted-foreground">{items.length}</span>
				</h2>
				<div className="flex items-center gap-1">
					<Button
						size="sm"
						variant="ghost"
						className="h-6 px-2 text-[10px]"
						onClick={() => onSelect(new Set(items.map((_, index) => index)))}
					>
						Select all
					</Button>
					<Button
						size="icon"
						variant="ghost"
						onClick={onRemove}
						title="Remove selected"
						disabled={!selected.size}
						className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>

			<ScrollArea className="min-h-0 flex-1">
				{items.length ? (
					<div className="flex flex-wrap gap-2 p-2">
						{items.map((item, index) => (
							<div
								key={`${item.label}-${index}`}
								onDoubleClick={() => onEdit(index)}
								onClick={(event) => toggle(index, event.ctrlKey || event.shiftKey)}
								className={cn(
									'group flex w-24 cursor-pointer flex-col items-center gap-1 rounded border p-2 transition-colors',
									selected.has(index) ? 'border-primary bg-primary/10' : 'border-border/50 hover:bg-secondary/40',
									editingIndex === index && 'ring-1 ring-orange-400'
								)}
							>
								<div className="flex h-12 items-center justify-center">
									<ItemThumb item={item} sheet={sheet} />
								</div>
								<span className="w-full truncate text-center text-[10px] text-foreground">{item.label}</span>
								<span className="text-[9px] text-muted-foreground">
									{item.geometry.width}x{item.geometry.height}
								</span>
								<Button
									size="icon"
									variant="ghost"
									title="Edit item"
									className="h-5 w-5 opacity-0 group-hover:opacity-100"
									onClick={(event) => {
										event.stopPropagation();
										onEdit(index);
									}}
								>
									<Pencil className="h-3 w-3" />
								</Button>
							</div>
						))}
					</div>
				) : (
					<div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
						Compose an object and press Add item
					</div>
				)}
			</ScrollArea>
		</div>
	);
};
