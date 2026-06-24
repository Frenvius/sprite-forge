import { useRef, useState, useEffect } from 'react';

import { Progress } from '~/components/ui/progress';
import { Dialog, DialogTitle, DialogHeader, DialogContent, DialogDescription } from '~/components/ui/dialog';

interface LoadingDialogProps {
	open: boolean;
	stage?: string;
	total?: number;
	current?: number;
}

// Loads finishing under this threshold never reveal the modal — fast loads feel instant.
const REVEAL_DELAY_MS = 200;

export const LoadingDialog = ({ open, stage, current = 0, total = 100 }: LoadingDialogProps) => {
	const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
	const [reveal, setReveal] = useState(false);
	const timerRef = useRef<null | number>(null);

	useEffect(() => {
		if (!open) {
			setReveal(false);
			if (timerRef.current !== null) {
				window.clearTimeout(timerRef.current);
				timerRef.current = null;
			}
			return;
		}
		timerRef.current = window.setTimeout(() => {
			setReveal(true);
			timerRef.current = null;
		}, REVEAL_DELAY_MS);
		return () => {
			if (timerRef.current !== null) {
				window.clearTimeout(timerRef.current);
				timerRef.current = null;
			}
		};
	}, [open]);

	return (
		<Dialog open={open && reveal}>
			<DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
				<DialogHeader>
					<DialogTitle>Loading Tibia Files</DialogTitle>
					<DialogDescription>Please wait while we load the client data...</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">{stage || 'Loading...'}</span>
							<span className="font-mono font-medium">{percentage}%</span>
						</div>
						<Progress className="h-2" value={percentage} />
					</div>

					{total > 0 && (
						<div className="text-xs text-muted-foreground text-center font-mono">
							{current.toLocaleString()} / {total.toLocaleString()}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
