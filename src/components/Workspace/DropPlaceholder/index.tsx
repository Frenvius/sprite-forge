import React from 'react';

import { cn } from '~/lib/utils';

interface DropPlaceholderProps {
	size: number;
	animate: boolean;
	vertical: boolean;
}

const DropPlaceholder = ({ size, animate, vertical }: DropPlaceholderProps) => {
	const [open, setOpen] = React.useState(!animate);
	React.useEffect(() => {
		if (!animate) return;
		const raf = requestAnimationFrame(() => setOpen(true));
		return () => cancelAnimationFrame(raf);
	}, [animate]);
	return (
		<div
			style={vertical ? { height: open ? size : 0 } : { width: open ? size : 0 }}
			className={cn(
				'flex-shrink-0 overflow-hidden rounded-lg bg-primary/15 ring-1 ring-inset ring-primary/40',
				animate && 'duration-200 ease-out',
				vertical ? 'w-full' : 'h-full',
				animate && (vertical ? 'transition-[height]' : 'transition-[width]')
			)}
		/>
	);
};

export default DropPlaceholder;
