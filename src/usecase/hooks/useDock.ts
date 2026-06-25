import React from 'react';
import { useSensor, useSensors, DragEndEvent, PointerSensor, DragMoveEvent, DragStartEvent } from '@dnd-kit/core';

import {
	locate,
	dockAt,
	floatAt,
	PanelId,
	heightOf,
	DockZone,
	placedIds,
	FloatRect,
	ResizeSide,
	DropTarget,
	DockLayout,
	isFloating,
	removePanel,
	resizeFloat,
	floatRectOf,
	resizeColumn,
	resizeHeight,
	canStackInto,
	columnWidthOf,
	loadDockLayout,
	saveDockLayout,
	DEFAULT_MAX_STACK,
	defaultDockLayout,
	DEFAULT_FLOAT_WIDTH,
	clampFloatsToBounds,
	DEFAULT_FLOAT_HEIGHT
} from '~/usecase/util/dock';

interface ColGeom {
	left: number;
	right: number;
	panelY: number[];
}

interface DragGeom {
	zones: Record<DockZone, { h: number; top: number; cols: (null | ColGeom)[] }>;
}

export interface DockApi {
	guard: boolean;
	layout: DockLayout;
	floating: PanelId[];
	dragLayout: DockLayout;
	resetLayout: () => void;
	dragging: null | PanelId;
	dropTarget: null | DropTarget;
	setResizing: (value: boolean) => void;
	sensors: ReturnType<typeof useSensors>;
	isRenderable: (id: PanelId) => boolean;
	handleDragEnd: (event: DragEndEvent) => void;
	workspaceRef: React.RefObject<HTMLDivElement>;
	handleDragMove: (event: DragMoveEvent) => void;
	handleDragStart: (event: DragStartEvent) => void;
	dragSize: null | { width: number; height: number };
	resizePanelHeight: (id: PanelId, dy: number) => void;
	origTarget: React.MutableRefObject<null | DropTarget>;
	resizeColumnWidth: (zone: DockZone, ci: number, dx: number) => void;
	resizeFloatPanel: (id: PanelId, side: ResizeSide, dx: number, dy: number) => void;
}

