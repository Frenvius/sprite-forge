import type { TemplateListProps } from '~/components/TemplateEditorWindow/types';

import { Plus, Copy, Trash2, LayoutTemplate } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { ContextMenu, ContextMenuItem, ContextMenuContent, ContextMenuTrigger } from '~/components/ui/context-menu';

export const TemplateList = ({ onNew, onLoad, onDelete, templates, activeName, onDuplicate }: TemplateListProps) => (
	<div className="flex h-full flex-col overflow-hidden rounded-lg bg-card shadow-island-lg">
		<div className="flex h-8 items-center justify-between gap-2 border-b border-border/50 bg-secondary/80 px-3">
			<h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">Templates</h2>
			<Button size="icon" variant="ghost" onClick={onNew} className="h-6 w-6" title="New template">
				<Plus className="h-3.5 w-3.5" />
			</Button>
		</div>

		<ScrollArea className="min-h-0 flex-1">
			{templates.length ? (
				<div className="flex flex-col gap-0.5 p-1">
					{templates.map((template) => (
						<ContextMenu key={template.name}>
							<ContextMenuTrigger asChild>
								<div
									onClick={() => onLoad(template)}
									className={cn(
										'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors',
										template.name === activeName ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-secondary/50'
									)}
								>
									<LayoutTemplate className="h-3.5 w-3.5 shrink-0 opacity-60" />
									<span className="min-w-0 flex-1 truncate">{template.name}</span>
									<span className="text-[10px] opacity-60">{template.items.length}</span>
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent className="w-40">
								<ContextMenuItem className="text-xs" onSelect={() => onDuplicate(template)}>
									<Copy className="mr-2 h-3.5 w-3.5" />
									Duplicate
								</ContextMenuItem>
								<ContextMenuItem
									onSelect={() => onDelete(template.name)}
									className="text-xs text-destructive focus:text-destructive"
								>
									<Trash2 className="mr-2 h-3.5 w-3.5" />
									Delete
								</ContextMenuItem>
							</ContextMenuContent>
						</ContextMenu>
					))}
				</div>
			) : (
				<div className="p-4 text-center text-[11px] text-muted-foreground">No templates saved yet</div>
			)}
		</ScrollArea>
	</div>
);
