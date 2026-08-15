import type { ItemsStripProps } from '~/components/TemplateEditorWindow/types';

import { useRef } from 'react';
import { Copy, Trash2, Pencil } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { ItemThumb } from '~/components/TemplateEditorWindow/ItemThumb';
import { ContextMenu, ContextMenuItem, ContextMenuContent, ContextMenuTrigger } from '~/components/ui/context-menu';

export const ItemsStrip = ({ items, sheet, onEdit, selected, onSelect, onRemove, onDuplicate }: ItemsStripProps) => {
	const anchor = useRef<null | number>(null);

	const click = (index: number, event: React.MouseEvent) => {
		if (event.shiftKey && anchor.current !== null) {
			const [from, to] = [anchor.current, index].sort((a, b) => a - b);
			const range = new Set(event.ctrlKey ? selected : []);
			for (let i = from; i <= to; i++) range.add(i);
			onSelect(range);
			return;
		}

		anchor.current = index;

		if (event.ctrlKey) {
			const next = new Set(selected);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			onSelect(next);
			return;
		}

		onSelect(selected.size === 1 && selected.has(index) ? new Set() : new Set([index]));
	};

	const contextMenu = (index: number) => {
		if (selected.has(index)) return;
		anchor.current = index;
		onSelect(new Set([index]));
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
					<div
						className="flex flex-wrap gap-2 p-2"
						onClick={(event) => {
							if (event.target === event.currentTarget) onSelect(new Set());
						}}
					>
						{items.map((item, index) => (
							<ContextMenu key={`${item.label}-${index}`}>
								<ContextMenuTrigger asChild>
									<div
										onDoubleClick={() => onEdit(index)}
										onClick={(event) => click(index, event)}
										onContextMenu={() => contextMenu(index)}
										className={cn(
											'flex w-24 cursor-pointer flex-col items-center gap-1 rounded border p-2 transition-colors',
											selected.has(index) ? 'border-primary bg-primary/10' : 'border-border/50 hover:bg-secondary/40'
										)}
									>
										<div className="flex h-12 items-center justify-center">
											<ItemThumb item={item} sheet={sheet} />
										</div>
										<span className="w-full truncate text-center text-[10px] text-foreground">{item.label}</span>
										<span className="text-[9px] text-muted-foreground">
											{item.geometry.width}x{item.geometry.height}
										</span>
									</div>
								</ContextMenuTrigger>
								<ContextMenuContent>
									<ContextMenuItem onSelect={() => onEdit(index)}>
										<Pencil className="mr-2 h-3.5 w-3.5" />
										Edit item
									</ContextMenuItem>
									<ContextMenuItem onSelect={onDuplicate}>
										<Copy className="mr-2 h-3.5 w-3.5" />
										{selected.size > 1 ? `Duplicate ${selected.size} items` : 'Duplicate'}
									</ContextMenuItem>
									<ContextMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
										<Trash2 className="mr-2 h-3.5 w-3.5" />
										{selected.size > 1 ? `Remove ${selected.size} items` : 'Remove'}
									</ContextMenuItem>
								</ContextMenuContent>
							</ContextMenu>
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
