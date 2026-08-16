/**
 * CheckerBoard Component
 *
 * Provides a solid background for transparent sprite rendering.
 * Uses a dark themed color that matches the UI design.
 */

import { cn } from '~/lib/utils';

interface CheckerBoardProps {
	className?: string;
	children?: React.ReactNode;
	style?: React.CSSProperties;
}

export const CheckerBoard = ({ style, children, className = '' }: CheckerBoardProps) => {
	return (
		<div style={style} className={cn('relative bg-muted', className)}>
			{children}
		</div>
	);
};
