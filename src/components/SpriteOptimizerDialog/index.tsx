import type { OptimizeResult } from '~/lib/formats/registry';

import { Wand2, ArrowRight, TrendingDown } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { RemovedSpritesGrid } from '~/components/SpriteOptimizerDialog/RemovedSpritesGrid';
import { REASONS, REASON_META, SECTION_LABEL } from '~/components/SpriteOptimizerDialog/constants';
import { Dialog, DialogTitle, DialogHeader, DialogContent, DialogDescription } from '~/components/ui/dialog';

interface SpriteOptimizerDialogProps {
	open: boolean;
	isOptimizing: boolean;
	result: null | OptimizeResult;
	onOptimize: () => Promise<void>;
	onOpenChange: (open: boolean) => void;
	progress: {
		total: number;
		message: string;
		current: number;
	};
}

export function SpriteOptimizerDialog({
	open,
	result,
	progress,
	onOptimize,
	onOpenChange,
	isOptimizing
}: SpriteOptimizerDialogProps) {
	const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
	const savedPercent = result && result.oldTotal > 0 ? Math.round((result.removedCount / result.oldTotal) * 100) : 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[460px]">
				<DialogHeader className="space-y-0 border-b border-border/60 bg-secondary/30 px-5 py-3 pr-12">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
							<Wand2 className="h-4 w-4" />
						</div>
						<div className="min-w-0">
							<DialogTitle className="text-sm font-semibold tracking-tight">Sprites optimizer</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground">
								Strips duplicate, unused and blank sprites from the file
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-3 px-5 py-3.5">
					{!result && (
						<div className="space-y-1.5">
							<span className={SECTION_LABEL}>What gets removed</span>
							<div className="space-y-1">
								{REASONS.map((reason) => {
									const meta = REASON_META[reason];
									const Icon = meta.icon;
									return (
										<div
											key={reason}
											className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2"
										>
											<Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
											<span className="min-w-0">
												<span className="block text-xs font-medium text-foreground">{meta.label}</span>
												<span className="block text-[11px] leading-snug text-muted-foreground">{meta.description}</span>
											</span>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{result && (
						<>
							<div className="flex items-center gap-4 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2.5">
								<div>
									<span className={SECTION_LABEL}>Before</span>
									<span className="block text-lg font-semibold leading-tight tabular-nums text-muted-foreground">
										{result.oldTotal}
									</span>
								</div>
								<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
								<div>
									<span className={SECTION_LABEL}>After</span>
									<span className="block text-lg font-semibold leading-tight tabular-nums text-foreground">
										{result.newTotal}
									</span>
								</div>
								<div className="ml-auto flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-1 text-primary ring-1 ring-inset ring-primary/25">
									<TrendingDown className="h-3.5 w-3.5" />
									<span className="text-xs font-semibold tabular-nums">
										{result.removedCount} ({savedPercent}%)
									</span>
								</div>
							</div>

							{result.removed && result.removed.length > 0 && (
								<RemovedSpritesGrid removed={result.removed} counts={result.removedByReason} previewPath={result.previewPath} />
							)}
						</>
					)}

					{(isOptimizing || result) && (
						<div className="space-y-1.5">
							<div className="flex items-center justify-between text-[11px] text-muted-foreground">
								<span className="truncate">{progress.message}</span>
								<span className="shrink-0 tabular-nums">{percentage}%</span>
							</div>
							<Progress className="h-1.5" value={percentage} />
						</div>
					)}
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-border/60 bg-secondary/20 px-5 py-2.5">
					<Button size="sm" type="button" variant="ghost" disabled={isOptimizing} onClick={() => onOpenChange(false)}>
						Close
					</Button>
					<Button size="sm" type="button" className="gap-1.5" onClick={onOptimize} disabled={isOptimizing}>
						<Wand2 className={cn('h-3.5 w-3.5', isOptimizing && 'animate-pulse')} />
						{isOptimizing ? 'Optimizing...' : result ? 'Run again' : 'Start'}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