export const useDock = (isContentReady: (id: PanelId) => boolean): DockApi => {
	const [layout, setLayout] = React.useState<DockLayout>(loadDockLayout);
	const [dragging, setDragging] = React.useState<null | PanelId>(null);
	const [resizing, setResizingState] = React.useState(false);
	const layoutRef = React.useRef(layout);
	layoutRef.current = layout;

	const setResizing = React.useCallback((value: boolean) => {
		setResizingState(value);
		if (!value) requestAnimationFrame(() => saveDockLayout(layoutRef.current));
	}, []);
	const [dragSize, setDragSize] = React.useState<null | { width: number; height: number }>(null);
	const [dropTarget, setDropTarget] = React.useState<null | DropTarget>(null);

	const workspaceRef = React.useRef<HTMLDivElement>(null);
	const dragGeom = React.useRef<null | DragGeom>(null);
	const origTarget = React.useRef<null | DropTarget>(null);
	const dragOrigin = React.useRef<{ top: number; left: number }>({ top: 0, left: 0 });
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
	const maxStack = DEFAULT_MAX_STACK;

	const buildDragGeom = (lay: DockLayout): DragGeom => {
		const ws = workspaceRef.current!.getBoundingClientRect();
		const zones = {} as DragGeom['zones'];
		for (const zone of ['left', 'right'] as DockZone[]) {
			const zr = document.querySelector(`[data-dock-zone="${zone}"]`)?.getBoundingClientRect() ?? null;
			const cols = lay[zone].map((col, ci) => {
				const cr = document.querySelector(`[data-dock-col="${zone}:${ci}"]`)?.getBoundingClientRect();
				if (!cr) return null;
				const pr = col
					.map((id) => document.querySelector(`[data-panel-id="${id}"]`)?.getBoundingClientRect() ?? null)
					.filter((r): r is DOMRect => !!r);
				const panelY = pr.length ? [pr[0].top, ...pr.map((r) => r.bottom)] : [cr.top, cr.bottom];
				return { panelY, left: cr.left, right: cr.right };
			});
			zones[zone] = { cols, top: zr ? zr.top : ws.top + 6, h: (zr ? zr.height : ws.height - 12) || ws.height - 12 };
		}
		return { zones };
	};

	const findDropTarget = (dragId: PanelId, delta: { x: number; y: number }): null | DropTarget => {
		const ws = workspaceRef.current?.getBoundingClientRect();
		if (!ws) return null;
		const lay = removePanel(layout, dragId);
		if (!dragGeom.current) dragGeom.current = buildDragGeom(lay);
		const geom = dragGeom.current;
		const size = dragSize ?? { width: DEFAULT_FLOAT_WIDTH, height: DEFAULT_FLOAT_HEIGHT };
		const cx = dragOrigin.current.left + delta.x + size.width / 2;
		const cy = dragOrigin.current.top + delta.y + size.height / 2;
		const SNAP = 260;

		let best: null | { d: number; t: DropTarget } = null;
		const add = (t: DropTarget, px: number, py: number) => {
			const d = Math.hypot(px - cx, py - cy);
			if (d < SNAP && (!best || d < best.d)) best = { t, d };
		};

		for (const zone of ['left', 'right'] as DockZone[]) {
			const z = geom.zones[zone];
			const cols = lay[zone];
			const midY = z.top + z.h / 2;

			if (cols.length === 0) {
				add({ zone, col: 0, row: null }, zone === 'left' ? ws.left + size.width / 2 : ws.right - size.width / 2, midY);
				continue;
			}

			for (let ci = 0; ci <= cols.length; ci++) {
				const before = ci > 0 ? z.cols[ci - 1] : null;
				const after = ci < cols.length ? z.cols[ci] : null;
				let gx: number;
				if (ci === 0) gx = after ? after.left : ws.left;
				else if (ci === cols.length) gx = before ? before.right : ws.right;
				else gx = before && after ? (before.right + after.left) / 2 : (after?.left ?? before?.right ?? ws.left);
				add({ zone, col: ci, row: null }, gx, midY);
			}

			for (let ci = 0; ci < cols.length; ci++) {
				const cg = z.cols[ci];
				if (!cg || !canStackInto(cols[ci], dragId, maxStack)) continue;
				const colMidX = (cg.left + cg.right) / 2;
				for (let ri = 0; ri < cg.panelY.length; ri++) add({ zone, col: ci, row: ri }, colMidX, cg.panelY[ri]);
			}
		}

		return best ? best.t : null;
	};

	const dropRect = (lay: DockLayout, id: PanelId, delta: { x: number; y: number }): FloatRect => {
		const ws = workspaceRef.current?.getBoundingClientRect();
		const prev = floatRectOf(lay, id);
		const width = dragSize?.width ?? DEFAULT_FLOAT_WIDTH;
		const height = prev ? (dragSize?.height ?? DEFAULT_FLOAT_HEIGHT) : DEFAULT_FLOAT_HEIGHT;
		const rawX = dragOrigin.current.left + delta.x - (ws?.left ?? 0);
		const rawY = dragOrigin.current.top + delta.y - (ws?.top ?? 0);
		const x = Math.max(0, Math.min(rawX, (ws?.width ?? width) - width));
		const y = Math.max(0, Math.min(rawY, (ws?.height ?? height) - height));
		return { x, y, width, height };
	};

	const handleDragStart = (event: DragStartEvent) => {
		const id = event.active.id as PanelId;
		const el = document.querySelector(`[data-panel-id="${id}"]`);
		const rect = el?.getBoundingClientRect();
		dragOrigin.current = { top: rect?.top ?? 0, left: rect?.left ?? 0 };
		dragGeom.current = null;
		const loc = locate(layout, id);
		const orig = loc ? { col: loc.col, zone: loc.zone, row: layout[loc.zone][loc.col].length > 1 ? loc.row : null } : null;
		origTarget.current = orig;
		setDragSize(rect ? { width: rect.width, height: rect.height } : null);
		setDragging(id);
		setDropTarget(orig);
	};

	const handleDragMove = (event: DragMoveEvent) => {
		setDropTarget(findDropTarget(event.active.id as PanelId, event.delta));
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const id = event.active.id as PanelId;
		const target = findDropTarget(id, event.delta);
		dragGeom.current = null;
		setDragging(null);
		setDropTarget(null);
		setLayout((prev) => {
			const next = target ? dockAt(prev, id, target, maxStack) : floatAt(prev, id, dropRect(prev, id, event.delta));
			saveDockLayout(next);
			return next;
		});
	};

	const resizeColumnWidth = (zone: DockZone, ci: number, dx: number) => {
		const dir = zone === 'left' ? 1 : -1;
		setLayout((prev) => resizeColumn(prev, zone, ci, columnWidthOf(prev, zone, ci) + dir * dx));
	};

	const resizePanelHeight = (id: PanelId, dy: number) => {
		setLayout((prev) => resizeHeight(prev, id, heightOf(prev, id) + dy));
	};

	const resizeFloatPanel = (id: PanelId, side: ResizeSide, dx: number, dy: number) => {
		const ws = workspaceRef.current?.getBoundingClientRect();
		const bounds = ws ? { width: ws.width, height: ws.height } : undefined;
		setLayout((prev) => resizeFloat(prev, id, side, dx, dy, bounds));
	};

	const resetLayout = () => {
		const next = defaultDockLayout();
		saveDockLayout(next);
		setLayout(next);
	};

	React.useEffect(() => {
		const onResize = () => {
			const ws = workspaceRef.current?.getBoundingClientRect();
			if (!ws) return;
			setLayout((prev) => {
				const next = clampFloatsToBounds(prev, { width: ws.width, height: ws.height });
				if (next !== prev) saveDockLayout(next);
				return next;
			});
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	const isRenderable = (id: PanelId) => id !== dragging && isContentReady(id);
	const guard = !!dragging || resizing;
	const dragLayout = dragging ? removePanel(layout, dragging) : layout;
	const placed = placedIds(dragLayout);
	const floating = placed.filter((id) => isFloating(dragLayout, id) && isRenderable(id));

	return {
		guard,
		layout,
		sensors,
		dragging,
		dragSize,
		floating,
		dragLayout,
		dropTarget,
		origTarget,
		setResizing,
		resetLayout,
		workspaceRef,
		isRenderable,
		handleDragEnd,
		handleDragMove,
		handleDragStart,
		resizeFloatPanel,
		resizeColumnWidth,
		resizePanelHeight
	};
};
