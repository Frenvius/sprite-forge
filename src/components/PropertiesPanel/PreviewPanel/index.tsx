import type { useObjectProperties } from '~/usecase/hooks/useObjectProperties';

import {
	Copy,
	Play,
	Move,
	Pause,
	Undo2,
	Blend,
	ZoomIn,
	ZoomOut,
	ArrowUp,
	Compass,
	TreePine,
	SkipBack,
	ChevronUp,
	ArrowDown,
	ArrowLeft,
	RotateCcw,
	ArrowRight,
	ChevronLeft,
	SkipForward,
	ChevronDown,
	ArrowUpLeft,
	ChevronRight,
	ArrowUpRight,
	ArrowDownLeft,
	ArrowDownRight
} from 'lucide-react';

import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { ZOOM_LEVELS } from '~/usecase/util/constants';
import { CheckerBoard } from '~/components/CheckerBoard';
import { SpriteCanvas } from '~/components/commons/SpriteCanvas';
import { usePropertiesContext } from '~/usecase/context/PropertiesContext';

interface PreviewPanelProps {
	preview: ReturnType<typeof useObjectProperties>['preview'];
}

export const PreviewPanel = ({ preview }: PreviewPanelProps) => {
	const { item, isOutfit, draftItem, isMissile, outfitData, handleResetSprites } = usePropertiesContext();
	const {
		zoom,
		panX,
		panY,
		setPanX,
		setPanY,
		patternX,
		patternY,
		patternZ,
		showGrid,
		isPlaying,
		showScene,
		copyFlash,
		sceneSize,
		showSmooth,
		setPatternX,
		setPatternY,
		currentFrame,
		currentLayer,
		setShowScene,
		isPanEnabled,
		handleZoomIn,
		setShowSmooth,
		showExactSize,
		handleZoomOut,
		handleResetPan,
		setIsPanEnabled,
		hoveredSpriteId,
		handlePatternUp,
		handlePrevFrame,
		handleNextFrame,
		handleLastFrame,
		handlePlayPause,
		handleCopySprite,
		handleFirstFrame,
		handleSpriteDrop,
		sceneScrollOffset,
		defaultSceneTiles,
		handlePatternDown,
		handlePatternLeft,
		handleSpriteHover,
		canvasContainerRef,
		handlePatternRight,
		showDirectionButtons,
		isMiddleMousePanning,
		setShowDirectionButtons,
		setIsMiddleMousePanning,
		handleSpriteDoubleClick
	} = preview;

	return (
		<div className="w-full max-w-[361px] mx-auto min-[820px]:w-[361px] min-[820px]:max-w-none flex flex-col h-full">
			<div className="flex flex-col items-center justify-between space-y-4 flex-1">
				<div ref={canvasContainerRef} className="relative w-full flex-1">
					<div className="absolute top-2 left-2 z-10 bg-secondary/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-muted-foreground font-mono border border-border/50 shadow-lg">
						{draftItem.width * draftItem.exactSize}x{draftItem.height * draftItem.exactSize}
					</div>

					{hoveredSpriteId !== null && (
						<div className="absolute bottom-2 right-2 z-10 bg-secondary/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-muted-foreground font-mono border border-border/50 shadow-lg">
							Sprite: {hoveredSpriteId}
						</div>
					)}

					{isOutfit && (
						<div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
							<Button
								size="icon"
								title="North"
								variant="ghost"
								disabled={!item}
								onClick={handlePatternUp}
								className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors p-0"
							>
								<ChevronUp className="h-3 w-3" />
							</Button>
							<Button
								size="icon"
								title="East"
								variant="ghost"
								onClick={handlePatternRight}
								disabled={!item || item.patternX < 2}
								className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors p-0"
							>
								<ChevronRight className="h-3 w-3" />
							</Button>
							<Button
								size="icon"
								title="South"
								variant="ghost"
								onClick={handlePatternDown}
								disabled={!item || item.patternX < 3}
								className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors p-0"
							>
								<ChevronDown className="h-3 w-3" />
							</Button>
							<Button
								size="icon"
								title="West"
								variant="ghost"
								onClick={handlePatternLeft}
								disabled={!item || item.patternX < 4}
								className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors p-0"
							>
								<ChevronLeft className="h-3 w-3" />
							</Button>
						</div>
					)}

					{isMissile && showDirectionButtons && (
						<div className="absolute inset-0 z-10 pointer-events-none">
							<div className="absolute top-[15%] left-1/2 -translate-x-1/2 flex gap-3 pointer-events-auto">
								<Button
									size="icon"
									variant="ghost"
									onClick={() => {
										setPatternX(0);
										setPatternY(0);
									}}
									className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
								>
									<ArrowUpLeft className="h-4 w-4 text-muted-foreground" />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									onClick={() => {
										setPatternX(1);
										setPatternY(0);
									}}
									className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
								>
									<ArrowUp className="h-4 w-4 text-muted-foreground" />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									onClick={() => {
										setPatternX(2);
										setPatternY(0);
									}}
									className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
								>
									<ArrowUpRight className="h-4 w-4 text-muted-foreground" />
								</Button>
							</div>

							<div className="absolute top-1/2 -translate-y-1/2 left-[15%] flex flex-col gap-1 pointer-events-auto">
								<Button
									size="icon"
									variant="ghost"
									onClick={() => {
										setPatternX(0);
										setPatternY(1);
									}}
									className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
								>
									<ArrowLeft className="h-4 w-4 text-muted-foreground" />
								</Button>
							</div>
							<div className="absolute top-1/2 -translate-y-1/2 right-[15%] flex flex-col gap-1 pointer-events-auto">
								<Button
									size="icon"
									variant="ghost"
									onClick={() => {
										setPatternX(2);
										setPatternY(1);
									}}
									className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
								>
									<ArrowRight className="h-4 w-4 text-muted-foreground" />
								</Button>
							</div>

							<div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 flex gap-3 pointer-events-auto">
								<Button
									size="icon"
									variant="ghost"
									onClick={() => {
										setPatternX(0);
										setPatternY(2);
									}}
									className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
								>
									<ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									onClick={() => {
										setPatternX(1);
										setPatternY(2);
									}}
									className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
								>
									<ArrowDown className="h-4 w-4 text-muted-foreground" />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									onClick={() => {
										setPatternX(2);
										setPatternY(2);
									}}
									className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
								>
									<ArrowDownRight className="h-4 w-4 text-muted-foreground" />
								</Button>
							</div>
						</div>
					)}

					{isMissile && (
						<div className="absolute top-2 right-[2.85rem] z-10 flex flex-col items-end gap-1">
							<div className="flex flex-col items-center bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
								<Button
									size="icon"
									variant={showDirectionButtons ? 'secondary' : 'ghost'}
									onClick={() => setShowDirectionButtons(!showDirectionButtons)}
									title={showDirectionButtons ? 'Hide direction buttons' : 'Show direction buttons'}
									className={cn(
										'h-6 w-6 p-0',
										showDirectionButtons ? 'bg-primary/20 hover:bg-primary/30' : 'hover:bg-secondary/50'
									)}
								>
									<Compass className="h-3 w-3 text-muted-foreground" />
								</Button>
							</div>
						</div>
					)}

					<div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
						<div className="flex flex-col items-center gap-0.5 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
							<Button
								size="icon"
								variant="ghost"
								onClick={handleZoomIn}
								className="h-6 w-6 hover:bg-secondary/50 p-0"
								disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
							>
								<ZoomIn className="h-3 w-3 text-muted-foreground" />
							</Button>
							<div className="px-1 text-[10px] font-mono text-foreground min-w-[1.5rem] text-center">{zoom}x</div>
							<Button
								size="icon"
								variant="ghost"
								onClick={handleZoomOut}
								disabled={zoom === ZOOM_LEVELS[0]}
								className="h-6 w-6 hover:bg-secondary/50 p-0"
							>
								<ZoomOut className="h-3 w-3 text-muted-foreground" />
							</Button>
						</div>

						<div className="flex flex-col gap-1 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
							<Button
								size="icon"
								variant="ghost"
								title="Reset center"
								onClick={handleResetPan}
								className="h-6 w-6 hover:bg-secondary/50 p-0"
							>
								<RotateCcw className="h-3 w-3 text-muted-foreground" />
							</Button>
							<Button
								size="icon"
								onClick={() => setIsPanEnabled(!isPanEnabled)}
								title={isPanEnabled ? 'Disable Pan' : 'Enable Pan'}
								variant={isPanEnabled || isMiddleMousePanning ? 'secondary' : 'ghost'}
								className={cn(
									'h-6 w-6 p-0',
									isPanEnabled || isMiddleMousePanning ? 'bg-primary/20 hover:bg-primary/30' : 'hover:bg-secondary/50'
								)}
							>
								<Move className="h-3 w-3 text-muted-foreground" />
							</Button>
						</div>

						<div className="flex flex-col gap-1 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
							<Button
								size="icon"
								variant="ghost"
								title="Reset Sprites"
								onClick={handleResetSprites}
								className="h-6 w-6 hover:bg-secondary/50 p-0"
							>
								<Undo2 className="h-3 w-3 text-muted-foreground" />
							</Button>
						</div>
						<div className="flex flex-col gap-1 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
							{isOutfit && (
								<Button
									size="icon"
									onClick={() => setShowScene(!showScene)}
									variant={showScene ? 'secondary' : 'ghost'}
									title={showScene ? 'Hide Scene' : 'Show Scene'}
									className={cn('h-6 w-6 p-0', showScene ? 'bg-primary/20 hover:bg-primary/30' : 'hover:bg-secondary/50')}
								>
									<TreePine className="h-3 w-3 text-muted-foreground" />
								</Button>
							)}
							<Button
								size="icon"
								onClick={() => setShowSmooth(!showSmooth)}
								variant={showSmooth ? 'secondary' : 'ghost'}
								title={showSmooth ? 'Disable Smoothing' : 'Enable Smoothing'}
								className={cn('h-6 w-6 p-0', showSmooth ? 'bg-primary/20 hover:bg-primary/30' : 'hover:bg-secondary/50')}
							>
								<Blend className="h-3 w-3 text-muted-foreground" />
							</Button>
						</div>
						<div className="flex flex-col gap-1 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
							<Button
								size="icon"
								variant="ghost"
								disabled={isPlaying}
								onClick={handleCopySprite}
								title={isPlaying ? 'Pause animation to copy' : 'Copy sprite to clipboard'}
								className={cn(
									'h-6 w-6 p-0 transition-all duration-150 active:scale-90',
									copyFlash ? 'bg-primary/30 scale-95' : 'hover:bg-secondary/50'
								)}
							>
								<Copy className="h-3 w-3 text-muted-foreground" />
							</Button>
						</div>
					</div>

					<CheckerBoard className="w-full h-full border border-border/50 rounded-lg flex items-center justify-center overflow-hidden">
						<SpriteCanvas
							showEmpty
							panX={panX}
							panY={panY}
							scale={zoom}
							allowFileDrop
							thing={draftItem}
							patternX={patternX}
							patternY={patternY}
							patternZ={patternZ}
							showGrid={showGrid}
							smooth={showSmooth}
							frame={currentFrame}
							layer={currentLayer}
							isPanEnabled={isPanEnabled}
							sceneWidth={sceneSize.width}
							showExactSize={showExactSize}
							sceneHeight={sceneSize.height}
							onSpriteDrop={handleSpriteDrop}
							onSpriteHover={handleSpriteHover}
							sceneScrollOffset={sceneScrollOffset}
							onSpriteDoubleClick={handleSpriteDoubleClick}
							outfitData={isOutfit ? outfitData : undefined}
							onMiddleMousePanChange={setIsMiddleMousePanning}
							sceneTiles={showScene ? defaultSceneTiles : undefined}
							renderMode={isMissile || isOutfit ? 'preview' : 'full'}
							onPanChange={(x, y) => {
								setPanX(x);
								setPanY(y);
							}}
						/>
					</CheckerBoard>

					{draftItem.frames > 1 && (
						<>
							<div className="absolute bottom-2 left-2 z-10 bg-secondary/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-muted-foreground font-mono border border-border/50 shadow-lg">
								Frame {currentFrame + 1}/{draftItem.frames}
							</div>

							<div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
								<Button
									size="icon"
									variant="ghost"
									onClick={handleFirstFrame}
									disabled={currentFrame === 0 || isPlaying}
									className="h-6 w-6 hover:bg-secondary/50 p-0"
								>
									<SkipBack className="h-3 w-3" />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									onClick={handlePrevFrame}
									disabled={currentFrame === 0 || isPlaying}
									className="h-6 w-6 hover:bg-secondary/50 p-0"
								>
									<ChevronLeft className="h-3 w-3" />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									onClick={handlePlayPause}
									className={`h-6 w-6 p-0 ${isPlaying ? 'bg-primary/20 text-primary' : 'hover:bg-primary/20'}`}
								>
									{isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
								</Button>
								<Button
									size="icon"
									variant="ghost"
									onClick={handleNextFrame}
									className="h-6 w-6 hover:bg-secondary/50 p-0"
									disabled={currentFrame >= draftItem.frames - 1 || isPlaying}
								>
									<ChevronRight className="h-3 w-3" />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									onClick={handleLastFrame}
									className="h-6 w-6 hover:bg-secondary/50 p-0"
									disabled={currentFrame >= draftItem.frames - 1 || isPlaying}
								>
									<SkipForward className="h-3 w-3" />
								</Button>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
};
