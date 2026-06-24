import { Copy } from 'lucide-react';

import { useToast } from '~/usecase/hooks/use-toast';
import {
	Toast,
	ToastClose,
	ToastTitle,
	ToastAction,
	ToastProvider,
	ToastViewport,
	ToastDescription
} from '~/components/ui/toast';

export function Toaster() {
	const { toasts } = useToast();

	return (
		<ToastProvider>
			{toasts.map(function ({ id, title, action, variant, description, ...props }) {
				// Create error message text for copying
				const errorText = [title, description].filter(Boolean).join('\n');
				const isError = variant === 'destructive';

				// Create copy button for error toasts
				const copyAction = isError ? (
					<ToastAction
						className="gap-2"
						altText="Copy error"
						onClick={async () => {
							try {
								await navigator.clipboard.writeText(errorText);
							} catch (err) {
								console.error('Failed to copy:', err);
							}
						}}
					>
						<Copy className="h-4 w-4" />
						Copy
					</ToastAction>
				) : null;

				return (
					<Toast key={id} variant={variant} {...props}>
						<div className="flex items-center gap-2 min-w-0">
							{title && <ToastTitle>{title}</ToastTitle>}
							{title && description && <span className="text-foreground/40">·</span>}
							{description && <ToastDescription>{description}</ToastDescription>}
						</div>
						{action || copyAction}
						<ToastClose />
					</Toast>
				);
			})}
			<ToastViewport />
		</ToastProvider>
	);
}
