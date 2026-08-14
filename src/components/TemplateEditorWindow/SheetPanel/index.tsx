import type { SheetPanelProps } from '~/components/TemplateEditorWindow/types';

import React from 'react';
import { ZoomIn, ZoomOut, Maximize, FolderOpen } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { useDragDrop } from '~/usecase/context/DragDropContext';
import { CellCanvas } from '~/components/TemplateEditorWindow/CellCanvas';

const MIN_ZOOM = 1;
const MAX_ZOOM = 16;
const DRAG_THRESHOLD = 3;

export const SheetPanel = ({ sheet, sheetName, usedTiles, onPickSheet, selectedTile, onSelectTile }: SheetPanelProps) => {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const canvasRef = React.useRef<HTMLCanvasElement>(null);
	const panRef = React.useRef({ x: 0, y: 0 });

	const { startDrag } = useDragDrop();

	const [panning, setPanning] = React.useState(false);
	const [spaceDown, setSpaceDown] = React.useState(false);
	const [zoom, setZoom] = React.useState(2);
	const [viewport, setViewport] = React.useState({ width: 0, height: 0 });
	const [, setTick] = React.useState(0);

	React.useEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0].contentRect;
			setViewport({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	React.useEffect(() => {
		panRef.current = { x: 0, y: 0 };
		setTick((value) => value + 1);
	}, [sheet]);

	React.useEffect(() => {
		const isTyping = (target: null | EventTarget) =>
			target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName));

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code !== 'Space' || isTyping(event.target)) return;
			event.preventDefault();
			setSpaceDown(true);
		};
		const onKeyUp = (event: KeyboardEvent) => {
			if (event.code === 'Space') setSpaceDown(false);
		};
		const onBlur = () => setSpaceDown(false);

		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('blur', onBlur);
		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', onBlur);
			window.removeEventListener('keydown', onKeyDown);
		};
	}, []);

	React.useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx || !viewport.width || !viewport.height) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!sheet) return;

		const { x: panX, y: panY } = panRef.current;
		const tileSize = sheet.tile * zoom;

		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(sheet.canvas, -panX, -panY, sheet.width * zoom, sheet.height * zoom);

		const firstCol = Math.floor(panX / tileSize);
		const firstRow = Math.floor(panY / tileSize);
		const lastCol = Math.min(sheet.cols, Math.ceil((panX + viewport.width) / tileSize));
		const lastRow = Math.min(sheet.rows, Math.ceil((panY + viewport.height) / tileSize));

		ctx.save();
		ctx.lineWidth = 1;
		ctx.strokeStyle = '#ffffff';
		ctx.globalAlpha = 0.55;
		ctx.globalCompositeOperation = 'difference';
		ctx.beginPath();
		for (let col = Math.max(0, firstCol); col <= lastCol; col++) {
			const x = Math.floor(col * tileSize - panX) + 0.5;
			ctx.moveTo(x, 0);
			ctx.lineTo(x, viewport.height);
		}
		for (let row = Math.max(0, firstRow); row <= lastRow; row++) {
			const y = Math.floor(row * tileSize - panY) + 0.5;
			ctx.moveTo(0, y);
			ctx.lineTo(viewport.width, y);
		}
		ctx.stroke();
		ctx.restore();

		for (let row = Math.max(0, firstRow); row < lastRow; row++) {
			for (let col = Math.max(0, firstCol); col < lastCol; col++) {
				const index = row * sheet.cols + col;
				if (!usedTiles.has(index)) continue;
				const x = col * tileSize - panX;
				const y = row * tileSize - panY;
				ctx.fillStyle = 'rgba(56,189,248,0.22)';
				ctx.fillRect(x, y, tileSize, tileSize);
				ctx.strokeStyle = 'rgba(56,189,248,0.8)';
				ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
			}
		}

		if (selectedTile !== null && selectedTile >= 0) {
			const x = (selectedTile % sheet.cols) * tileSize - panX;
			const y = Math.floor(selectedTile / sheet.cols) * tileSize - panY;
			ctx.strokeStyle = '#f97316';
			ctx.lineWidth = 2;
			ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
		}
	});

	const tileAt = (clientX: number, clientY: number): null | number => {
		const canvas = canvasRef.current;
		if (!canvas || !sheet) return null;
		const rect = canvas.getBoundingClientRect();
		const tileSize = sheet.tile * zoom;
		const col = Math.floor((clientX - rect.left + panRef.current.x) / tileSize);
		const row = Math.floor((clientY - rect.top + panRef.current.y) / tileSize);
		if (col < 0 || row < 0 || col >= sheet.cols || row >= sheet.rows) return null;
		return row * sheet.cols + col;
	};

	const startPan = (event: React.MouseEvent<HTMLCanvasElement>) => {
		event.preventDefault();
		const origin = { x: event.clientX, y: event.clientY, panX: panRef.current.x, panY: panRef.current.y };

		const onMove = (moveEvent: MouseEvent) => {
			panRef.current.x = origin.panX - (moveEvent.clientX - origin.x);
			panRef.current.y = origin.panY - (moveEvent.clientY - origin.y);
			setTick((value) => value + 1);
		};

		const onUp = () => {
			setPanning(false);
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};

		setPanning(true);
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	};

	const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
		if (event.button === 1 || (event.button === 0 && spaceDown)) {
			startPan(event);
			return;
		}
		if (event.button !== 0) return;

		const tile = tileAt(event.clientX, event.clientY);
		onSelectTile(tile);
		if (tile === null || !sheet) return;

		const pixels = sheet.getTile(tile)?.rgbaPixels;
		const origin = { x: event.clientX, y: event.clientY };

		const onMove = (moveEvent: MouseEvent) => {
			if (Math.abs(moveEvent.clientX - origin.x) < DRAG_THRESHOLD && Math.abs(moveEvent.clientY - origin.y) < DRAG_THRESHOLD) {
				return;
			}
			cleanup();
			startDrag([tile + 1], 'sprites', <CellCanvas scale={2} pixels={pixels} />);
		};

		const cleanup = () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', cleanup);
		};

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', cleanup);
	};

	const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
		if (!sheet) return;
		const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + (event.deltaY < 0 ? 1 : -1)));
		if (next === zoom) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const anchorX = (event.clientX - rect.left + panRef.current.x) / zoom;
		const anchorY = (event.clientY - rect.top + panRef.current.y) / zoom;
		panRef.current.x = anchorX * next - (event.clientX - rect.left);
		panRef.current.y = anchorY * next - (event.clientY - rect.top);
		setZoom(next);
	};

	return (
		<div className="flex h-full flex-col overflow-hidden rounded-lg bg-card shadow-island-lg">
			<div className="flex h-8 items-center justify-between gap-2 border-b border-border/50 bg-secondary/80 px-3">
				<h2 className="truncate text-xs font-semibold uppercase tracking-wide text-foreground">
					Sheet {sheetName && <span className="ml-1 font-normal text-muted-foreground">{sheetName}</span>}
				</h2>
				<div className="flex items-center gap-1">
					<Button size="icon" variant="ghost" title="Open sheet" className="h-6 w-6" onClick={onPickSheet}>
						<FolderOpen className="h-3.5 w-3.5" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						title="Zoom out"
						className="h-6 w-6"
						onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - 1))}
					>
						<ZoomOut className="h-3.5 w-3.5" />
					</Button>
					<span className="w-8 text-center text-[10px] text-muted-foreground">{zoom}x</span>
					<Button
						size="icon"
						variant="ghost"
						title="Zoom in"
						className="h-6 w-6"
						onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + 1))}
					>
						<ZoomIn className="h-3.5 w-3.5" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						title="Reset view"
						className="h-6 w-6"
						onClick={() => {
							panRef.current = { x: 0, y: 0 };
							setZoom(2);
						}}
					>
						<Maximize className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>

			<div ref={containerRef} className="relative min-h-0 flex-1 bg-background/40">
				{sheet ? (
					<canvas
						ref={canvasRef}
						onWheel={handleWheel}
						width={viewport.width}
						height={viewport.height}
						onMouseDown={handleMouseDown}
						onContextMenu={(event) => event.preventDefault()}
						className={panning ? 'cursor-grabbing' : spaceDown ? 'cursor-grab' : 'cursor-crosshair'}
					/>
				) : (
					<button
						type="button"
						onClick={onPickSheet}
						className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
					>
						<FolderOpen className="h-8 w-8 opacity-40" />
						Open a sheet image, or paste one with Ctrl+V
					</button>
				)}
			</div>
		</div>
	);
};
