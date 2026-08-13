import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { emit, listen } from '@tauri-apps/api/event';

import { log } from '~/lib/log';
import { useToast } from './useToast';
import { addSpritesBatch } from '~/lib/formats/tibia';
import { useAssetData } from '~/usecase/context/AssetDataContext';

const CELL = 32;
const WORKSPACE = 2048;
const PREFS_KEY = 'sprite-forge-slicer-prefs';

interface SlicerPrefs {
	snap?: boolean;
	gridSize?: number;
	keepEmpty?: boolean;
	autoSelect?: boolean;
	subdivisions?: number;
	wandTolerance?: number;
	wandContiguous?: boolean;
}

const loadPrefs = (): SlicerPrefs => {
	try {
		const raw = localStorage.getItem(PREFS_KEY);
		return raw ? (JSON.parse(raw) as SlicerPrefs) : {};
	} catch {
		return {};
	}
};

const savePrefs = (p: SlicerPrefs) => {
	try {
		localStorage.setItem(PREFS_KEY, JSON.stringify(p));
	} catch {
		void 0;
	}
};

const scaleToSprite = (src: Uint8ClampedArray, sw: number, sh: number): Uint8Array => {
	if (sw === CELL && sh === CELL) return new Uint8Array(src);
	const tmp = document.createElement('canvas');
	tmp.width = sw;
	tmp.height = sh;
	const tctx = tmp.getContext('2d')!;
	const id = tctx.createImageData(sw, sh);
	id.data.set(src);
	tctx.putImageData(id, 0, 0);
	const out = document.createElement('canvas');
	out.width = CELL;
	out.height = CELL;
	const octx = out.getContext('2d')!;
	octx.imageSmoothingEnabled = false;
	octx.drawImage(tmp, 0, 0, CELL, CELL);
	return new Uint8Array(octx.getImageData(0, 0, CELL, CELL).data);
};

interface Slice {
	keep: boolean;
	empty: boolean;
	pixels: Uint8Array;
}

export interface Layer {
	x: number;
	y: number;
	id: string;
	name: string;
	visible: boolean;
	canvas: HTMLCanvasElement;
}

interface PixelMask {
	w: number;
	h: number;
	layerId: string;
	data: Uint8Array;
	bounds: { x: number; y: number; w: number; h: number };
}

interface HistorySnap {
	layers: Layer[];
	selectedCells: Set<string>;
	pixelMask: null | PixelMask;
	activeLayerId: null | string;
}

export const opaqueBounds = (canvas: HTMLCanvasElement): null | { x: number; y: number; w: number; h: number } => {
	const W = canvas.width;
	const H = canvas.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	const data = ctx.getImageData(0, 0, W, H).data;
	let minX = W;
	let minY = H;
	let maxX = -1;
	let maxY = -1;
	for (let y = 0; y < H; y++) {
		const row = y * W * 4;
		for (let x = 0; x < W; x++) {
			if (data[row + x * 4 + 3] === 0) continue;
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
		}
	}
	return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
};

const stripMagenta = (pixels: Uint8Array) => {
	for (let i = 0; i < pixels.length; i += 4) {
		if (pixels[i] === 0xff && pixels[i + 1] === 0x00 && pixels[i + 2] === 0xff) {
			pixels[i] = 0;
			pixels[i + 1] = 0;
			pixels[i + 2] = 0;
			pixels[i + 3] = 0;
		}
	}
};

const isEmpty = (pixels: Uint8Array) => {
	for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 0) return false;
	return true;
};

const decodeImage = async (bytes: Uint8Array): Promise<HTMLCanvasElement> => {
	const blob = new Blob([new Uint8Array(bytes)]);
	const bmp = await createImageBitmap(blob);
	const canvas = document.createElement('canvas');
	canvas.width = bmp.width;
	canvas.height = bmp.height;
	const ctx = canvas.getContext('2d')!;
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(bmp, 0, 0);
	bmp.close?.();
	return canvas;
};

const transformCanvas = (src: HTMLCanvasElement, op: 'rotL' | 'rotR' | 'flipH' | 'flipV'): HTMLCanvasElement => {
	const w = src.width;
	const h = src.height;
	const out = document.createElement('canvas');
	const rotate = op === 'rotL' || op === 'rotR';
	out.width = rotate ? h : w;
	out.height = rotate ? w : h;
	const ctx = out.getContext('2d')!;
	ctx.imageSmoothingEnabled = false;
	if (op === 'rotR') {
		ctx.translate(h, 0);
		ctx.rotate(Math.PI / 2);
	} else if (op === 'rotL') {
		ctx.translate(0, w);
		ctx.rotate(-Math.PI / 2);
	} else if (op === 'flipH') {
		ctx.translate(w, 0);
		ctx.scale(-1, 1);
	} else {
		ctx.translate(0, h);
		ctx.scale(1, -1);
	}
	ctx.drawImage(src, 0, 0);
	return out;
};

