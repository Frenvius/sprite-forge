import React from 'react';
import { AlertTriangle } from 'lucide-react';

import { cn } from '~/lib/utils';
import { type ConfirmResult, type ConfirmOptions, type ConfirmContextValue } from './types';
import {
	AlertDialog,
	AlertDialogTitle,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogContent,
	AlertDialogDescription
} from '~/components/ui/alert-dialog';

interface PendingConfirm {
	opts: ConfirmOptions;
	resolve: (value: ConfirmResult) => void;
}

const ConfirmContext = React.createContext<null | ConfirmContextValue>(null);

export const ConfirmProvider = ({ children }: { children: React.ReactNode }) => {
	const [pending, setPending] = React.useState<null | PendingConfirm>(null);

	const confirm = React.useCallback(
		(opts: ConfirmOptions) => new Promise<ConfirmResult>((resolve) => setPending({ opts, resolve })),
		[]
	);

	const resolveWith = React.useCallback(
		(value: ConfirmResult) => {
			pending?.resolve(value);
			setPending(null);
		},
		[pending]
	);

	const value = React.useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm]);

	const opts = pending?.opts;
	const variant = opts?.variant ?? 'default';

	return (
		<ConfirmContext.Provider value={value}>
			{children}
			<AlertDialog open={!!pending} onOpenChange={(open) => (!open ? resolveWith(false) : null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle
							className={cn(
								'flex items-center gap-2',
								variant === 'destructive' && 'text-destructive',
								variant === 'warning' && 'text-amber-500'
							)}
						>
							{(variant === 'warning' || variant === 'destructive') && <AlertTriangle className="h-5 w-5" />}
							{opts?.title}
						</AlertDialogTitle>
						{opts?.description && <AlertDialogDescription>{opts.description}</AlertDialogDescription>}
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => resolveWith(false)}>{opts?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
						{opts?.alternateLabel && (
							<AlertDialogAction
								onClick={() => resolveWith('alternate')}
								className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
							>
								{opts.alternateLabel}
							</AlertDialogAction>
						)}
						<AlertDialogAction
							onClick={() => resolveWith(true)}
							className={cn(variant === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
						>
							{opts?.confirmLabel ?? 'Confirm'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</ConfirmContext.Provider>
	);
};

export const useConfirm = (): ConfirmContextValue['confirm'] => {
	const ctx = React.useContext(ConfirmContext);
	if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
	return ctx.confirm;
};
