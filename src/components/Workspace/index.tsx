import React from 'react';
import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';

import { DockApi } from '~/usecase/hooks/useDock';
import DockSide from '~/components/Workspace/DockSide';
import FloatingPanel from '~/components/Dock/FloatingPanel';
import { PanelId, panelMeta, floatRectOf, DragHandleProps } from '~/usecase/util/dock';

interface WorkspaceProps {
	dock: DockApi;
	children: React.ReactNode;
	renderPanel: (id: PanelId, handle?: DragHandleProps) => React.ReactNode;
}

export const Workspace = ({ dock, children, renderPanel }: WorkspaceProps) => {
	const renderFloatingPanel = (id: PanelId) => {
		const rect = floatRectOf(dock.layout, id);
		if (!rect) return null;
		return (
			<FloatingPanel
				id={id}
				key={id}
				rect={rect}
				meta={panelMeta(id)}
				guarded={dock.guard}
				onResizeEnd={() => dock.setResizing(false)}
				onResizeStart={() => dock.setResizing(true)}
				onResize={(side, dx, dy) => dock.resizeFloatPanel(id, side, dx, dy)}
			>
				{(handle) => renderPanel(id, handle)}
			</FloatingPanel>
		);
	};

	return (
		<DndContext
			sensors={dock.sensors}
			onDragEnd={dock.handleDragEnd}
			onDragMove={dock.handleDragMove}
			onDragStart={dock.handleDragStart}
			collisionDetection={pointerWithin}
		>
			<div ref={dock.workspaceRef} className="relative flex min-h-0 flex-1 gap-1.5 overflow-hidden p-1.5">
				<DockSide zone="left" dock={dock} renderPanel={renderPanel} />

				<div className="relative flex min-h-0 min-w-0 flex-1">{children}</div>

				<DockSide dock={dock} zone="right" renderPanel={renderPanel} />

				{dock.floating.map(renderFloatingPanel)}
			</div>

			<DragOverlay dropAnimation={null}>
				{dock.dragging ? (
					<div
						style={{ width: dock.dragSize?.width, height: dock.dragSize?.height }}
						className="cursor-grabbing rounded-lg shadow-[0_10px_40px_-5px_rgba(0,0,0,0.65)] ring-1 ring-black/40"
					>
						{renderPanel(dock.dragging)}
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
};
