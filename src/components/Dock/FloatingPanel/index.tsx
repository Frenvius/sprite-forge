import Resizer from '~/components/Dock/Resizer';
import DockablePanel from '~/components/Dock/DockablePanel';
import { PanelId, PanelMeta, FloatRect, ResizeSide, DragHandleProps } from '~/usecase/util/dock';

interface FloatingPanelProps {
	id: PanelId;
	meta: PanelMeta;
	rect: FloatRect;
	guarded?: boolean;
	onResizeEnd?: () => void;
	onResizeStart?: () => void;
	children: (handle: DragHandleProps) => React.ReactNode;
	onResize: (side: ResizeSide, dx: number, dy: number) => void;
}

const SIDES: { side: ResizeSide; dir: 'x' | 'y' | 'xy' }[] = [
	{ dir: 'y', side: 'top' },
	{ dir: 'x', side: 'left' },
	{ dir: 'x', side: 'right' },
	{ dir: 'y', side: 'bottom' },
	{ dir: 'xy', side: 'top-left' },
	{ dir: 'xy', side: 'top-right' },
	{ dir: 'xy', side: 'bottom-left' },
	{ dir: 'xy', side: 'bottom-right' }
];

const FloatingPanel = ({ id, meta, rect, guarded, onResize, children, onResizeEnd, onResizeStart }: FloatingPanelProps) => {
	const style: React.CSSProperties = meta.resizable
		? { top: rect.y, left: rect.x, width: rect.width, height: rect.height }
		: { top: rect.y, left: rect.x };

	return (
		<div style={style} className="absolute z-20 rounded-lg shadow-[0_10px_40px_-5px_rgba(0,0,0,0.65)] ring-1 ring-black/40">
			<DockablePanel id={id} guarded={guarded} className="h-full">
				{children}
			</DockablePanel>
			{meta.resizable &&
				SIDES.map(({ dir, side }) => (
					<Resizer
						dir={dir}
						key={side}
						side={side}
						onResizeEnd={onResizeEnd}
						onResizeStart={onResizeStart}
						onResize={({ dx, dy }) => onResize(side, dx, dy)}
					/>
				))}
		</div>
	);
};

export default FloatingPanel;
