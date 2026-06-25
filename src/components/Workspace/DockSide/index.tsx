import React from 'react';

import { cn } from '~/lib/utils';
import Resizer from '~/components/Dock/Resizer';
import { DockApi } from '~/usecase/hooks/useDock';
import DockablePanel from '~/components/Dock/DockablePanel';
import DropPlaceholder from '~/components/Workspace/DropPlaceholder';
import {
	PanelId,
	heightOf,
	DockZone,
	DropTarget,
	columnWidthOf,
	DragHandleProps,
	DEFAULT_FLOAT_WIDTH,
	DEFAULT_FLOAT_HEIGHT
} from '~/usecase/util/dock';

interface DockSideProps {
	dock: DockApi;
	zone: DockZone;
	renderPanel: (id: PanelId, handle?: DragHandleProps) => React.ReactNode;
}

const sameTarget = (a: null | DropTarget, b: null | DropTarget) =>
	!!a && !!b && a.zone === b.zone && a.col === b.col && a.row === b.row;

const DockSide = ({ zone, dock, renderPanel }: DockSideProps) => {
	const { guard, dragSize, dragLayout, dropTarget, origTarget, setResizing, isRenderable } = dock;

	const renderStackItem = (id: PanelId, ri: number, count: number) => {
		const last = ri === count - 1;
		return (
			<div
				key={id}
				style={last ? undefined : { height: heightOf(dragLayout, id) }}
				className={cn('relative min-h-0', last ? 'flex-1' : 'flex-shrink-0')}
			>
				<DockablePanel id={id} guarded={guard} className="h-full">
					{(handle) => renderPanel(id, handle)}
				</DockablePanel>
				{!last && (
					<Resizer
						gap
						dir="y"
						side="bottom"
						onResizeEnd={() => setResizing(false)}
						onResizeStart={() => setResizing(true)}
						onResize={({ dy }) => dock.resizePanelHeight(id, dy)}
					/>
				)}
			</div>
		);
	};

	const renderColumn = (ci: number, panels: PanelId[], rowPh: number, animate: boolean) => {
		const fullH = dragSize?.height ?? DEFAULT_FLOAT_HEIGHT;
		const items: React.ReactNode[] = [];
		for (let ri = 0; ri <= panels.length; ri++) {
			if (ri === rowPh) {
				const size = animate ? Math.min(fullH, 200) : fullH;
				items.push(<DropPlaceholder vertical size={size} animate={animate} key={`ph-${zone}-${ci}`} />);
			}
			if (ri < panels.length) items.push(renderStackItem(panels[ri], ri, panels.length));
		}
		return (
			<div
				key={`col-${zone}-${ci}`}
				data-dock-col={`${zone}:${ci}`}
				style={{ width: columnWidthOf(dragLayout, zone, ci) }}
				className="relative flex h-full min-h-0 flex-shrink-0 flex-col gap-1.5"
			>
				{items}
				<Resizer
					gap
					dir="x"
					onResizeEnd={() => setResizing(false)}
					onResizeStart={() => setResizing(true)}
					side={zone === 'left' ? 'right' : 'left'}
					onResize={({ dx }) => dock.resizeColumnWidth(zone, ci, dx)}
				/>
			</div>
		);
	};

	const cols = dragLayout[zone];
	const dt = dropTarget;
	const animate = !sameTarget(dt, origTarget.current);
	const newCol = dt && dt.zone === zone && dt.row === null ? dt.col : -1;
	const children: React.ReactNode[] = [];
	for (let ci = 0; ci <= cols.length; ci++) {
		if (ci === newCol) {
			children.push(
				<DropPlaceholder
					vertical={false}
					animate={animate}
					key={`phc-${zone}-${ci}`}
					size={dragSize?.width ?? DEFAULT_FLOAT_WIDTH}
				/>
			);
		}
		if (ci < cols.length) {
			const panels = cols[ci].filter(isRenderable);
			if (panels.length > 0) {
				const rowPh = dt && dt.zone === zone && dt.col === ci && dt.row !== null ? dt.row : -1;
				children.push(renderColumn(ci, panels, rowPh, animate));
			}
		}
	}
	if (children.length === 0) return null;
	return (
		<div data-dock-zone={zone} className="flex h-full flex-shrink-0 gap-1.5">
			{children}
		</div>
	);
};

export default DockSide;