export const useSpriteSlicer = () => {
	const { data, notifyDataChanged } = useAssetData();
	const { toast } = useToast();

	const initialPrefs = React.useRef(loadPrefs());
	const [layers, setLayers] = React.useState<Layer[]>([]);
	const [activeLayerId, setActiveLayerId] = React.useState<null | string>(null);
	const [zoom, setZoom] = React.useState(1);
	const [keepEmpty, setKeepEmpty] = React.useState(initialPrefs.current.keepEmpty ?? false);
	const [snap, setSnap] = React.useState(initialPrefs.current.snap ?? true);
	const [gridSize, setGridSize] = React.useState(initialPrefs.current.gridSize ?? CELL);
	const [subdivisions, setSubdivisions] = React.useState(initialPrefs.current.subdivisions ?? 1);
	const [slices, setSlices] = React.useState<Slice[]>([]);
	const [busy, setBusy] = React.useState(false);
	const [tool, setTool] = React.useState<'wand' | 'crop' | 'cursor' | 'select'>('cursor');
	const [wandContiguous, setWandContiguous] = React.useState(initialPrefs.current.wandContiguous ?? true);
	const [wandTolerance, setWandTolerance] = React.useState(initialPrefs.current.wandTolerance ?? 0);
	const [autoSelect, setAutoSelect] = React.useState(initialPrefs.current.autoSelect ?? true);

	React.useEffect(() => {
		savePrefs({ snap, gridSize, keepEmpty, autoSelect, subdivisions, wandTolerance, wandContiguous });
	}, [gridSize, subdivisions, snap, keepEmpty, autoSelect, wandContiguous, wandTolerance]);
	const [selectedCells, setSelectedCells] = React.useState<Set<string>>(new Set());
	const [pixelMask, setPixelMask] = React.useState<null | PixelMask>(null);
	const [remoteProjectLoaded, setRemoteProjectLoaded] = React.useState(false);

	const HISTORY_LIMIT = 50;
	const layersRef = React.useRef(layers);
	const activeLayerIdRef = React.useRef(activeLayerId);
	const pixelMaskRef = React.useRef(pixelMask);
	const selectedCellsRef = React.useRef(selectedCells);
	layersRef.current = layers;
	activeLayerIdRef.current = activeLayerId;
	pixelMaskRef.current = pixelMask;
	selectedCellsRef.current = selectedCells;
	const pastRef = React.useRef<HistorySnap[]>([]);
	const futureRef = React.useRef<HistorySnap[]>([]);
	const [historyTick, setHistoryTick] = React.useState(0);
	void historyTick;

	const snapNow = (): HistorySnap => ({
		layers: layersRef.current,
		pixelMask: pixelMaskRef.current,
		activeLayerId: activeLayerIdRef.current,
		selectedCells: new Set(selectedCellsRef.current)
	});

	const pushHistory = React.useCallback(() => {
		pastRef.current.push(snapNow());
		if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
		futureRef.current = [];
		setHistoryTick((v) => v + 1);
	}, []);

	const restoreSnap = (s: HistorySnap) => {
		setLayers(s.layers);
		setActiveLayerId(s.activeLayerId);
		setPixelMask(s.pixelMask);
		setSelectedCells(s.selectedCells);
	};

	const undo = React.useCallback(() => {
		const snap = pastRef.current.pop();
		if (!snap) return;
		futureRef.current.push(snapNow());
		restoreSnap(snap);
		setHistoryTick((v) => v + 1);
	}, []);

	const redo = React.useCallback(() => {
		const snap = futureRef.current.pop();
		if (!snap) return;
		pastRef.current.push(snapNow());
		restoreSnap(snap);
		setHistoryTick((v) => v + 1);
	}, []);

	const canUndo = pastRef.current.length > 0;
	const canRedo = futureRef.current.length > 0;

	const clearPixelMask = React.useCallback(() => {
		if (!pixelMaskRef.current) return;
		pushHistory();
		setPixelMask(null);
	}, [pushHistory]);

	const layerIdRef = React.useRef(0);
	const layerCountRef = React.useRef(0);
	const nextLayerId = () => `layer-${++layerIdRef.current}`;
	const nextLayerName = () => `Layer ${++layerCountRef.current}`;

	const activeLayer = React.useMemo(() => layers.find((l) => l.id === activeLayerId) ?? null, [layers, activeLayerId]);

	React.useEffect(() => {
		if (data) return;
		let unlisten: (() => void) | undefined;
		let cancelled = false;
		void listen<boolean>('slicer:project-state', (e) => {
			setRemoteProjectLoaded(!!e.payload);
		}).then((u) => {
			if (cancelled) {
				u();
				return;
			}
			unlisten = u;
			void emit('slicer:query-project');
		});
		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, [data]);

	const workspaceSize = WORKSPACE;
	const hasSelection = selectedCells.size > 0;
	const selectedCellCount = selectedCells.size;
	const hasLayers = layers.length > 0;

	React.useEffect(() => {
		setSelectedCells(new Set());
	}, [gridSize]);

	const applyRectToMask = React.useCallback(
		(x: number, y: number, w: number, h: number, op: 'add' | 'replace' | 'subtract' | 'intersect') => {
			pushHistory();
			const tile = gridSize;
			const c0 = Math.max(0, Math.floor(x / tile));
			const r0 = Math.max(0, Math.floor(y / tile));
			const c1 = Math.min(Math.ceil(workspaceSize / tile), Math.ceil((x + w) / tile));
			const r1 = Math.min(Math.ceil(workspaceSize / tile), Math.ceil((y + h) / tile));
			setSelectedCells((prev) => {
				if (op === 'replace') {
					const next = new Set<string>();
					for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) next.add(`${c},${r}`);
					return next;
				}
				if (op === 'add') {
					const next = new Set(prev);
					for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) next.add(`${c},${r}`);
					return next;
				}
				if (op === 'subtract') {
					const next = new Set(prev);
					for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) next.delete(`${c},${r}`);
					return next;
				}
				const next = new Set<string>();
				for (let r = r0; r < r1; r++)
					for (let c = c0; c < c1; c++) {
						const k = `${c},${r}`;
						if (prev.has(k)) next.add(k);
					}
				return next;
			});
		},
		[gridSize, workspaceSize, pushHistory]
	);

	const visibleBounds = React.useCallback(() => {
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const l of layers) {
			if (!l.visible) continue;
			const b = opaqueBounds(l.canvas);
			if (!b) continue;
			minX = Math.min(minX, l.x + b.x);
			minY = Math.min(minY, l.y + b.y);
			maxX = Math.max(maxX, l.x + b.x + b.w);
			maxY = Math.max(maxY, l.y + b.y + b.h);
		}
		if (!isFinite(minX)) return null;
		return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
	}, [layers]);

	const selectAllImage = React.useCallback(() => {
		const b = visibleBounds();
		if (!b) return;
		pushHistory();
		const tile = gridSize;
		const c0 = Math.max(0, Math.floor(b.x / tile));
		const r0 = Math.max(0, Math.floor(b.y / tile));
		const c1 = Math.ceil((b.x + b.w) / tile);
		const r1 = Math.ceil((b.y + b.h) / tile);
		const next = new Set<string>();
		for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) next.add(`${c},${r}`);
		setSelectedCells(next);
	}, [visibleBounds, gridSize, pushHistory]);

	const invertSelection = React.useCallback(() => {
		const b = visibleBounds();
		if (!b) return;
		pushHistory();
		const tile = gridSize;
		const c0 = Math.max(0, Math.floor(b.x / tile));
		const r0 = Math.max(0, Math.floor(b.y / tile));
		const c1 = Math.ceil((b.x + b.w) / tile);
		const r1 = Math.ceil((b.y + b.h) / tile);
		setSelectedCells((prev) => {
			const next = new Set<string>();
			for (let r = r0; r < r1; r++)
				for (let c = c0; c < c1; c++) {
					const k = `${c},${r}`;
					if (!prev.has(k)) next.add(k);
				}
			return next;
		});
	}, [visibleBounds, gridSize, pushHistory]);

	const clearSelection = React.useCallback(() => {
		if (selectedCellsRef.current.size === 0) return;
		pushHistory();
		setSelectedCells(new Set());
	}, [pushHistory]);

	const translateMaskFrom = React.useCallback((snap: Set<string>, dc: number, dr: number) => {
		if (dc === 0 && dr === 0) {
			setSelectedCells(snap);
			return;
		}
		const next = new Set<string>();
		for (const k of snap) {
			const [c, r] = k.split(',').map(Number);
			next.add(`${c + dc},${r + dr}`);
		}
		setSelectedCells(next);
	}, []);

	const setLayerPos = React.useCallback(
		(id: string, x: number, y: number) => {
			setLayers((prev) =>
				prev.map((l) => {
					if (l.id !== id) return l;
					if (!snap) return { ...l, x: Math.round(x), y: Math.round(y) };
					const b = opaqueBounds(l.canvas);
					const g = gridSize;
					const snapEdge = (pos: number, lo: number, hi: number) => {
						const left = pos + lo;
						const right = pos + hi;
						const sLeft = Math.round(left / g) * g;
						const sRight = Math.round(right / g) * g;
						return Math.abs(left - sLeft) <= Math.abs(right - sRight) ? sLeft - lo : sRight - hi;
					};
					const lo = b ? b.x : 0;
					const hi = b ? b.x + b.w : l.canvas.width;
					const lvo = b ? b.y : 0;
					const lvh = b ? b.y + b.h : l.canvas.height;
					return { ...l, x: snapEdge(x, lo, hi), y: snapEdge(y, lvo, lvh) };
				})
			);
		},
		[snap, gridSize]
	);

	const clearSlices = React.useCallback(() => setSlices([]), []);

	const clearAllLayers = React.useCallback(() => {
		if (layersRef.current.length === 0) return;
		pushHistory();
		setLayers([]);
		setActiveLayerId(null);
		setSelectedCells(new Set());
		setZoom(1);
		setSlices([]);
		layerCountRef.current = 0;
	}, [pushHistory]);

	const addLayerFromCanvas = React.useCallback(
		(canvas: HTMLCanvasElement, opts?: { name?: string; center?: { x: number; y: number } }) => {
			pushHistory();
			const id = nextLayerId();
			let x: number;
			let y: number;
			if (opts?.center) {
				x = opts.center.x - canvas.width / 2;
				y = opts.center.y - canvas.height / 2;
			} else {
				x = CELL;
				y = CELL;
			}
			if (snap) {
				x = Math.round(x / gridSize) * gridSize;
				y = Math.round(y / gridSize) * gridSize;
			} else {
				x = Math.round(x);
				y = Math.round(y);
			}
			const layer: Layer = { x, y, id, canvas, visible: true, name: opts?.name ?? nextLayerName() };
			setLayers((prev) => [...prev, layer]);
			setActiveLayerId(id);
			setSlices([]);
			return id;
		},
		[snap, gridSize, pushHistory]
	);

	const loadImageBytes = React.useCallback(
		async (bytes: Uint8Array, opts?: { center?: { x: number; y: number } }) => {
			try {
				const canvas = await decodeImage(bytes);
				addLayerFromCanvas(canvas, opts);
			} catch (e) {
				log.error('Failed to decode image', e);
				toast({ variant: 'destructive', description: String(e), title: 'Failed to load image' });
			}
		},
		[toast, addLayerFromCanvas]
	);

	const pickFile = React.useCallback(async () => {
		const selected = await open({
			multiple: false,
			filters: [{ name: 'Image', extensions: ['png', 'bmp', 'jpg', 'jpeg'] }]
		});
		if (!selected || typeof selected !== 'string') return;
		const result = await invoke<Uint8Array>('read_file', { path: selected });
		const bytes = result instanceof Uint8Array ? result : new Uint8Array(result as ArrayLike<number>);
		await loadImageBytes(bytes);
	}, [loadImageBytes]);

	const loadFromFile = React.useCallback(
		async (file: File, opts?: { center?: { x: number; y: number } }) => {
			const bytes = new Uint8Array(await file.arrayBuffer());
			await loadImageBytes(bytes, opts);
		},
		[loadImageBytes]
	);

	const loadFromClipboard = React.useCallback(async () => {
		try {
			const items = await navigator.clipboard.read();
			for (const item of items) {
				for (const type of item.types) {
					if (type.startsWith('image/')) {
						const blob = await item.getType(type);
						const bytes = new Uint8Array(await blob.arrayBuffer());
						await loadImageBytes(bytes);
						return true;
					}
				}
			}
		} catch (e) {
			log.error('clipboard read failed', e);
		}
		return false;
	}, [loadImageBytes]);

	const resize = React.useCallback(
		(w: number, h: number, smooth = false) => {
			if (!activeLayer) return;
			pushHistory();
			const nw = Math.max(1, Math.round(w));
			const nh = Math.max(1, Math.round(h));
			const out = document.createElement('canvas');
			out.width = nw;
			out.height = nh;
			const ctx = out.getContext('2d')!;
			ctx.imageSmoothingEnabled = smooth;
			if (smooth) ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(activeLayer.canvas, 0, 0, nw, nh);
			setLayers((prev) => prev.map((l) => (l.id === activeLayer.id ? { ...l, canvas: out } : l)));
			setSlices([]);
		},
		[activeLayer, pushHistory]
	);

	const transform = React.useCallback(
		(op: 'rotL' | 'rotR' | 'flipH' | 'flipV') => {
			if (!activeLayer) return;
			pushHistory();
			const out = transformCanvas(activeLayer.canvas, op);
			setLayers((prev) => prev.map((l) => (l.id === activeLayer.id ? { ...l, canvas: out } : l)));
			setSlices([]);
		},
		[activeLayer, pushHistory]
	);

	React.useEffect(() => {
		if (!pixelMask) return;
		const exists = layers.some((l) => l.id === pixelMask.layerId);
		if (!exists) setPixelMask(null);
	}, [layers, pixelMask]);

	const wandSelectAt = React.useCallback(
		(wx: number, wy: number, op: 'add' | 'replace' | 'subtract' | 'intersect') => {
			if (!activeLayer) return;
			pushHistory();
			const lx = Math.floor(wx - activeLayer.x);
			const ly = Math.floor(wy - activeLayer.y);
			const src = activeLayer.canvas;
			const W = src.width;
			const H = src.height;
			if (lx < 0 || ly < 0 || lx >= W || ly >= H) return;
			const ctx = src.getContext('2d')!;
			const id = ctx.getImageData(0, 0, W, H);
			const data = id.data;
			const at = (x: number, y: number) => (y * W + x) * 4;
			const tp = at(lx, ly);
			const tr = data[tp];
			const tg = data[tp + 1];
			const tb = data[tp + 2];
			const ta = data[tp + 3];
			const tol = wandTolerance;
			const match = (p: number) =>
				Math.abs(data[p] - tr) <= tol &&
				Math.abs(data[p + 1] - tg) <= tol &&
				Math.abs(data[p + 2] - tb) <= tol &&
				Math.abs(data[p + 3] - ta) <= tol;

			const layerHit = new Uint8Array(W * H);
			if (wandContiguous) {
				const stack: number[] = [lx, ly];
				while (stack.length) {
					const y = stack.pop()!;
					const x = stack.pop()!;
					if (x < 0 || y < 0 || x >= W || y >= H) continue;
					const k = y * W + x;
					if (layerHit[k]) continue;
					if (!match(k * 4)) continue;
					layerHit[k] = 1;
					stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
				}
			} else {
				for (let i = 0; i < W * H; i++) if (match(i * 4)) layerHit[i] = 1;
			}

			const prev = pixelMask && pixelMask.layerId === activeLayer.id ? pixelMask.data : null;
			const next = new Uint8Array(W * H);
			if (op === 'replace') next.set(layerHit);
			else if (op === 'add') {
				if (prev) next.set(prev);
				for (let i = 0; i < W * H; i++) if (layerHit[i]) next[i] = 1;
			} else if (op === 'subtract') {
				if (prev) next.set(prev);
				for (let i = 0; i < W * H; i++) if (layerHit[i]) next[i] = 0;
			} else {
				if (prev) for (let i = 0; i < W * H; i++) next[i] = prev[i] && layerHit[i] ? 1 : 0;
			}

			let minX = W;
			let minY = H;
			let maxX = -1;
			let maxY = -1;
			for (let y = 0; y < H; y++) {
				const row = y * W;
				for (let x = 0; x < W; x++) {
					if (!next[row + x]) continue;
					if (x < minX) minX = x;
					if (y < minY) minY = y;
					if (x > maxX) maxX = x;
					if (y > maxY) maxY = y;
				}
			}
			if (maxX < 0) {
				setPixelMask(null);
				return;
			}
			setPixelMask({
				w: W,
				h: H,
				data: next,
				layerId: activeLayer.id,
				bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
			});
		},
		[activeLayer, wandTolerance, wandContiguous, pixelMask, pushHistory]
	);

	const rectSelectPixels = React.useCallback(
		(wx: number, wy: number, ww: number, wh: number, op: 'add' | 'replace' | 'subtract' | 'intersect') => {
			if (!activeLayer) return;
			pushHistory();
			const oldW = activeLayer.canvas.width;
			const oldH = activeLayer.canvas.height;
			const ox0 = activeLayer.x;
			const oy0 = activeLayer.y;
			const ox1 = ox0 + oldW;
			const oy1 = oy0 + oldH;
			const rx0 = Math.floor(wx);
			const ry0 = Math.floor(wy);
			const rx1 = Math.ceil(wx + ww);
			const ry1 = Math.ceil(wy + wh);
			const nx0 = Math.min(ox0, rx0);
			const ny0 = Math.min(oy0, ry0);
			const nx1 = Math.max(ox1, rx1);
			const ny1 = Math.max(oy1, ry1);
			const W = nx1 - nx0;
			const H = ny1 - ny0;
			const dx = ox0 - nx0;
			const dy = oy0 - ny0;
			let layerX = ox0;
			let layerY = oy0;
			if (W !== oldW || H !== oldH) {
				const grown = document.createElement('canvas');
				grown.width = W;
				grown.height = H;
				grown.getContext('2d')!.drawImage(activeLayer.canvas, dx, dy);
				layerX = nx0;
				layerY = ny0;
				setLayers((prev) => prev.map((l) => (l.id === activeLayer.id ? { ...l, x: nx0, y: ny0, canvas: grown } : l)));
			}
			const x0 = Math.max(0, rx0 - layerX);
			const y0 = Math.max(0, ry0 - layerY);
			const x1 = Math.min(W, rx1 - layerX);
			const y1 = Math.min(H, ry1 - layerY);
			const layerHit = new Uint8Array(W * H);
			for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) layerHit[y * W + x] = 1;
			const prevMask = pixelMask && pixelMask.layerId === activeLayer.id ? pixelMask : null;
			const prevRemapped = new Uint8Array(W * H);
			if (prevMask) {
				for (let y = 0; y < prevMask.h; y++) {
					const ny = y + dy;
					if (ny < 0 || ny >= H) continue;
					const srcRow = y * prevMask.w;
					const dstRow = ny * W;
					for (let x = 0; x < prevMask.w; x++) {
						if (!prevMask.data[srcRow + x]) continue;
						const nx = x + dx;
						if (nx < 0 || nx >= W) continue;
						prevRemapped[dstRow + nx] = 1;
					}
				}
			}
			const next = new Uint8Array(W * H);
			if (op === 'replace') next.set(layerHit);
			else if (op === 'add') {
				next.set(prevRemapped);
				for (let i = 0; i < W * H; i++) if (layerHit[i]) next[i] = 1;
			} else if (op === 'subtract') {
				next.set(prevRemapped);
				for (let i = 0; i < W * H; i++) if (layerHit[i]) next[i] = 0;
			} else {
				for (let i = 0; i < W * H; i++) next[i] = prevRemapped[i] && layerHit[i] ? 1 : 0;
			}
			let minX = W;
			let minY = H;
			let maxX = -1;
			let maxY = -1;
			for (let y = 0; y < H; y++) {
				const row = y * W;
				for (let x = 0; x < W; x++) {
					if (!next[row + x]) continue;
					if (x < minX) minX = x;
					if (y < minY) minY = y;
					if (x > maxX) maxX = x;
					if (y > maxY) maxY = y;
				}
			}
			if (maxX < 0) {
				setPixelMask(null);
				return;
			}
			setPixelMask({
				w: W,
				h: H,
				data: next,
				layerId: activeLayer.id,
				bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
			});
		},
		[activeLayer, pixelMask, pushHistory]
	);

	const translatePixelMask = React.useCallback(
		(dx: number, dy: number) => {
			const m = pixelMaskRef.current;
			if (!m) return;
			pushHistory();
			const W = m.w;
			const H = m.h;
			const next = new Uint8Array(W * H);
			let minX = W;
			let minY = H;
			let maxX = -1;
			let maxY = -1;
			for (let y = 0; y < H; y++) {
				const ny = y + dy;
				if (ny < 0 || ny >= H) continue;
				const srcRow = y * W;
				const dstRow = ny * W;
				for (let x = 0; x < W; x++) {
					if (!m.data[srcRow + x]) continue;
					const nx = x + dx;
					if (nx < 0 || nx >= W) continue;
					next[dstRow + nx] = 1;
					if (nx < minX) minX = nx;
					if (ny < minY) minY = ny;
					if (nx > maxX) maxX = nx;
					if (ny > maxY) maxY = ny;
				}
			}
			if (maxX < 0) {
				setPixelMask(null);
				return;
			}
			setPixelMask({
				w: W,
				h: H,
				data: next,
				layerId: m.layerId,
				bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
			});
		},
		[pushHistory]
	);

	const deleteSelectedPixels = React.useCallback(() => {
		if (!pixelMask) return;
		const layer = layers.find((l) => l.id === pixelMask.layerId);
		if (!layer) return;
		pushHistory();
		const src = layer.canvas;
		const W = src.width;
		const H = src.height;
		const ctx = src.getContext('2d')!;
		const id = ctx.getImageData(0, 0, W, H);
		const data = id.data;
		let any = false;
		for (let i = 0; i < W * H; i++) {
			if (!pixelMask.data[i]) continue;
			const p = i * 4;
			data[p] = 0;
			data[p + 1] = 0;
			data[p + 2] = 0;
			data[p + 3] = 0;
			any = true;
		}
		if (!any) return;
		const out = document.createElement('canvas');
		out.width = W;
		out.height = H;
		out.getContext('2d')!.putImageData(id, 0, 0);
		setLayers((prev) => prev.map((l) => (l.id === layer.id ? { ...l, canvas: out } : l)));
		setPixelMask(null);
		setSlices([]);
	}, [layers, pixelMask]);

	const compositeVisible = React.useCallback((): HTMLCanvasElement => {
		const c = document.createElement('canvas');
		c.width = WORKSPACE;
		c.height = WORKSPACE;
		const ctx = c.getContext('2d')!;
		ctx.imageSmoothingEnabled = false;
		for (const l of layers) {
			if (!l.visible) continue;
			ctx.drawImage(l.canvas, l.x, l.y);
		}
		return c;
	}, [layers]);

	const cut = React.useCallback(() => {
		if (!hasLayers || !hasSelection) return;
		const composite = compositeVisible();
		const ctx = composite.getContext('2d')!;
		const out: Slice[] = [];
		const tile = gridSize;
		const cells = [...selectedCells].map((k) => {
			const [c, r] = k.split(',').map(Number);
			return { c, r };
		});
		cells.sort((a, b) => a.r - b.r || a.c - b.c);
		for (const { c, r } of cells) {
			const wx = c * tile;
			const wy = r * tile;
			const srcLeft = Math.max(0, wx);
			const srcTop = Math.max(0, wy);
			const srcRight = Math.min(WORKSPACE, wx + tile);
			const srcBottom = Math.min(WORKSPACE, wy + tile);
			const buf = new Uint8ClampedArray(tile * tile * 4);
			if (srcRight > srcLeft && srcBottom > srcTop) {
				const sw = srcRight - srcLeft;
				const sh = srcBottom - srcTop;
				const id = ctx.getImageData(srcLeft, srcTop, sw, sh);
				const dstX = srcLeft - wx;
				const dstY = srcTop - wy;
				for (let py = 0; py < sh; py++) {
					const srcRow = py * sw * 4;
					const dstRow = ((dstY + py) * tile + dstX) * 4;
					buf.set(id.data.subarray(srcRow, srcRow + sw * 4), dstRow);
				}
			}
			const pixels = scaleToSprite(buf, tile, tile);
			stripMagenta(pixels);
			const empty = isEmpty(pixels);
			if (empty && !keepEmpty) continue;
			out.push({ empty, pixels, keep: true });
		}
		setSlices((prev) => [...prev, ...out]);
	}, [hasLayers, hasSelection, compositeVisible, selectedCells, gridSize, keepEmpty]);

	const toggleKeep = React.useCallback((index: number) => {
		setSlices((prev) => prev.map((s, i) => (i === index ? { ...s, keep: !s.keep } : s)));
	}, []);

	const setAllKeep = React.useCallback((keep: boolean) => {
		setSlices((prev) => prev.map((s) => ({ ...s, keep })));
	}, []);

	const toggleLayerVisible = React.useCallback(
		(id: string) => {
			pushHistory();
			setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
		},
		[pushHistory]
	);

	const removeLayer = React.useCallback(
		(id: string) => {
			pushHistory();
			setLayers((prev) => {
				const next = prev.filter((l) => l.id !== id);
				if (activeLayerId === id) {
					const idx = prev.findIndex((l) => l.id === id);
					const fallback = next[Math.min(idx, next.length - 1)];
					setActiveLayerId(fallback ? fallback.id : null);
				}
				return next;
			});
			setSlices([]);
		},
		[activeLayerId, pushHistory]
	);

	const renameLayer = React.useCallback(
		(id: string, name: string) => {
			pushHistory();
			setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
		},
		[pushHistory]
	);

	const moveLayer = React.useCallback(
		(id: string, dir: 1 | -1) => {
			pushHistory();
			setLayers((prev) => {
				const idx = prev.findIndex((l) => l.id === id);
				const target = idx + dir;
				if (idx < 0 || target < 0 || target >= prev.length) return prev;
				const next = [...prev];
				[next[idx], next[target]] = [next[target], next[idx]];
				return next;
			});
		},
		[pushHistory]
	);

	const mergeLayersInto = React.useCallback((sources: Layer[], name: string): Layer => {
		const minX = Math.min(...sources.map((l) => l.x));
		const minY = Math.min(...sources.map((l) => l.y));
		const maxX = Math.max(...sources.map((l) => l.x + l.canvas.width));
		const maxY = Math.max(...sources.map((l) => l.y + l.canvas.height));
		const w = Math.max(1, maxX - minX);
		const h = Math.max(1, maxY - minY);
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d')!;
		ctx.imageSmoothingEnabled = false;
		for (const l of sources) ctx.drawImage(l.canvas, l.x - minX, l.y - minY);
		return { name, canvas, x: minX, y: minY, visible: true, id: nextLayerId() };
	}, []);

	const mergeDown = React.useCallback(
		(id: string) => {
			pushHistory();
			setLayers((prev) => {
				const idx = prev.findIndex((l) => l.id === id);
				if (idx <= 0) return prev;
				const top = prev[idx];
				const bottom = prev[idx - 1];
				const merged = mergeLayersInto([bottom, top], bottom.name);
				const next = [...prev];
				next.splice(idx - 1, 2, merged);
				setActiveLayerId(merged.id);
				return next;
			});
			setSlices([]);
		},
		[mergeLayersInto, pushHistory]
	);

	const flatten = React.useCallback(() => {
		pushHistory();
		setLayers((prev) => {
			const visible = prev.filter((l) => l.visible);
			if (visible.length === 0) return prev;
			const merged = mergeLayersInto(visible, 'Flattened');
			setActiveLayerId(merged.id);
			return [merged];
		});
		setSlices([]);
	}, [mergeLayersInto, pushHistory]);

	const importSlices = React.useCallback(async () => {
		const kept = slices.filter((s) => s.keep);
		if (kept.length === 0) return;
		setBusy(true);
		try {
			if (data) {
				const results = await addSpritesBatch(
					data,
					kept.map((s) => s.pixels)
				);
				const added = results
					.filter((r) => r.success)
					.map((r) => r.spriteId!)
					.filter((id) => id !== undefined);
				const failed = results.filter((r) => !r.success);
				notifyDataChanged(added);
				toast({
					title: `Imported ${added.length} sprite${added.length === 1 ? '' : 's'}`,
					description:
						failed.length > 0 ? `${failed.length} failed - ${failed[0].message ?? 'unknown'}` : 'Compile to save changes.'
				});
			} else {
				await emit('slicer:import', { pixels: kept.map((s) => Array.from(s.pixels)) });
				toast({ title: `Sent ${kept.length} sprite${kept.length === 1 ? '' : 's'} to main` });
			}
			setSlices([]);
		} catch (e) {
			toast({ variant: 'destructive', title: 'Import failed', description: String(e) });
		} finally {
			setBusy(false);
		}
	}, [data, slices, notifyDataChanged, toast]);

	return {
		cut,
		busy,
		snap,
		tool,
		zoom,
		undo,
		redo,
		layers,
		slices,
		resize,
		flatten,
		setTool,
		setSnap,
		setZoom,
		canUndo,
		canRedo,
		gridSize,
		pickFile,
		pixelMask,
		mergeDown,
		moveLayer,
		keepEmpty,
		transform,
		hasLayers,
		toggleKeep,
		setAllKeep,
		autoSelect,
		pushHistory,
		setLayerPos,
		setGridSize,
		clearSlices,
		removeLayer,
		activeLayer,
		renameLayer,
		wandSelectAt,
		subdivisions,
		hasSelection,
		setKeepEmpty,
		loadFromFile,
		importSlices,
		activeLayerId,
		selectedCells,
		workspaceSize,
		wandTolerance,
		setAutoSelect,
		clearPixelMask,
		clearAllLayers,
		selectAllImage,
		clearSelection,
		loadImageBytes,
		cellSize: CELL,
		wandContiguous,
		invertSelection,
		applyRectToMask,
		setSubdivisions,
		rectSelectPixels,
		setActiveLayerId,
		setWandTolerance,
		translateMaskFrom,
		loadFromClipboard,
		selectedCellCount,
		setWandContiguous,
		toggleLayerVisible,
		translatePixelMask,
		deleteSelectedPixels,
		hasProject: !!data || remoteProjectLoaded,
		keptCount: slices.filter((s) => s.keep).length
	};
};
