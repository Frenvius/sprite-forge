import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
	X,
	Eye,
	Copy,
	Plus,
	Crop,
	Wand2,
	Minus,
	Square,
	EyeOff,
	Layers,
	Trash2,
	ArrowUp,
	RotateCw,
	Scissors,
	ArrowDown,
	Maximize2,
	Minimize2,
	RotateCcw,
	FolderOpen,
	SquareDashed,
	ChevronsDown,
	FlipVertical,
	MousePointer2,
	FlipHorizontal
} from 'lucide-react';

import { cn } from '~/lib/utils';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { useDock } from '~/usecase/hooks/useDock';
import { Workspace } from '~/components/Workspace';
import { DragHandleProps } from '~/usecase/util/dock';
import { useTheme } from '~/usecase/context/ThemeContext';
import { LayerView } from '~/components/SlicerWindow/LayerView';
import { SlicerPanel } from '~/components/SlicerWindow/SlicerPanel';
import { SelectOp, DragMode } from '~/components/SlicerWindow/types';
import { useWindowControls } from '~/usecase/hooks/useWindowControls';
import { Layer, opaqueBounds, useSpriteSlicer } from '~/usecase/hooks/useSpriteSlicer';
import { SLICER_PANEL_IDS, SLICER_DOCK_DEFAULT, SLICER_DOCK_STORAGE_KEY } from '~/components/SlicerWindow/constants';
import {
	CUR_ADD,
	CUR_SUB,
	CUR_HAND,
	CUR_WAND,
	CUR_CROP,
	CUR_MOVE_SEL,
	CUR_WAND_ADD,
	CUR_WAND_SUB,
	CUR_HAND_GRAB,
	CUR_INTERSECT,
	CUR_WAND_INTERSECT
} from '~/usecase/util/slicerCursors';

const numberInput = (value: number, setValue: (n: number) => void, min: number, max: number) => (
	<Input
		min={min}
		max={max}
		type="number"
		value={value}
		className="h-6 px-1.5 text-[11px]"
		onChange={(e) => {
			const n = Number(e.target.value);
			if (!Number.isFinite(n)) return;
			setValue(Math.max(min, Math.min(max, Math.floor(n))));
		}}
	/>
);

