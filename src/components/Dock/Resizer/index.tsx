import React from 'react';

import { cn } from '~/lib/utils';
import { ResizeSide } from '~/usecase/util/dock';

interface ResizerProps {
	gap?: boolean;
	side: ResizeSide;
	dir: 'x' | 'y' | 'xy';
	onResizeEnd?: () => void;
	onResizeStart?: () => void;
	onResize: (delta: { dx: number; dy: number }) => void;
}

const POSITION: Record<ResizeSide, string> = {
	top: 'inset-x-0 -top-1.5 h-3 cursor-row-resize',
	left: 'inset-y-0 -left-1.5 w-3 cursor-col-resize',
	right: 'inset-y-0 -right-1.5 w-3 cursor-col-resize',
	bottom: 'inset-x-0 -bottom-1.5 h-3 cursor-row-resize',
	'top-left': '-top-1.5 -left-1.5 h-3.5 w-3.5 cursor-nwse-resize',
	'top-right': '-top-1.5 -right-1.5 h-3.5 w-3.5 cursor-nesw-resize',
	'bottom-left': '-bottom-1.5 -left-1.5 h-3.5 w-3.5 cursor-nesw-resize',
	'bottom-right': '-bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize'
};

const GAP_POSITION: Partial<Record<ResizeSide, string>> = {
	top: 'inset-x-0 -top-[9px] h-3 cursor-row-resize',
	left: 'inset-y-0 -left-[9px] w-3 cursor-col-resize',
	right: 'inset-y-0 -right-[9px] w-3 cursor-col-resize',
	bottom: 'inset-x-0 -bottom-[9px] h-3 cursor-row-resize'
};

const CURSOR: Record<ResizeSide, string> = {
	top: 'row-resize',
	left: 'col-resize',
	right: 'col-resize',
	bottom: 'row-resize',
	'top-left': 'nwse-resize',
	'top-right': 'nesw-resize',
	'bottom-left': 'nesw-resize',
	'bottom-right': 'nwse-resize'
};

const CURSOR_STYLE_ID = 'resizer-global-cursor';

const setGlobalCursor = (cursor: null | string) => {
	const existing = document.getElementById(CURSOR_STYLE_ID);
	if (!cursor) {
		existing?.remove();
		return;
	}
	const el = (existing as HTMLStyleElement) ?? document.createElement('style');
	el.id = CURSOR_STYLE_ID;
	el.textContent = `* { cursor: ${cursor} !important; }`;
	if (!existing) document.head.appendChild(el);
};

const Resizer = ({ gap, dir, side, onResize, onResizeEnd, onResizeStart }: ResizerProps) => {
	const last = React.useRef({ x: 0, y: 0 });
	const [active, setActive] = React.useState(false);

	function onPointerDown(e: React.PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		last.current = { x: e.clientX, y: e.clientY };
		setActive(true);
		setGlobalCursor(CURSOR[side]);
		onResizeStart?.();
		const move = (ev: PointerEvent) => {
			onResize({ dx: ev.clientX - last.current.x, dy: ev.clientY - last.current.y });
			last.current = { x: ev.clientX, y: ev.clientY };
		};
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			setActive(false);
			setGlobalCursor(null);
			onResizeEnd?.();
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}

	const corner = dir === 'xy';
	const position = (gap && GAP_POSITION[side]) || POSITION[side];

	return (
		<div onPointerDown={onPointerDown} className={cn('group absolute', corner ? 'z-20' : 'z-10', position)}>
			{!corner && (
				<div
					style={
						dir === 'x'
							? { background: 'linear-gradient(to bottom, transparent 0%, hsl(var(--primary)) 50%, transparent 100%)' }
							: { background: 'linear-gradient(to right, transparent 0%, hsl(var(--primary)) 50%, transparent 100%)' }
					}
					className={cn(
						'pointer-events-none absolute rounded-full transition-opacity duration-150',
						active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
						dir === 'x' ? 'inset-y-2 left-1/2 w-px -translate-x-1/2' : 'inset-x-2 top-1/2 h-px -translate-y-1/2'
					)}
				/>
			)}
		</div>
	);
};

export default Resizer;
