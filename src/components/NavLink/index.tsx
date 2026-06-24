import { forwardRef } from 'react';
import { NavLinkProps, NavLink as RouterNavLink } from 'react-router-dom';

import { cn } from '~/lib/utils';

interface NavLinkCompatProps extends Omit<NavLinkProps, 'className'> {
	className?: string;
	activeClassName?: string;
	pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
	({ to, className, activeClassName, pendingClassName, ...props }, ref) => {
		return (
			<RouterNavLink
				to={to}
				ref={ref}
				className={({ isActive, isPending }) => cn(className, isActive && activeClassName, isPending && pendingClassName)}
				{...props}
			/>
		);
	}
);

NavLink.displayName = 'NavLink';

export { NavLink };