export const SlicerWindow = () => {
	const v = useSpriteSlicer();
	const [resizeW, setResizeW] = React.useState(0);
	const [resizeH, setResizeH] = React.useState(0);
	const [linked, setLinked] = React.useState(true);
	const [smooth, setSmooth] = React.useState(false);
	const [snapResize, setSnapResize] = React.useState(true);
	const [snapSelect, setSnapSelect] = React.useState(true);
	const { minimize, isMaximized, toggleMaximize } = useWindowControls();
	const { acrylic, isWindows } = useTheme();
	const [isMac, setIsMac] = React.useState(false);
	const transparentRoot = (isWindows && acrylic) || isMac;

	React.useEffect(() => {
		setIsMac(navigator.userAgent.includes('Mac'));
	}, []);

	const activeCanvas = v.activeLayer?.canvas ?? null;

	React.useEffect(() => {
		if (activeCanvas) {
			setResizeW(activeCanvas.width);
			setResizeH(activeCanvas.height);
		}
	}, [activeCanvas]);

	const aspectScale = (newW: number) => {
		if (!activeCanvas) return;
		setResizeW(newW);
		if (linked) setResizeH(Math.max(1, Math.round((newW * activeCanvas.height) / activeCanvas.width)));
	};
	const aspectScaleH = (newH: number) => {
		if (!activeCanvas) return;
		setResizeH(newH);
		if (linked) setResizeW(Math.max(1, Math.round((newH * activeCanvas.width) / activeCanvas.height)));
	};

	const [spaceHeld, setSpaceHeld] = React.useState(false);
	const [dragging, setDragging] = React.useState(false);
	const [transforming, setTransforming] = React.useState(false);
	const [transformPreview, setTransformPreview] = React.useState<null | { x: number; y: number; w: number; h: number }>(null);
	const transformPreviewRef = React.useRef<null | { x: number; y: number; w: number; h: number }>(null);
	transformPreviewRef.current = transformPreview;
	const [selectedLayerId, setSelectedLayerId] = React.useState<null | string>(null);
	const [mods, setMods] = React.useState({ alt: false, ctrl: false, shift: false });
	const [pan, setPan] = React.useState({ x: 0, y: 0 });
	const [hover, setHover] = React.useState<null | { x: number; y: number }>(null);
	const panRef = React.useRef(pan);
	panRef.current = pan;
	const mousePosRef = React.useRef<null | { clientX: number; clientY: number }>(null);

	const dock = useDock(() => true, {
		autoFillKinds: [],
		knownPanelIds: SLICER_PANEL_IDS,
		defaultLayout: SLICER_DOCK_DEFAULT,
		storageKey: SLICER_DOCK_STORAGE_KEY
	});

	React.useEffect(() => {
		setSelectedLayerId(null);
	}, [v.tool]);

	React.useEffect(() => {
		const isEditable = (el: null | EventTarget) => {
			const t = el as null | HTMLElement;
			if (!t) return false;
			return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
		};
		const syncMods = (e: MouseEvent | KeyboardEvent) => {
			setMods({ alt: e.altKey, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
		};
		const onDown = (e: KeyboardEvent) => {
			syncMods(e);
			if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight' || e.key === 'F10') {
				e.preventDefault();
				return;
			}
			if (isEditable(e.target)) return;
			if (e.code === 'Space') {
				if (!e.repeat) setSpaceHeld(true);
				e.preventDefault();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
				e.preventDefault();
				v.clearSelection();
				v.clearPixelMask();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
				e.preventDefault();
				if (e.shiftKey) v.redo();
				else v.undo();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
				e.preventDefault();
				v.redo();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
				e.preventDefault();
				if (v.activeLayer) setTransforming((t) => !t);
				return;
			}
			if (v.pixelMask && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				e.preventDefault();
				const step = e.shiftKey ? 10 : 1;
				const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
				const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
				v.translatePixelMask(dx, dy);
				return;
			}
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			const k = e.key.toLowerCase();
			if (k === 'v') v.setTool('cursor');
			else if (k === 'c') v.setTool('crop');
			else if (k === 'm') v.setTool('select');
			else if (k === 'w') v.setTool('wand');
			else if (e.key === 'Delete' || e.key === 'Backspace') {
				if (v.pixelMask) {
					e.preventDefault();
					v.deleteSelectedPixels();
				} else if (e.key === 'Backspace' && v.activeLayerId) {
					e.preventDefault();
					v.removeLayer(v.activeLayerId);
				}
			} else if (k === 'escape') {
				setSelectedLayerId(null);
				setTransforming(false);
				v.clearPixelMask();
			} else if (k === 'enter') {
				if (transforming) setTransforming(false);
			}
		};
		const onUp = (e: KeyboardEvent) => {
			syncMods(e);
			if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight' || e.key === 'F10') {
				e.preventDefault();
				return;
			}
			if (e.code === 'Space') setSpaceHeld(false);
		};
		const onMouseMove = (e: MouseEvent) => {
			syncMods(e);
			mousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
		};
		window.addEventListener('keydown', onDown);
		window.addEventListener('keyup', onUp);
		window.addEventListener('mousemove', onMouseMove);
		return () => {
			window.removeEventListener('keydown', onDown);
			window.removeEventListener('keyup', onUp);
			window.removeEventListener('mousemove', onMouseMove);
		};
	}, [v, transforming]);

	React.useEffect(() => {
		if (!v.activeLayer) setTransforming(false);
	}, [v.activeLayer]);

	const cropCursor = () => {
		if (mods.ctrl && v.hasSelection) return CUR_MOVE_SEL;
		if (mods.shift && mods.alt) return CUR_INTERSECT;
		if (mods.shift) return CUR_ADD;
		if (mods.alt) return CUR_SUB;
		return CUR_CROP;
	};

	const wandCursor = () => {
		if (mods.shift && mods.alt) return CUR_WAND_INTERSECT;
		if (mods.shift) return CUR_WAND_ADD;
		if (mods.alt) return CUR_WAND_SUB;
		return CUR_WAND;
	};

	const workspaceCursor = () => {
		if (spaceHeld) return dragging ? CUR_HAND_GRAB : CUR_HAND;
		if (v.tool === 'crop' || v.tool === 'select') return cropCursor();
		if (v.tool === 'wand') return wandCursor();
		return 'default';
	};

	const imageCursor = () => {
		if (spaceHeld) return dragging ? CUR_HAND_GRAB : CUR_HAND;
		if (v.tool === 'crop') {
			if (mods.ctrl && v.hasSelection) return CUR_MOVE_SEL;
			return cropCursor();
		}
		if (v.tool === 'wand') return wandCursor();
		if (v.tool === 'cursor') return dragging ? CUR_HAND_GRAB : CUR_MOVE_SEL;
		return 'default';
	};

	React.useEffect(() => {
		const onPaste = (e: ClipboardEvent) => {
			const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
			if (!item) return;
			e.preventDefault();
			const file = item.getAsFile();
			if (!file) return;
			const ws = workspaceRef.current;
			const m = mousePosRef.current;
			let center: undefined | { x: number; y: number };
			if (ws && m) {
				const rect = ws.getBoundingClientRect();
				if (m.clientX >= rect.left && m.clientX <= rect.right && m.clientY >= rect.top && m.clientY <= rect.bottom) {
					center = {
						y: (m.clientY - rect.top - panRef.current.y) / v.zoom,
						x: (m.clientX - rect.left - panRef.current.x) / v.zoom
					};
				}
			}
			void v.loadFromFile(file, center ? { center } : undefined);
		};
		window.addEventListener('paste', onPaste);
		return () => window.removeEventListener('paste', onPaste);
	}, [v]);

	const maskRef = React.useRef<null | HTMLCanvasElement>(null);
	const overlayRef = React.useRef<null | HTMLCanvasElement>(null);
	const previewRef = React.useRef<null | HTMLCanvasElement>(null);
	const previewRectRef = React.useRef<null | { x: number; y: number; w: number; h: number; op: SelectOp }>(null);
	const pathRef = React.useRef<null | Path2D>(null);
	const zoomRef = React.useRef(v.zoom);
	zoomRef.current = v.zoom;
	const workspaceRef = React.useRef<null | HTMLDivElement>(null);
	const [previewRect, setPreviewRect] = React.useState<null | { x: number; y: number; w: number; h: number; op: SelectOp }>(null);
	previewRectRef.current = previewRect;
	const dragRef = React.useRef<null | {
		op?: SelectOp;
		origX: number;
		origY: number;
		mode: DragMode;
		startWX: number;
		startWY: number;
		maskSnap?: Set<string>;
	}>(null);

	React.useEffect(() => {
		const c = maskRef.current;
		if (!c) return;
		c.width = v.workspaceSize;
		c.height = v.workspaceSize;
		const ctx = c.getContext('2d')!;
		ctx.clearRect(0, 0, c.width, c.height);
		ctx.fillStyle = 'rgba(255,220,0,0.18)';
		ctx.strokeStyle = 'rgba(255,255,255,1)';
		ctx.lineWidth = 1.5;
		const tile = v.gridSize;
		const set = v.selectedCells;
		for (const k of set) {
			const [cs, rs] = k.split(',');
			ctx.fillRect(Number(cs) * tile, Number(rs) * tile, tile, tile);
		}
		for (const k of set) {
			const [cs, rs] = k.split(',');
			const c2 = Number(cs);
			const r2 = Number(rs);
			const x = c2 * tile;
			const y = r2 * tile;
			ctx.beginPath();
			if (!set.has(`${c2},${r2 - 1}`)) {
				ctx.moveTo(x, y + 0.5);
				ctx.lineTo(x + tile, y + 0.5);
			}
			if (!set.has(`${c2},${r2 + 1}`)) {
				ctx.moveTo(x, y + tile - 0.5);
				ctx.lineTo(x + tile, y + tile - 0.5);
			}
			if (!set.has(`${c2 - 1},${r2}`)) {
				ctx.moveTo(x + 0.5, y);
				ctx.lineTo(x + 0.5, y + tile);
			}
			if (!set.has(`${c2 + 1},${r2}`)) {
				ctx.moveTo(x + tile - 0.5, y);
				ctx.lineTo(x + tile - 0.5, y + tile);
			}
			ctx.stroke();
		}
	}, [v.selectedCells, v.gridSize, v.workspaceSize]);

	const maskLayer = v.pixelMask ? v.layers.find((l) => l.id === v.pixelMask?.layerId) : null;

	React.useLayoutEffect(() => {
		const mask = v.pixelMask;
		if (!mask) {
			pathRef.current = null;
			return;
		}
		const { w: W, h: H, data, bounds: b } = mask;
		const xLo = b.x;
		const yLo = b.y;
		const xHi = b.x + b.w;
		const yHi = b.y + b.h;
		const p = new Path2D();
		const sample = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H && data[y * W + x] ? 1 : 0);
		for (let y = yLo; y <= yHi; y++) {
			let s = -1;
			for (let x = xLo; x <= xHi; x++) {
				const inX = x < xHi;
				const edge = inX && sample(x, y - 1) !== sample(x, y);
				if (edge) {
					if (s < 0) s = x;
				} else if (s >= 0) {
					p.moveTo(s, y);
					p.lineTo(x, y);
					s = -1;
				}
			}
		}
		for (let x = xLo; x <= xHi; x++) {
			let s = -1;
			for (let y = yLo; y <= yHi; y++) {
				const inY = y < yHi;
				const edge = inY && sample(x - 1, y) !== sample(x, y);
				if (edge) {
					if (s < 0) s = y;
				} else if (s >= 0) {
					p.moveTo(x, s);
					p.lineTo(x, y);
					s = -1;
				}
			}
		}
		pathRef.current = p;
	}, [v.pixelMask]);

	const dashOffsetRef = React.useRef(0);
	const drawOverlayRef = React.useRef<() => void>(() => {});
	drawOverlayRef.current = () => {
		const c = overlayRef.current;
		if (!c) return;
		const m = v.pixelMask;
		const path = pathRef.current;
		if (!m || !path) return;
		const b = m.bounds;
		const dpr = window.devicePixelRatio || 1;
		const z = v.zoom;
		const padCss = 2;
		const padDev = padCss * dpr;
		const pxW = Math.max(1, Math.ceil(b.w * z * dpr + padDev * 2));
		const pxH = Math.max(1, Math.ceil(b.h * z * dpr + padDev * 2));
		if (c.width !== pxW) c.width = pxW;
		if (c.height !== pxH) c.height = pxH;
		const ctx = c.getContext('2d')!;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, c.width, c.height);
		ctx.setTransform(z * dpr, 0, 0, z * dpr, -b.x * z * dpr + padDev, -b.y * z * dpr + padDev);
		ctx.lineWidth = 1 / z;
		ctx.setLineDash([6 / z, 6 / z]);
		ctx.lineDashOffset = -dashOffsetRef.current / z;
		ctx.strokeStyle = '#fff';
		ctx.stroke(path);
		ctx.lineDashOffset = -(dashOffsetRef.current + 6) / z;
		ctx.strokeStyle = '#000';
		ctx.stroke(path);
	};

	const drawPreviewRef = React.useRef<() => void>(() => {});
	drawPreviewRef.current = () => {
		const c = previewRef.current;
		if (!c) return;
		const r = previewRectRef.current;
		if (!r) return;
		const dpr = window.devicePixelRatio || 1;
		const z = v.zoom;
		const padCss = 2;
		const padDev = padCss * dpr;
		const pxW = Math.max(1, Math.ceil(r.w * z * dpr + padDev * 2));
		const pxH = Math.max(1, Math.ceil(r.h * z * dpr + padDev * 2));
		if (c.width !== pxW) c.width = pxW;
		if (c.height !== pxH) c.height = pxH;
		const ctx = c.getContext('2d')!;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, c.width, c.height);
		ctx.setTransform(z * dpr, 0, 0, z * dpr, padDev, padDev);
		ctx.lineWidth = 1 / z;
		ctx.setLineDash([6 / z, 6 / z]);
		ctx.lineDashOffset = -dashOffsetRef.current / z;
		ctx.strokeStyle = '#fff';
		ctx.strokeRect(0, 0, r.w, r.h);
		ctx.lineDashOffset = -(dashOffsetRef.current + 6) / z;
		ctx.strokeStyle = '#000';
		ctx.strokeRect(0, 0, r.w, r.h);
	};

	React.useLayoutEffect(() => {
		drawOverlayRef.current();
		drawPreviewRef.current();
	}, [v.zoom, v.pixelMask, previewRect]);

	React.useEffect(() => {
		let raf = 0;
		let last = performance.now();
		const tick = (now: number) => {
			const dt = now - last;
			last = now;
			dashOffsetRef.current = (dashOffsetRef.current + dt * 0.015) % 12;
			drawOverlayRef.current();
			drawPreviewRef.current();
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	const workspaceCoords = (e: { clientX: number; clientY: number }) => {
		const ws = workspaceRef.current;
		if (!ws) return { x: 0, y: 0 };
		const rect = ws.getBoundingClientRect();
		return {
			y: (e.clientY - rect.top - panRef.current.y) / v.zoom,
			x: (e.clientX - rect.left - panRef.current.x) / v.zoom
		};
	};

	const opFromEvent = (e: MouseEvent | React.MouseEvent): SelectOp => {
		if (e.shiftKey && e.altKey) return 'intersect';
		if (e.shiftKey) return 'add';
		if (e.altKey) return 'subtract';
		return 'replace';
	};

	React.useLayoutEffect(() => {
		const ws = workspaceRef.current;
		if (!ws) return;
		const rect = ws.getBoundingClientRect();
		setPan({
			x: Math.round((rect.width - v.workspaceSize * v.zoom) / 2),
			y: Math.round((rect.height - v.workspaceSize * v.zoom) / 2)
		});
	}, []);

	React.useEffect(() => {
		const ws = workspaceRef.current;
		if (!ws) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			if (e.ctrlKey || e.metaKey || e.altKey) {
				const rect = ws.getBoundingClientRect();
				const cx = e.clientX - rect.left;
				const cy = e.clientY - rect.top;
				const wx = (cx - panRef.current.x) / v.zoom;
				const wy = (cy - panRef.current.y) / v.zoom;
				const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
				const next = Math.max(0.1, Math.min(32, v.zoom * factor));
				v.setZoom(next);
				setPan({ x: Math.round(cx - wx * next), y: Math.round(cy - wy * next) });
				return;
			}
			if (e.shiftKey) {
				setPan((p) => ({ y: p.y, x: p.x - e.deltaY }));
				return;
			}
			setPan((p) => ({ x: p.x, y: p.y - e.deltaY }));
		};
		ws.addEventListener('wheel', onWheel, { passive: false });
		return () => ws.removeEventListener('wheel', onWheel);
	}, [v]);

	const startPanView = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragging(true);
		const startX = e.clientX;
		const startY = e.clientY;
		const startPan = panRef.current;
		const onMove = (ev: MouseEvent) => {
			setPan({ x: Math.round(startPan.x + (ev.clientX - startX)), y: Math.round(startPan.y + (ev.clientY - startY)) });
		};
		const onUp = () => {
			setDragging(false);
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	};

	const startTransformDrag = (fx: number, fy: number) => (e: React.MouseEvent) => {
		const layer = v.activeLayer;
		if (!layer) return;
		e.stopPropagation();
		e.preventDefault();
		setDragging(true);
		const start = workspaceCoords(e);
		const orig = { x: layer.x, y: layer.y, w: layer.canvas.width, h: layer.canvas.height };
		const onMove = (ev: MouseEvent) => {
			const { x, y } = workspaceCoords(ev);
			const dWX = x - start.x;
			const dWY = y - start.y;
			let newX = orig.x;
			let newY = orig.y;
			let newW = orig.w;
			let newH = orig.h;
			if (fx === 0) {
				newX = orig.x + dWX;
				newW = orig.w - dWX;
			} else if (fx === 1) {
				newW = orig.w + dWX;
			}
			if (fy === 0) {
				newY = orig.y + dWY;
				newH = orig.h - dWY;
			} else if (fy === 1) {
				newH = orig.h + dWY;
			}
			if (linked && fx !== 0.5 && fy !== 0.5) {
				const ratio = orig.w / orig.h;
				if (Math.abs(newW - orig.w) * orig.h > Math.abs(newH - orig.h) * orig.w) {
					newH = newW / ratio;
					if (fy === 0) newY = orig.y + (orig.h - newH);
				} else {
					newW = newH * ratio;
					if (fx === 0) newX = orig.x + (orig.w - newW);
				}
			}
			if (ev.shiftKey) {
				const scaleW = fx === 0.5 ? null : newW / orig.w;
				const scaleH = fy === 0.5 ? null : newH / orig.h;
				let scale: number;
				if (scaleW === null && scaleH === null) scale = 1;
				else if (scaleW === null) scale = scaleH!;
				else if (scaleH === null) scale = scaleW;
				else scale = Math.abs(scaleW - 1) > Math.abs(scaleH - 1) ? scaleW : scaleH;
				if (scale >= 1) scale = Math.max(1, Math.round(scale));
				else scale = 1 / Math.max(1, Math.round(1 / scale));
				if (fx !== 0.5) {
					const rW = Math.max(1, Math.round(orig.w * scale));
					if (fx === 0) newX = orig.x + (orig.w - rW);
					newW = rW;
				}
				if (fy !== 0.5) {
					const rH = Math.max(1, Math.round(orig.h * scale));
					if (fy === 0) newY = orig.y + (orig.h - rH);
					newH = rH;
				}
			} else if (snapResize) {
				const g = v.gridSize;
				if (fx !== 0.5) {
					const rW = Math.max(g, Math.round(newW / g) * g);
					if (fx === 0) newX = orig.x + (orig.w - rW);
					newW = rW;
				}
				if (fy !== 0.5) {
					const rH = Math.max(g, Math.round(newH / g) * g);
					if (fy === 0) newY = orig.y + (orig.h - rH);
					newH = rH;
				}
			}
			newW = Math.max(1, Math.round(newW));
			newH = Math.max(1, Math.round(newH));
			setTransformPreview({ w: newW, h: newH, x: Math.round(newX), y: Math.round(newY) });
		};
		const onUp = () => {
			setDragging(false);
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			const p = transformPreviewRef.current;
			setTransformPreview(null);
			if (!p || !v.activeLayer) return;
			if (p.w === orig.w && p.h === orig.h && p.x === orig.x && p.y === orig.y) return;
			v.resize(p.w, p.h, smooth);
			v.setLayerPos(v.activeLayer.id, p.x, p.y);
		};
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	};

	const selRect = (sx: number, sy: number, ex: number, ey: number) => {
		let x0 = sx;
		let y0 = sy;
		let x1 = ex;
		let y1 = ey;
		if (snapSelect) {
			const g = v.gridSize;
			const thr = 6 / v.zoom;
			const snap = (n: number) => {
				const s = Math.round(n / g) * g;
				return Math.abs(n - s) <= thr ? s : n;
			};
			x0 = snap(x0);
			y0 = snap(y0);
			x1 = snap(x1);
			y1 = snap(y1);
		}
		const nx = Math.min(x0, x1);
		const ny = Math.min(y0, y1);
		const nw = Math.max(1, Math.abs(x1 - x0));
		const nh = Math.max(1, Math.abs(y1 - y0));
		return { x: nx, y: ny, w: nw, h: nh };
	};

	const startDrag = (mode: DragMode, e: React.MouseEvent, dragLayer?: Layer) => {
		e.stopPropagation();
		e.preventDefault();
		if (mode === 'panImage' || mode === 'moveMask') v.pushHistory();
		setDragging(true);
		const { x: wx, y: wy } = workspaceCoords(e);
		const op: SelectOp | undefined = mode === 'createSel' ? opFromEvent(e) : undefined;
		dragRef.current = {
			op,
			mode,
			startWX: wx,
			startWY: wy,
			maskSnap: mode === 'moveMask' ? new Set(v.selectedCells) : undefined,
			origX: mode === 'panImage' ? ((dragLayer ?? v.activeLayer)?.x ?? 0) : 0,
			origY: mode === 'panImage' ? ((dragLayer ?? v.activeLayer)?.y ?? 0) : 0
		};
		const layerForDrag = dragLayer ?? v.activeLayer;
		const onMove = (ev: MouseEvent) => {
			const d = dragRef.current;
			if (!d) return;
			const { x, y } = workspaceCoords(ev);
			if (d.mode === 'panImage') {
				if (layerForDrag) v.setLayerPos(layerForDrag.id, d.origX + (x - d.startWX), d.origY + (y - d.startWY));
			} else if (d.mode === 'moveMask' && d.maskSnap) {
				const dc = Math.round((x - d.startWX) / v.gridSize);
				const dr = Math.round((y - d.startWY) / v.gridSize);
				v.translateMaskFrom(d.maskSnap, dc, dr);
			} else if (d.mode === 'createSel') {
				const r = selRect(d.startWX, d.startWY, x, y);
				setPreviewRect({ ...r, op: d.op ?? 'replace' });
			}
		};
		const onUp = (ev: MouseEvent) => {
			const d = dragRef.current;
			if (d?.mode === 'createSel') {
				const { x, y } = workspaceCoords(ev);
				const r = selRect(d.startWX, d.startWY, x, y);
				if (v.tool === 'select') v.rectSelectPixels(r.x, r.y, r.w, r.h, d.op ?? 'replace');
				else v.applyRectToMask(r.x, r.y, r.w, r.h, d.op ?? 'replace');
				setPreviewRect(null);
			}
			dragRef.current = null;
			setDragging(false);
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	};

	const onWorkspaceMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.target !== e.currentTarget && (e.target as HTMLElement).dataset.role !== 'workspaceCanvas') return;
		if (spaceHeld || e.button === 1) {
			startPanView(e);
			return;
		}
		if (v.tool === 'wand') {
			const { x, y } = workspaceCoords(e);
			v.wandSelectAt(x, y, opFromEvent(e));
			return;
		}
		if (v.tool === 'crop' && (e.ctrlKey || e.metaKey) && v.hasSelection) {
			startDrag('moveMask', e);
			return;
		}
		if (v.tool === 'cursor') {
			if (selectedLayerId) setSelectedLayerId(null);
			return;
		}
		if (v.tool === 'crop' || v.tool === 'select') startDrag('createSel', e);
	};

	const pixelOpaqueAt = (layer: Layer, wx: number, wy: number) => {
		const lx = Math.floor(wx - layer.x);
		const ly = Math.floor(wy - layer.y);
		if (lx < 0 || ly < 0 || lx >= layer.canvas.width || ly >= layer.canvas.height) return false;
		const ctx = layer.canvas.getContext('2d');
		if (!ctx) return false;
		return ctx.getImageData(lx, ly, 1, 1).data[3] > 0;
	};

	const panTweenRef = React.useRef(0);
	const centerOnLayer = (layer: Layer) => {
		const ws = workspaceRef.current;
		if (!ws) return;
		const rect = ws.getBoundingClientRect();
		const b = opaqueBounds(layer.canvas);
		const cx = b ? layer.x + b.x + b.w / 2 : layer.x + layer.canvas.width / 2;
		const cy = b ? layer.y + b.y + b.h / 2 : layer.y + layer.canvas.height / 2;
		const targetX = Math.round(rect.width / 2 - cx * v.zoom);
		const targetY = Math.round(rect.height / 2 - cy * v.zoom);
		const startX = panRef.current.x;
		const startY = panRef.current.y;
		const t0 = performance.now();
		const dur = 250;
		cancelAnimationFrame(panTweenRef.current);
		const tick = (now: number) => {
			const t = Math.min(1, (now - t0) / dur);
			const e = 1 - Math.pow(1 - t, 3);
			setPan({ x: Math.round(startX + (targetX - startX) * e), y: Math.round(startY + (targetY - startY) * e) });
			if (t < 1) panTweenRef.current = requestAnimationFrame(tick);
		};
		panTweenRef.current = requestAnimationFrame(tick);
	};

	const pickLayerAt = (wx: number, wy: number): null | Layer => {
		for (let i = v.layers.length - 1; i >= 0; i--) {
			const l = v.layers[i];
			if (!l.visible) continue;
			if (pixelOpaqueAt(l, wx, wy)) return l;
		}
		return null;
	};

	const onLayerMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, layerId: string) => {
		if (spaceHeld || e.button === 1) {
			startPanView(e);
			return;
		}
		if (v.tool === 'crop' && (e.ctrlKey || e.metaKey) && v.hasSelection) {
			startDrag('moveMask', e);
			return;
		}
		if (v.tool !== 'cursor') return;
		const { x, y } = workspaceCoords(e);
		const hit = pickLayerAt(x, y) ?? v.layers.find((l) => l.id === layerId);
		if (!hit) return;
		if (v.autoSelect && v.activeLayerId !== hit.id) v.setActiveLayerId(hit.id);
		setSelectedLayerId(hit.id);
		startDrag('panImage', e, hit);
	};

	const onDrop = async (e: React.DragEvent) => {
		e.preventDefault();
		const file = e.dataTransfer.files?.[0];
		if (file && /\.(png|bmp|jpe?g)$/i.test(file.name)) {
			await v.loadFromFile(file);
		}
	};

	const slicePreview = (pixels: Uint8Array, keep: boolean, index: number) => {
		const canvas = document.createElement('canvas');
		canvas.width = v.cellSize;
		canvas.height = v.cellSize;
		const ctx = canvas.getContext('2d')!;
		const id = ctx.createImageData(v.cellSize, v.cellSize);
		id.data.set(pixels);
		ctx.putImageData(id, 0, 0);
		return (
			<button
				key={index}
				type="button"
				onClick={() => v.toggleKeep(index)}
				title={keep ? 'Click to exclude' : 'Click to include'}
				className={`relative h-8 w-8 border bg-[#2a2a2a] transition-opacity ${keep ? 'border-primary/70' : 'border-destructive/70 opacity-40'}`}
			>
				<img alt="" src={canvas.toDataURL()} className="h-full w-full" />
				{!keep && <span className="absolute inset-0 flex items-center justify-center text-destructive text-xs font-bold">X</span>}
			</button>
		);
	};

	const handleClose = async () => {
		await getCurrentWindow().close();
	};
	const handleMinimize = async () => {
		await minimize();
	};
	const handleMaximize = async () => {
		await toggleMaximize();
	};

	const renderPanel = (id: string, handle?: DragHandleProps) => {
		if (id === 'slicerGrid') {
			return (
				<SlicerPanel title="Grid" dragHandle={handle}>
					<div className="grid grid-cols-2 gap-1">
						<select
							value={v.gridSize}
							onChange={(e) => v.setGridSize(Number(e.target.value))}
							className="h-6 rounded border border-input bg-background px-1 text-[11px]"
						>
							{[8, 16, 32, 64, 128].map((n) => (
								<option key={n} value={n}>
									{n}px
								</option>
							))}
						</select>
						<select
							value={v.subdivisions}
							onChange={(e) => v.setSubdivisions(Number(e.target.value))}
							className="h-6 rounded border border-input bg-background px-1 text-[11px]"
						>
							{[1, 2, 4, 8].map((n) => (
								<option key={n} value={n}>
									{n === 1 ? 'sub: off' : `sub: 1/${n}`}
								</option>
							))}
						</select>
					</div>
				</SlicerPanel>
			);
		}
		if (id === 'slicerLayers') {
			return (
				<SlicerPanel
					title="Layers"
					dragHandle={handle}
					headerExtra={
						<div className="flex items-center gap-1">
							<button
								type="button"
								title="Merge down"
								onClick={() => v.activeLayerId && v.mergeDown(v.activeLayerId)}
								disabled={!v.activeLayer || v.layers.findIndex((l) => l.id === v.activeLayerId) <= 0}
								className="flex h-4 w-4 items-center justify-center rounded hover:bg-accent hover:text-foreground disabled:opacity-40"
							>
								<ChevronsDown className="h-3 w-3" />
							</button>
							<button
								type="button"
								title="Flatten all"
								onClick={v.flatten}
								disabled={v.layers.length === 0}
								className="flex h-4 w-4 items-center justify-center rounded hover:bg-accent hover:text-foreground disabled:opacity-40"
							>
								<Layers className="h-3 w-3" />
							</button>
						</div>
					}
				>
					<div className="flex flex-col gap-0.5">
						{v.layers.length === 0 && <span className="px-1 text-[10px] text-muted-foreground">No layers</span>}
						{[...v.layers].reverse().map((layer) => {
							const idx = v.layers.findIndex((l) => l.id === layer.id);
							const isActive = layer.id === v.activeLayerId;
							return (
								<div
									key={layer.id}
									onClick={() => v.setActiveLayerId(layer.id)}
									onDoubleClick={() => {
										v.setActiveLayerId(layer.id);
										centerOnLayer(layer);
									}}
									className={cn(
										'group flex items-center gap-1 rounded px-1 py-0.5 text-[11px]',
										isActive ? 'bg-primary/20 text-foreground' : 'text-foreground/80 hover:bg-accent'
									)}
								>
									<button
										type="button"
										title={layer.visible ? 'Hide' : 'Show'}
										className="flex h-4 w-4 items-center justify-center text-foreground/60 hover:text-foreground"
										onClick={(e) => {
											e.stopPropagation();
											v.toggleLayerVisible(layer.id);
										}}
									>
										{layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
									</button>
									<div style={{ overflow: 'hidden' }} className="h-5 w-5 shrink-0 rounded border border-border/50 bg-[#1a1a1a]">
										<canvas
											width={layer.canvas.width}
											height={layer.canvas.height}
											style={{
												width: '100%',
												height: '100%',
												objectFit: 'contain',
												imageRendering: 'pixelated'
											}}
											ref={(c) => {
												if (!c) return;
												c.width = layer.canvas.width;
												c.height = layer.canvas.height;
												const ctx = c.getContext('2d')!;
												ctx.imageSmoothingEnabled = false;
												ctx.clearRect(0, 0, c.width, c.height);
												ctx.drawImage(layer.canvas, 0, 0);
											}}
										/>
									</div>
									<span className="flex-1 truncate">{layer.name}</span>
									<span className="font-mono text-[9px] text-muted-foreground/70">
										{layer.canvas.width}×{layer.canvas.height}
									</span>
									<button
										type="button"
										title="Move up"
										disabled={idx === v.layers.length - 1}
										onClick={(e) => {
											e.stopPropagation();
											v.moveLayer(layer.id, 1);
										}}
										className="flex h-4 w-4 items-center justify-center opacity-0 hover:bg-accent hover:text-foreground disabled:opacity-0 group-hover:opacity-60"
									>
										<ArrowUp className="h-3 w-3" />
									</button>
									<button
										type="button"
										title="Move down"
										disabled={idx === 0}
										onClick={(e) => {
											e.stopPropagation();
											v.moveLayer(layer.id, -1);
										}}
										className="flex h-4 w-4 items-center justify-center opacity-0 hover:bg-accent hover:text-foreground disabled:opacity-0 group-hover:opacity-60"
									>
										<ArrowDown className="h-3 w-3" />
									</button>
									<button
										type="button"
										title="Delete"
										onClick={(e) => {
											e.stopPropagation();
											v.removeLayer(layer.id);
										}}
										className="flex h-4 w-4 items-center justify-center opacity-0 hover:bg-destructive/30 hover:text-destructive group-hover:opacity-60"
									>
										<Trash2 className="h-3 w-3" />
									</button>
								</div>
							);
						})}
					</div>
				</SlicerPanel>
			);
		}
		if (id === 'slicerSprites') {
			return (
				<SlicerPanel
					title="Sprites"
					dragHandle={handle}
					headerExtra={
						<span className="font-mono text-[10px]">
							{v.keptCount}/{v.slices.length}
						</span>
					}
				>
					<div className="flex h-full flex-col gap-2">
						<div className="flex gap-1">
							<Button
								size="sm"
								variant="ghost"
								className="h-7 flex-1 text-xs"
								disabled={v.slices.length === 0}
								onClick={() => v.setAllKeep(true)}
							>
								All
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className="h-7 flex-1 text-xs"
								disabled={v.slices.length === 0}
								onClick={() => v.setAllKeep(false)}
							>
								None
							</Button>
						</div>
						<div className="custom-scrollbar flex flex-1 flex-wrap content-start gap-1 overflow-auto rounded-md border border-border/50 p-2">
							{v.slices.map((s, i) => slicePreview(s.pixels, s.keep, i))}
						</div>
						<div className="flex gap-1">
							<Button size="sm" variant="ghost" className="flex-1" onClick={v.clearSlices} disabled={v.slices.length === 0}>
								<Trash2 className="mr-1.5 h-3.5 w-3.5" />
								Clear
							</Button>
							<Button
								size="sm"
								className="flex-1"
								onClick={() => void v.importSlices()}
								disabled={v.busy || v.keptCount === 0 || !v.hasProject}
							>
								{v.busy ? 'Importing…' : `Import ${v.keptCount || ''}`}
							</Button>
						</div>
					</div>
				</SlicerPanel>
			);
		}
		return null;
	};

	return (
		<div
			className={`flex h-screen w-screen flex-col overflow-hidden ${isMaximized ? '' : 'rounded-xl border border-white/10 shadow-2xl'} ${transparentRoot ? 'bg-transparent' : 'bg-background'}`}
		>
			<div data-tauri-drag-region className="flex h-8 items-center gap-1 border-b border-border/50 bg-toolbar-bg pl-1.5 pr-3">
				{isMac && (
					<div className="group ml-2 mr-4 flex items-center gap-2">
						<div
							onClick={handleClose}
							onMouseDown={(e) => e.stopPropagation()}
							className="flex h-3 w-3 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-[#FF5F56] transition-colors hover:bg-[#FF5F56]/80"
						>
							<X className="h-2 w-2 text-black/50 opacity-0 group-hover:opacity-100" />
						</div>
						<div
							onClick={handleMinimize}
							onMouseDown={(e) => e.stopPropagation()}
							className="flex h-3 w-3 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-[#FFBD2E] transition-colors hover:bg-[#FFBD2E]/80"
						>
							<Minus className="h-2 w-2 text-black/50 opacity-0 group-hover:opacity-100" />
						</div>
						<div
							onClick={handleMaximize}
							onMouseDown={(e) => e.stopPropagation()}
							className="flex h-3 w-3 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-[#27C93F] transition-colors hover:bg-[#27C93F]/80"
						>
							<Square className="h-2 w-2 text-black/50 opacity-0 group-hover:opacity-100" />
						</div>
					</div>
				)}
				<span className="ml-2 text-xs font-medium text-foreground/80">Slice Editor</span>
				<div className="ml-auto flex flex-shrink-0 items-center text-[11px] text-muted-foreground">
					<span className="font-mono">{activeCanvas ? `${activeCanvas.width}×${activeCanvas.height}` : 'No image'}</span>
				</div>
				{!isMac && (
					<div className="-mr-3 ml-2 flex flex-shrink-0 items-center">
						<button
							type="button"
							aria-label="Minimize"
							onClick={handleMinimize}
							onMouseDown={(e) => e.stopPropagation()}
							className="inline-flex h-8 w-9 items-center justify-center text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
						>
							<Minus strokeWidth={1.5} className="h-4 w-4" />
						</button>
						<button
							type="button"
							onClick={handleMaximize}
							onMouseDown={(e) => e.stopPropagation()}
							aria-label={isMaximized ? 'Restore' : 'Maximize'}
							className="inline-flex h-8 w-9 items-center justify-center text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
						>
							{isMaximized ? (
								<Copy strokeWidth={1.5} className="h-3.5 w-3.5 -scale-x-100" />
							) : (
								<Square strokeWidth={1.5} className="h-3.5 w-3.5" />
							)}
						</button>
						<button
							type="button"
							aria-label="Close"
							onClick={handleClose}
							onMouseDown={(e) => e.stopPropagation()}
							className="inline-flex h-8 w-9 items-center justify-center text-foreground/70 transition-colors hover:bg-[#e81123] hover:text-white"
						>
							<X strokeWidth={1.5} className="h-4 w-4" />
						</button>
					</div>
				)}
			</div>

			<Workspace dock={dock} renderPanel={renderPanel}>
				<div className="flex h-full w-full gap-1.5">
					<div className="flex w-9 shrink-0 flex-col items-center gap-0.5 rounded-lg bg-card p-1 shadow-island">
						<Button size="icon" variant="ghost" title="Open image" className="h-7 w-7" onClick={() => void v.pickFile()}>
							<FolderOpen className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="icon"
							variant="ghost"
							className="h-7 w-7"
							disabled={!v.hasLayers}
							title="Clear all layers"
							onClick={v.clearAllLayers}
						>
							<X className="h-3.5 w-3.5" />
						</Button>
						<div className="my-1 h-px w-5 bg-border/50" />
						<Button
							size="icon"
							title="Cursor (V)"
							className="h-7 w-7"
							onClick={() => v.setTool('cursor')}
							variant={v.tool === 'cursor' ? 'default' : 'ghost'}
						>
							<MousePointer2 className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="icon"
							title="Select (M)"
							className="h-7 w-7"
							onClick={() => v.setTool('select')}
							variant={v.tool === 'select' ? 'default' : 'ghost'}
						>
							<SquareDashed className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="icon"
							className="h-7 w-7"
							title="Magic Wand (W)"
							onClick={() => v.setTool('wand')}
							variant={v.tool === 'wand' ? 'default' : 'ghost'}
						>
							<Wand2 className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="icon"
							title="Crop (C)"
							className="h-7 w-7"
							onClick={() => v.setTool('crop')}
							variant={v.tool === 'crop' ? 'default' : 'ghost'}
						>
							<Crop className="h-3.5 w-3.5" />
						</Button>
						<div className="my-1 h-px w-5 bg-border/50" />
						<Button
							size="icon"
							variant="ghost"
							className="h-7 w-7"
							title="Rotate left"
							disabled={!v.activeLayer}
							onClick={() => v.transform('rotL')}
						>
							<RotateCcw className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="icon"
							variant="ghost"
							className="h-7 w-7"
							title="Rotate right"
							disabled={!v.activeLayer}
							onClick={() => v.transform('rotR')}
						>
							<RotateCw className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="icon"
							variant="ghost"
							className="h-7 w-7"
							title="Flip horizontal"
							disabled={!v.activeLayer}
							onClick={() => v.transform('flipH')}
						>
							<FlipHorizontal className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="icon"
							variant="ghost"
							className="h-7 w-7"
							title="Flip vertical"
							disabled={!v.activeLayer}
							onClick={() => v.transform('flipV')}
						>
							<FlipVertical className="h-3.5 w-3.5" />
						</Button>
						<div className="my-1 h-px w-5 bg-border/50" />
						<Button
							size="icon"
							variant="ghost"
							title="Scale 2x"
							className="h-7 w-7"
							disabled={!v.activeLayer}
							onClick={() => activeCanvas && v.resize(activeCanvas.width * 2, activeCanvas.height * 2, smooth)}
						>
							<Maximize2 className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="icon"
							variant="ghost"
							title="Scale ½x"
							className="h-7 w-7"
							disabled={!v.activeLayer}
							onClick={() => activeCanvas && v.resize(activeCanvas.width / 2, activeCanvas.height / 2, smooth)}
						>
							<Minimize2 className="h-3.5 w-3.5" />
						</Button>
					</div>

					<div className="flex min-w-0 flex-1 flex-col gap-1.5">
						<div className="flex h-9 flex-shrink-0 items-center gap-3 rounded-lg bg-card px-3 shadow-island">
							{v.tool === 'cursor' && (
								<label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-foreground/80">
									<input
										type="checkbox"
										checked={v.autoSelect}
										className="h-3 w-3 cursor-pointer accent-primary"
										onChange={(e) => v.setAutoSelect(e.target.checked)}
									/>
									Auto-select layer
								</label>
							)}
							{v.tool === 'cursor' && (
								<label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-foreground/80">
									<input
										type="checkbox"
										checked={v.snap}
										onChange={(e) => v.setSnap(e.target.checked)}
										className="h-3 w-3 cursor-pointer accent-primary"
									/>
									Snap to grid
								</label>
							)}
							{v.tool === 'wand' && (
								<>
									<label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-foreground/80">
										<input
											type="checkbox"
											checked={v.wandContiguous}
											className="h-3 w-3 cursor-pointer accent-primary"
											onChange={(e) => v.setWandContiguous(e.target.checked)}
										/>
										Contiguous
									</label>
									<label className="flex items-center gap-1.5 text-[11px] text-foreground/80">
										Tolerance
										<Input
											min={0}
											max={255}
											type="number"
											value={v.wandTolerance}
											className="h-6 w-16 px-1.5 text-[11px]"
											onChange={(e) => v.setWandTolerance(Math.max(0, Math.min(255, Math.floor(Number(e.target.value) || 0))))}
										/>
									</label>
								</>
							)}
							{v.tool === 'select' && (
								<label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-foreground/80">
									<input
										type="checkbox"
										checked={snapSelect}
										onChange={(e) => setSnapSelect(e.target.checked)}
										className="h-3 w-3 cursor-pointer accent-primary"
									/>
									Snap to grid
								</label>
							)}
							{v.tool === 'crop' && (
								<>
									<Button
										size="sm"
										variant="ghost"
										disabled={!v.hasLayers}
										onClick={v.selectAllImage}
										className="h-6 px-2 text-[11px]"
									>
										All
									</Button>
									<Button
										size="sm"
										variant="ghost"
										disabled={!v.hasLayers}
										onClick={v.invertSelection}
										className="h-6 px-2 text-[11px]"
									>
										Invert
									</Button>
									<Button
										size="sm"
										variant="ghost"
										disabled={!v.hasSelection}
										onClick={v.clearSelection}
										className="h-6 px-2 text-[11px]"
									>
										Deselect
									</Button>
									<div className="h-4 w-px bg-border" />
									<label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-foreground/80">
										<input
											type="checkbox"
											checked={v.snap}
											onChange={(e) => v.setSnap(e.target.checked)}
											className="h-3 w-3 cursor-pointer accent-primary"
										/>
										Snap
									</label>
									<label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-foreground/80">
										<input
											type="checkbox"
											checked={v.keepEmpty}
											className="h-3 w-3 cursor-pointer accent-primary"
											onChange={(e) => v.setKeepEmpty(e.target.checked)}
										/>
										Keep empty
									</label>
									<div className="h-4 w-px bg-border" />
									<Button
										size="sm"
										onClick={v.cut}
										className="h-6 gap-1 px-2 text-[11px]"
										disabled={!v.hasLayers || !v.hasSelection}
									>
										<Scissors className="h-3 w-3" />
										Cut
									</Button>
									<span className="ml-auto font-mono text-[10px] text-foreground/70">{v.selectedCellCount} cells</span>
								</>
							)}
							{transforming && v.activeLayer && (
								<>
									<span className="text-[10px] font-semibold uppercase tracking-wide text-yellow-300">Transform</span>
									<div className="h-4 w-px bg-border" />
									<label className="flex items-center gap-1.5 text-[11px] text-foreground/80">
										W{numberInput(resizeW, aspectScale, 1, 8192)}
									</label>
									<label className="flex items-center gap-1.5 text-[11px] text-foreground/80">
										H{numberInput(resizeH, aspectScaleH, 1, 8192)}
									</label>
									<label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-foreground/80">
										<input
											type="checkbox"
											checked={linked}
											onChange={(e) => setLinked(e.target.checked)}
											className="h-3 w-3 cursor-pointer accent-primary"
										/>
										Lock
									</label>
									<label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-foreground/80">
										<input
											type="checkbox"
											checked={smooth}
											onChange={(e) => setSmooth(e.target.checked)}
											className="h-3 w-3 cursor-pointer accent-primary"
										/>
										Smooth
									</label>
									<label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-foreground/80">
										<input
											type="checkbox"
											checked={snapResize}
											onChange={(e) => setSnapResize(e.target.checked)}
											className="h-3 w-3 cursor-pointer accent-primary"
										/>
										Snap
									</label>
									<Button
										size="sm"
										variant="outline"
										className="h-6 px-2 text-[11px]"
										onClick={() => activeCanvas && v.resize(resizeW, resizeH, smooth)}
										disabled={!activeCanvas || (resizeW === activeCanvas.width && resizeH === activeCanvas.height)}
									>
										Apply
									</Button>
									<div className="h-4 w-px bg-border" />
									<Button size="icon" variant="ghost" className="h-6 w-6" title="Rotate left" onClick={() => v.transform('rotL')}>
										<RotateCcw className="h-3.5 w-3.5" />
									</Button>
									<Button
										size="icon"
										variant="ghost"
										className="h-6 w-6"
										title="Rotate right"
										onClick={() => v.transform('rotR')}
									>
										<RotateCw className="h-3.5 w-3.5" />
									</Button>
									<Button
										size="icon"
										variant="ghost"
										className="h-6 w-6"
										title="Flip horizontal"
										onClick={() => v.transform('flipH')}
									>
										<FlipHorizontal className="h-3.5 w-3.5" />
									</Button>
									<Button
										size="icon"
										variant="ghost"
										className="h-6 w-6"
										title="Flip vertical"
										onClick={() => v.transform('flipV')}
									>
										<FlipVertical className="h-3.5 w-3.5" />
									</Button>
									<span className="ml-auto text-[10px] text-muted-foreground">Enter/Esc to exit</span>
								</>
							)}
						</div>
						<div
							onDrop={onDrop}
							ref={workspaceRef}
							onMouseLeave={() => setHover(null)}
							onDragOver={(e) => e.preventDefault()}
							style={{ cursor: spaceHeld ? (dragging ? CUR_HAND_GRAB : CUR_HAND) : undefined }}
							className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-[#1a1a1a] shadow-island"
							onMouseDown={(e) => {
								if ((spaceHeld || e.button === 1) && e.target === e.currentTarget) startPanView(e);
							}}
							onMouseMove={(e) => {
								const { x, y } = workspaceCoords(e);
								setHover({ x: Math.floor(x), y: Math.floor(y) });
							}}
						>
							<div
								data-role="workspaceCanvas"
								onMouseDown={onWorkspaceMouseDown}
								style={{
									top: 0,
									left: 0,
									position: 'absolute',
									transformOrigin: '0 0',
									cursor: workspaceCursor(),
									backgroundColor: '#2a2a2a',
									backgroundSize: '16px 16px',
									width: v.workspaceSize * v.zoom,
									height: v.workspaceSize * v.zoom,
									transform: `translate(${pan.x}px, ${pan.y}px)`,
									backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
									backgroundImage: `linear-gradient(45deg, #3a3a3a 25%, transparent 25%), linear-gradient(-45deg, #3a3a3a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #3a3a3a 75%), linear-gradient(-45deg, transparent 75%, #3a3a3a 75%)`
								}}
							>
								{v.layers.map((layer) =>
									layer.visible ? (
										<LayerView
											layer={layer}
											zoom={v.zoom}
											key={layer.id}
											cursor={imageCursor()}
											onMouseDown={(e) => onLayerMouseDown(e, layer.id)}
											pointerEvents={
												v.tool === 'wand' || v.tool === 'select'
													? 'none'
													: spaceHeld || v.tool === 'cursor' || (v.tool === 'crop' && mods.ctrl && v.hasSelection)
														? 'auto'
														: 'none'
											}
										/>
									) : null
								)}
								{(() => {
									const sel = selectedLayerId ? v.layers.find((l) => l.id === selectedLayerId) : null;
									if (!sel) return null;
									const b = opaqueBounds(sel.canvas);
									if (!b) return null;
									return (
										<div
											className="pointer-events-none absolute border border-dashed border-yellow-300"
											style={{
												width: b.w * v.zoom,
												height: b.h * v.zoom,
												top: (sel.y + b.y) * v.zoom,
												left: (sel.x + b.x) * v.zoom,
												boxShadow: '0 0 0 1px rgba(0,0,0,0.6)'
											}}
										/>
									);
								})()}
								{transforming &&
									v.activeLayer &&
									(() => {
										const box = transformPreview ?? {
											x: v.activeLayer.x,
											y: v.activeLayer.y,
											w: v.activeLayer.canvas.width,
											h: v.activeLayer.canvas.height
										};
										const cursorFor = (fx: number, fy: number) => {
											if (fx === 0.5) return 'ns-resize';
											if (fy === 0.5) return 'ew-resize';
											if ((fx === 0 && fy === 0) || (fx === 1 && fy === 1)) return 'nwse-resize';
											return 'nesw-resize';
										};
										return (
											<>
												<div
													className="pointer-events-none absolute border-2 border-dashed border-cyan-300"
													style={{
														zIndex: 12,
														top: box.y * v.zoom - 2,
														left: box.x * v.zoom - 2,
														width: box.w * v.zoom + 4,
														height: box.h * v.zoom + 4,
														boxShadow: '0 0 0 1px rgba(0,0,0,0.7)'
													}}
												/>
												{[
													[0, 0],
													[0.5, 0],
													[1, 0],
													[0, 0.5],
													[1, 0.5],
													[0, 1],
													[0.5, 1],
													[1, 1]
												].map(([fx, fy], i) => (
													<div
														key={i}
														onMouseDown={startTransformDrag(fx, fy)}
														className="absolute border border-cyan-300 bg-white"
														style={{
															width: 10,
															zIndex: 13,
															height: 10,
															cursor: cursorFor(fx, fy),
															top: (box.y + box.h * fy) * v.zoom - 5,
															left: (box.x + box.w * fx) * v.zoom - 5
														}}
													/>
												))}
											</>
										);
									})()}
								{v.subdivisions > 1 && (
									<div
										data-role="workspaceCanvas"
										className="pointer-events-none absolute inset-0"
										style={{
											backgroundSize: `${(v.gridSize / v.subdivisions) * v.zoom}px ${(v.gridSize / v.subdivisions) * v.zoom}px`,
											backgroundImage: `linear-gradient(to right, rgba(0,255,200,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,255,200,0.10) 1px, transparent 1px)`
										}}
									/>
								)}
								<div
									data-role="workspaceCanvas"
									className="pointer-events-none absolute inset-0"
									style={{
										backgroundSize: `${v.gridSize * v.zoom}px ${v.gridSize * v.zoom}px`,
										backgroundImage: `linear-gradient(to right, rgba(0,255,200,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,255,200,0.25) 1px, transparent 1px)`
									}}
								/>
								<canvas
									ref={maskRef}
									data-role="workspaceCanvas"
									className="pointer-events-none absolute left-0 top-0"
									style={{
										zIndex: 10,
										imageRendering: 'pixelated',
										width: v.workspaceSize * v.zoom,
										height: v.workspaceSize * v.zoom
									}}
								/>
								{previewRect && (
									<canvas
										ref={previewRef}
										data-role="workspaceCanvas"
										className="pointer-events-none absolute"
										style={{
											zIndex: 11,
											imageRendering: 'pixelated',
											top: previewRect.y * v.zoom - 2,
											left: previewRect.x * v.zoom - 2,
											width: previewRect.w * v.zoom + 4,
											height: previewRect.h * v.zoom + 4
										}}
									/>
								)}
								{!v.hasLayers && (
									<div
										data-role="workspaceCanvas"
										className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground"
									>
										Open / drop / paste an image
									</div>
								)}
								{v.pixelMask && maskLayer && (
									<canvas
										ref={overlayRef}
										className="pointer-events-none absolute"
										style={{
											zIndex: 11,
											width: v.pixelMask.bounds.w * v.zoom + 4,
											height: v.pixelMask.bounds.h * v.zoom + 4,
											top: (maskLayer.y + v.pixelMask.bounds.y) * v.zoom - 2,
											left: (maskLayer.x + v.pixelMask.bounds.x) * v.zoom - 2
										}}
									/>
								)}
							</div>
						</div>
					</div>
				</div>
			</Workspace>

			<div className="flex h-7 flex-shrink-0 items-stretch border-t border-border/50 bg-toolbar-bg text-xs text-muted-foreground">
				<div className="flex min-w-0 flex-1 items-center px-3">
					<span className="truncate">
						{activeCanvas ? `${activeCanvas.width}x${activeCanvas.height}` : 'No image'}
						{v.layers.length > 0 && ` · ${v.layers.length} layer${v.layers.length === 1 ? '' : 's'}`}
						{!v.hasProject && ' · Open a project in main window to import'}
					</span>
				</div>

				<div className="w-px self-stretch bg-border" />

				<div className="flex min-w-0 flex-1 items-center px-3 font-mono">
					{v.tool === 'crop' && (
						<span className="truncate">{v.selectedCellCount > 0 ? `${v.selectedCellCount} cells selected` : 'No selection'}</span>
					)}
					{v.tool === 'cursor' && v.activeLayer && (
						<span className="truncate">
							{v.activeLayer.name} at <span className="text-foreground">{v.activeLayer.x}</span>,
							<span className="text-foreground">{v.activeLayer.y}</span>
						</span>
					)}
				</div>

				<div className="w-px self-stretch bg-border" />

				<div className="flex w-40 flex-shrink-0 items-center px-3 font-mono tabular-nums">
					{hover && (
						<span>
							x: <span className="text-foreground">{hover.x}</span> y:
							<span className="text-foreground">{hover.y}</span>
						</span>
					)}
				</div>

				<div className="w-px self-stretch bg-border" />

				<div className="flex flex-shrink-0 items-center gap-1 px-2">
					<button
						type="button"
						title="Zoom out"
						onClick={() => v.setZoom(Math.max(0.1, v.zoom / 1.25))}
						className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent hover:text-foreground"
					>
						<Minus className="h-3.5 w-3.5" />
					</button>
					<span className="w-12 text-center tabular-nums text-foreground">{Math.round(v.zoom * 100)}%</span>
					<button
						type="button"
						title="Zoom in"
						onClick={() => v.setZoom(Math.min(32, v.zoom * 1.25))}
						className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent hover:text-foreground"
					>
						<Plus className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</div>
	);
};
