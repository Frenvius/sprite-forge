import React from 'react';
import { Loader2, ImagePlus } from 'lucide-react';

import { cn } from '~/lib/utils.ts';
import { useSpriteCanvas, type SpriteCanvasProps } from '~/usecase/hooks/useSpriteCanvas.ts';

export const SpriteCanvas = React.memo((props: SpriteCanvasProps) => {
	const {
		scale,
		smooth,
		className,
		canvasRef,
		isLoading,
		isPanning,
		renderMode,
		onPanChange,
		canvasWidth,
		isPanEnabled,
		containerRef,
		canvasHeight,
		allowFileDrop,
		transformStyle,
		isFileDragging,
		isFileDragOver,
		handleMouseDown,
		handleMouseMove,
		overlayCanvasRef,
		handleMouseLeave,
		handleMouseDoubleClick
	} = useSpriteCanvas(props);

	return (
		<div
			ref={containerRef}
			className={cn('relative flex items-center justify-center', 'w-full h-full')}
			style={{ cursor: isPanning ? 'grabbing' : onPanChange && (isPanEnabled || isPanning) ? 'grab' : 'default' }}
		>
			<div className="relative" style={transformStyle}>
				<canvas
					ref={canvasRef}
					width={canvasWidth}
					height={canvasHeight}
					className={cn(className, 'block w-full h-full')}
					style={{ imageRendering: smooth ? 'auto' : 'pixelated' }}
				/>
				<canvas
					width={canvasWidth}
					height={canvasHeight}
					ref={overlayCanvasRef}
					onMouseMove={handleMouseMove}
					onMouseDown={handleMouseDown}
					onMouseLeave={handleMouseLeave}
					onDoubleClick={handleMouseDoubleClick}
					className="absolute inset-0 w-full h-full"
					style={{ imageRendering: smooth ? 'auto' : 'pixelated' }}
					onContextMenu={(e) => {
						if (e.button === 1) {
							e.preventDefault();
						}
					}}
				/>
			</div>
			{isLoading && renderMode !== 'list' && (
				<div
					className="absolute inset-0 flex items-center justify-center bg-black/20"
					style={{
						width: `${canvasWidth * scale} px`,
						height: `${canvasHeight * scale} px`
					}}
				>
					<Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
				</div>
			)}
			{isFileDragging && !isFileDragOver && allowFileDrop && (
				<div className="absolute inset-0 z-10 pointer-events-none rounded-lg border-2 border-primary animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
			)}
			{isFileDragOver && (
				<div className="absolute inset-0 flex flex-col items-center justify-center bg-primary/20 backdrop-blur-[1px] z-10 pointer-events-none rounded-lg border-2 border-dashed border-primary">
					<ImagePlus className="w-12 h-12 text-primary mb-2" />
					<span className="text-primary font-medium text-sm">Drop image to import</span>
				</div>
			)}
		</div>
	);
});
