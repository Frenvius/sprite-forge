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
}

export const CheckerBoard = ({ children, className = '' }: CheckerBoardProps) => {
	return <div className={cn('relative bg-muted', className)}>{children}</div>;
};
