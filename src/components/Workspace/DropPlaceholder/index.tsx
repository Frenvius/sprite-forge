import React from 'react';

import { cn } from '~/lib/utils';

interface DropPlaceholderProps {
	size: number;
	animate: boolean;
	vertical: boolean;
	stretch?: boolean;
}

const DropPlaceholder = ({ size, animate, stretch, vertical }: DropPlaceholderProps) => {
	const [open, setOpen] = React.useState(!animate);
	React.useEffect(() => {
		if (!animate) return;
		const raf = requestAnimationFrame(() => setOpen(true));
		return () => cancelAnimationFrame(raf);
	}, [animate]);
	const style = stretch ? undefined : vertical ? { height: open ? size : 0 } : { width: open ? size : 0 };
	return (
		<div
			style={style}
			className={cn(
				'overflow-hidden rounded-lg bg-primary/15 ring-1 ring-inset ring-primary/40',
				stretch ? 'h-full w-full flex-1' : 'flex-shrink-0',
				animate && 'duration-200 ease-out',
				!stretch && (vertical ? 'w-full' : 'h-full'),
				animate && !stretch && (vertical ? 'transition-[height]' : 'transition-[width]')
			)}
		/>
	);
};

export default DropPlaceholder;
