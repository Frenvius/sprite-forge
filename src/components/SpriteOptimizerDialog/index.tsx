import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { Dialog, DialogTitle, DialogFooter, DialogHeader, DialogContent, DialogDescription } from '~/components/ui/dialog';

interface SpriteOptimizerDialogProps {
	open: boolean;
	isOptimizing: boolean;
	onOptimize: () => Promise<void>;
	onOpenChange: (open: boolean) => void;
	progress: {
		total: number;
		message: string;
		current: number;
	};
	result: null | {
		oldTotal: number;
		newTotal: number;
		removedCount: number;
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

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[400px] bg-background/95 backdrop-blur-sm">
				<DialogHeader>
					<DialogTitle>Sprites Optimizer</DialogTitle>
					<DialogDescription>Optimize your sprite file by removing unused and duplicate sprites.</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-4">
					<div className="border rounded-md p-4 space-y-2 bg-muted/30">
						<h4 className="text-sm font-medium mb-2 text-muted-foreground">Result</h4>
						<div className="grid grid-cols-2 gap-2 text-sm">
							<span className="text-muted-foreground">Removed sprites:</span>
							<span className="font-mono text-right">{result ? result.removedCount : 0}</span>

							<span className="text-muted-foreground">Old sprite count:</span>
							<span className="font-mono text-right">{result ? result.oldTotal : 0}</span>

							<span className="text-muted-foreground">New sprite count:</span>
							<span className="font-mono text-right">{result ? result.newTotal : 0}</span>
						</div>
					</div>

					<div className="space-y-2">
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>Progress</span>
							<span>{percentage}%</span>
						</div>
						<Progress className="h-2" value={percentage} />
						<p className="text-xs text-muted-foreground h-4 truncate">{progress.message}</p>
					</div>
				</div>

				<DialogFooter className="sm:justify-between">
					<Button type="button" variant="secondary" disabled={isOptimizing} onClick={() => onOpenChange(false)}>
						Close
					</Button>
					<Button type="button" onClick={onOptimize} disabled={isOptimizing}>
						{isOptimizing ? 'Optimizing...' : 'Start'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
