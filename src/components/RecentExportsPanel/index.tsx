import React from 'react';
import { Trash2, FileBox, Package } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { DragHandleProps } from '~/usecase/util/dock';
import { ScrollArea } from '~/components/ui/scroll-area';
import { useTransfer } from '~/usecase/context/TransferContext';
import { getRecentExports, clearRecentExports, RECENT_EXPORTS_EVENT } from '~/usecase/util/recentExports';

export const RecentExportsPanel = ({ dragHandle }: { dragHandle?: DragHandleProps }) => {
	const { openImport } = useTransfer();
	const [exports, setExports] = React.useState(getRecentExports);
	const handleProps = dragHandle ? { ref: dragHandle.ref, ...dragHandle.attributes, ...dragHandle.listeners } : {};

	React.useEffect(() => {
		const refresh = () => setExports(getRecentExports());
		window.addEventListener(RECENT_EXPORTS_EVENT, refresh);
		return () => window.removeEventListener(RECENT_EXPORTS_EVENT, refresh);
	}, []);

	return (
		<div className="w-full h-full bg-card rounded-lg shadow-island flex flex-col overflow-hidden flex-shrink-0">
			<div
				{...handleProps}
				className={cn(
					'h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80 flex-shrink-0',
					dragHandle && 'cursor-grab active:cursor-grabbing'
				)}
			>
				<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Exported Objects</h2>
				{exports.length > 0 && (
					<div className="ml-auto flex items-center gap-1">
						<span className="text-xs text-muted-foreground font-mono">{exports.length}</span>
						<Button
							size="icon"
							variant="ghost"
							title="Clear history"
							onClick={() => clearRecentExports()}
							className="h-5 w-5 hover:bg-destructive/20 hover:text-destructive"
						>
							<Trash2 className="h-3 w-3" />
						</Button>
					</div>
				)}
			</div>

			{exports.length === 0 ? (
				<div className="flex-1 flex items-center justify-center p-4 min-h-0">
					<div className="text-center text-muted-foreground text-xs">No exports yet</div>
				</div>
			) : (
				<ScrollArea className="flex-1 min-h-0">
					<div className="space-y-0.5 p-2">
						{exports.map((e) => (
							<div
								key={e.path}
								title={`${e.path}\nDouble-click to open in viewer`}
								onDoubleClick={() => openImport({ paths: [e.path], source: e.source })}
								className="w-full rounded-md px-2 py-1 hover:bg-item-hover transition-colors cursor-pointer flex items-center justify-between gap-2"
							>
								<div className="flex items-center gap-2 min-w-0">
									{e.source === 'sfp' ? (
										<Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
									) : (
										<FileBox className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
									)}
									<span className="text-[11px] text-foreground truncate">{e.name}</span>
								</div>
								<span className="text-[9px] uppercase font-mono text-muted-foreground flex-shrink-0">{e.source}</span>
							</div>
						))}
					</div>
				</ScrollArea>
			)}
		</div>
	);
};
