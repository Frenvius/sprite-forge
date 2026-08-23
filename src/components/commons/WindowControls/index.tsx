import React from 'react';
import { X, Copy, Minus, Square } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { cn } from '~/lib/utils';
import { useWindowControls } from '~/usecase/hooks/useWindowControls';

interface WindowControlsProps {
	className?: string;
	onClose?: () => void | Promise<void>;
}

export const WindowControls = ({ onClose, className }: WindowControlsProps) => {
	const { minimize, isMaximized, toggleMaximize } = useWindowControls();
	const [isMac, setIsMac] = React.useState(false);

	React.useEffect(() => {
		setIsMac(navigator.userAgent.includes('Mac'));
	}, []);

	const stop = (e: React.MouseEvent) => e.stopPropagation();

	const handleMinimize = async (e: React.MouseEvent) => {
		e.stopPropagation();
		await minimize();
	};

	const handleMaximize = async (e: React.MouseEvent) => {
		e.stopPropagation();
		await toggleMaximize();
	};

	const handleClose = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onClose) await onClose();
		else await getCurrentWindow().close();
	};

	if (isMac) {
		return (
			<div className={cn('flex items-center gap-2 mr-4 group ml-2', className)}>
				<div
					onMouseDown={stop}
					onClick={handleClose}
					className="w-3 h-3 rounded-full bg-[#FF5F56] hover:bg-[#FF5F56]/80 cursor-pointer flex items-center justify-center border border-black/10 transition-colors"
				>
					<X className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
				</div>
				<div
					onMouseDown={stop}
					onClick={handleMinimize}
					className="w-3 h-3 rounded-full bg-[#FFBD2E] hover:bg-[#FFBD2E]/80 cursor-pointer flex items-center justify-center border border-black/10 transition-colors"
				>
					<Minus className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
				</div>
				<div
					onMouseDown={stop}
					onClick={handleMaximize}
					className="w-3 h-3 rounded-full bg-[#27C93F] hover:bg-[#27C93F]/80 cursor-pointer flex items-center justify-center border border-black/10 transition-colors"
				>
					<Square className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
				</div>
			</div>
		);
	}

	return (
		<div className={cn('ml-2 flex items-center flex-shrink-0 -mr-3', className)}>
			<button
				type="button"
				onMouseDown={stop}
				aria-label="Minimize"
				onClick={handleMinimize}
				className="h-8 w-9 inline-flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors"
			>
				<Minus strokeWidth={1.5} className="h-4 w-4" />
			</button>
			<button
				type="button"
				onMouseDown={stop}
				onClick={handleMaximize}
				aria-label={isMaximized ? 'Restore' : 'Maximize'}
				className="h-8 w-9 inline-flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors"
			>
				{isMaximized ? (
					<Copy strokeWidth={1.5} className="h-3.5 w-3.5 -scale-x-100" />
				) : (
					<Square strokeWidth={1.5} className="h-3.5 w-3.5" />
				)}
			</button>
			<button
				type="button"
				onMouseDown={stop}
				aria-label="Close"
				onClick={handleClose}
				className="h-8 w-9 inline-flex items-center justify-center text-foreground/70 hover:text-white hover:bg-[#e81123] transition-colors"
			>
				<X strokeWidth={1.5} className="h-4 w-4" />
			</button>
		</div>
	);
};
