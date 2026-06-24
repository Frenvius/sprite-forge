import { useState } from 'react';
import { Copy, Check, AlertTriangle } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { type ErrorDialogProps } from './types';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Dialog, DialogTitle, DialogFooter, DialogHeader, DialogContent, DialogDescription } from '~/components/ui/dialog';

export type { ErrorInfo } from './types';

export const ErrorDialog = ({ info, onClose }: ErrorDialogProps) => {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		if (!info) return;
		try {
			await navigator.clipboard.writeText(info.message);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	};

	return (
		<Dialog
			open={!!info}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-destructive">
						<AlertTriangle className="h-5 w-5" />
						{info?.title ?? 'Error'}
					</DialogTitle>
					<DialogDescription>The full error details are below. Copy them to keep a record or report the issue.</DialogDescription>
				</DialogHeader>

				<ScrollArea className="max-h-[50vh] rounded-md border border-border bg-muted/40">
					<pre className="whitespace-pre-wrap break-words select-text p-3 font-mono text-xs leading-relaxed text-foreground">
						{info?.message}
					</pre>
				</ScrollArea>

				<DialogFooter className="gap-2">
					<Button variant="outline" onClick={handleCopy}>
						{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
						{copied ? 'Copied' : 'Copy'}
					</Button>
					<Button onClick={onClose}>Close</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
