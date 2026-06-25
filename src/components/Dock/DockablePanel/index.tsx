import { useDraggable } from '@dnd-kit/core';

import { cn } from '~/lib/utils';
import { PanelId, DragHandleProps } from '~/usecase/util/dock';

interface DockablePanelProps {
	id: PanelId;
	guarded?: boolean;
	className?: string;
	children: (handle: DragHandleProps) => React.ReactNode;
}

const HANDLE_CLASS = 'cursor-grab active:cursor-grabbing';

const DockablePanel = ({ id, guarded, children, className = 'min-h-0 flex-1' }: DockablePanelProps) => {
	const { listeners, setNodeRef, attributes, isDragging, setActivatorNodeRef } = useDraggable({ id });

	const handle: DragHandleProps = {
		listeners,
		attributes,
		className: HANDLE_CLASS,
		ref: setActivatorNodeRef
	};

	return (
		<div
			ref={setNodeRef}
			data-panel-id={id}
			className={cn(className, isDragging && 'opacity-40', guarded && 'pointer-events-none select-none')}
		>
			{children(handle)}
		</div>
	);
};

export default DockablePanel;
