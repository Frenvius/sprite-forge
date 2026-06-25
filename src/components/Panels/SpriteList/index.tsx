import { Copy, Plus, Image, Search, Trash2, Upload, Download, ClipboardPaste } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { DragHandleProps } from '~/usecase/util/dock';
import { useSpriteList } from '~/usecase/hooks/useSpriteList';
import { SpriteCanvas } from '~/components/commons/SpriteCanvas';
import { ViewModeMenu } from '~/components/commons/ViewModeMenu';
import { ListPagination } from '~/components/commons/ListPagination';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '~/components/ui/tooltip';
import {
	ContextMenu,
	ContextMenuItem,
	ContextMenuContent,
	ContextMenuTrigger,
	ContextMenuSeparator
} from '~/components/ui/context-menu';

export const SpriteList = ({ dragHandle }: { dragHandle?: DragHandleProps }) => {
	const {
		data,
		viewMode,
		openSprite,
		inputValue,
		totalPages,
		currentPage,
		setViewMode,
		selectSprite,
		setInputValue,
		goToLastSprite,
		createNewSprite,
		handlePageChange,
		handleFindUsages,
		scrollViewportRef,
		selectedSpriteIds,
		handleDeleteSprite,
		handleInputKeyDown,
		paginatedSpriteIds,
		pasteClipboardImage,
		highlightedSpriteId,
		handleReplaceFromPng,
		startSpriteDragTimer,
		handleCopySpriteImage,
		handleExportSpritePng,
		handleExportSpritesPng,
		handleContextMenuTarget
	} = useSpriteList();

	const selectionCount = selectedSpriteIds.size;
	const isMulti = selectionCount > 1;
	const selectionIds = Array.from(selectedSpriteIds);
	const handleProps = dragHandle ? { ref: dragHandle.ref, ...dragHandle.attributes, ...dragHandle.listeners } : {};

	if (!data) {
		return (
			<div className="w-full h-full bg-card rounded-lg shadow-island flex flex-col overflow-hidden">
				<div
					{...handleProps}
					className={cn(
						'h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80',
						dragHandle && 'cursor-grab active:cursor-grabbing'
					)}
				>
					<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Sprites</h2>
					<span className="ml-auto text-xs text-muted-foreground font-mono">0</span>
				</div>
				<div className="flex-1 flex items-center justify-center p-4">
					<div className="text-center text-muted-foreground">
						<Image className="h-10 w-10 mx-auto mb-2 opacity-50" />
						<p className="text-xs">No files loaded</p>
						<p className="text-[10px] mt-1">Click "Open Files" to load Tibia.spr</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full h-full bg-card rounded-lg shadow-island flex flex-col overflow-hidden relative">
			<div
				{...handleProps}
				className={cn(
					'h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80',
					dragHandle && 'cursor-grab active:cursor-grabbing'
				)}
			>
				<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Sprites</h2>

				<div className="ml-auto flex items-center gap-1">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button size="icon" variant="ghost" disabled={!data} className="h-6 w-6" onClick={createNewSprite}>
									<Plus className="h-3.5 w-3.5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Create new sprite</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					<ViewModeMenu viewMode={viewMode} onViewModeChange={setViewMode} />
				</div>
			</div>

			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div ref={scrollViewportRef} className="flex-1 overflow-y-auto custom-scrollbar">
						<div
							className={cn(
								'p-2 pb-16',
								viewMode === 'list' && 'space-y-0.5',
								viewMode === 'grid' && 'grid grid-cols-2 gap-1',
								viewMode === 'grid-3' && 'grid grid-cols-3 gap-1',
								viewMode === 'grid-4' && 'grid grid-cols-4 gap-1',
								viewMode === 'large' && 'grid grid-cols-1 gap-2',
								viewMode === 'large-2' && 'grid grid-cols-2 gap-2'
							)}
						>
							{paginatedSpriteIds.map((id) => (
								<ContextMenu key={id}>
									<ContextMenuTrigger asChild>
										<div
											role="button"
											data-sprite-id={id}
											onClick={(e) => {
												e.stopPropagation();
												selectSprite(id, e);
											}}
											onDoubleClick={(e) => {
												e.stopPropagation();
												openSprite(id);
											}}
											onContextMenu={(e) => {
												e.stopPropagation();
												handleContextMenuTarget(id);
											}}
											onMouseUp={(e) => {
												const timer = (e.target as any)._dragTimer;
												if (timer) clearTimeout(timer);
											}}
											style={{
												userSelect: 'none',
												msUserSelect: 'none',
												MozUserSelect: 'none',
												WebkitUserSelect: 'none'
											}}
											className={cn(
												'w-full rounded-md transition-all hover:bg-item-hover cursor-grab active:cursor-grabbing relative',
												(selectedSpriteIds.has(id) || highlightedSpriteId === id) && 'bg-primary/15 ring-1 ring-primary/50',
												viewMode === 'list' && 'flex items-center gap-2 px-2 py-1',
												viewMode === 'grid' && 'flex items-center px-1 py-0.5 gap-1.5',
												viewMode === 'grid-3' && 'flex flex-col items-center px-1 py-1 gap-1',
												viewMode === 'grid-4' && 'flex flex-col items-center px-0.5 py-1 gap-0.5',
												viewMode === 'large' && 'flex items-center px-1 py-0.5 gap-1.5',
												viewMode === 'large-2' && 'flex flex-col items-stretch gap-1 p-1.5 overflow-hidden'
											)}
											onMouseDown={(e) => {
												if (e.button !== 0) return;

												e.preventDefault();
												e.stopPropagation();

												(e.target as any)._dragTimer = startSpriteDragTimer(id, (idsToDrag) => (
													<div className="bg-background border border-border rounded-md shadow-lg overflow-hidden w-12 h-12 flex items-center justify-center relative">
														<SpriteCanvas showEmpty scale={1.5} spriteId={id} renderMode="list" />
														{idsToDrag.length > 1 && (
															<div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-1 rounded-bl-md">
																{idsToDrag.length}
															</div>
														)}
													</div>
												));
											}}
										>
											<div
												className={cn(
													'rounded-md border border-border/50 flex items-center justify-center flex-shrink-0 overflow-hidden bg-muted pointer-events-none select-none',
													viewMode === 'list' && 'w-8 h-8',
													viewMode === 'grid' && 'w-12 h-12',
													viewMode === 'grid-3' && 'w-11 h-11',
													viewMode === 'grid-4' && 'w-9 h-9',
													viewMode === 'large' && 'w-32 h-32',
													viewMode === 'large-2' && 'w-full aspect-square'
												)}
											>
												<SpriteCanvas
													showEmpty
													spriteId={id}
													renderMode="list"
													fill={viewMode === 'large-2'}
													className="pointer-events-none select-none"
													scale={
														viewMode === 'list'
															? 1
															: viewMode === 'grid'
																? 1.5
																: viewMode === 'grid-3'
																	? 1.375
																	: viewMode === 'grid-4'
																		? 1.125
																		: 4
													}
												/>
											</div>
											<div
												className={cn(
													'min-w-0 pointer-events-none select-none',
													viewMode === 'list' && 'flex-1 text-left',
													viewMode === 'grid' && 'flex-1 text-right',
													viewMode === 'grid-3' && 'w-full text-center',
													viewMode === 'grid-4' && 'w-full text-center',
													viewMode === 'large' && 'flex-1 text-right',
													viewMode === 'large-2' && 'w-full text-center'
												)}
											>
												<div
													className={cn(
														'text-foreground font-mono font-medium leading-tight truncate',
														viewMode === 'grid-4' ? 'text-[9px]' : viewMode === 'grid-3' ? 'text-[10px]' : 'text-[11px]'
													)}
												>
													{id}
												</div>
											</div>
										</div>
									</ContextMenuTrigger>
									<ContextMenuContent>
										<ContextMenuItem disabled={isMulti} onClick={() => id && handleCopySpriteImage(id)}>
											<Copy className="mr-2 h-4 w-4" />
											<span>Copy Image</span>
										</ContextMenuItem>
										<ContextMenuItem disabled={isMulti} onClick={() => id && data && pasteClipboardImage(id)}>
											<ClipboardPaste className="mr-2 h-4 w-4" />
											<span>Paste from Clipboard</span>
										</ContextMenuItem>
										<ContextMenuSeparator />
										<ContextMenuItem disabled={isMulti} onClick={() => id && handleFindUsages(id)}>
											<Search className="mr-2 h-4 w-4" />
											<span>Find Usages</span>
										</ContextMenuItem>
										<ContextMenuSeparator />
										<ContextMenuItem
											onClick={() => (isMulti ? handleExportSpritesPng(selectionIds) : id && handleExportSpritePng(id))}
										>
											<Download className="mr-2 h-4 w-4" />
											<span>{isMulti ? `Export PNGs (${selectionCount})...` : 'Export PNG...'}</span>
										</ContextMenuItem>
										<ContextMenuItem disabled={isMulti} onClick={() => id && handleReplaceFromPng(id)}>
											<Upload className="mr-2 h-4 w-4" />
											<span>Replace from PNG...</span>
										</ContextMenuItem>
										<ContextMenuSeparator />
										<ContextMenuItem
											className="text-destructive focus:text-destructive"
											onClick={() => (isMulti ? handleDeleteSprite(selectionIds) : id && handleDeleteSprite(id))}
										>
											<Trash2 className="mr-2 h-4 w-4" />
											<span>{isMulti ? `Remove (${selectionCount})` : 'Remove'}</span>
										</ContextMenuItem>
									</ContextMenuContent>
								</ContextMenu>
							))}
						</div>
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem onClick={createNewSprite}>
						<Plus className="mr-2 h-4 w-4" />
						<span>Create new sprite</span>
					</ContextMenuItem>
					<ContextMenuItem onClick={() => pasteClipboardImage()}>
						<ClipboardPaste className="mr-2 h-4 w-4" />
						<span>Paste from Clipboard</span>
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			<ListPagination
				totalPages={totalPages}
				inputValue={inputValue}
				onLast={goToLastSprite}
				currentPage={currentPage}
				onInputChange={setInputValue}
				onPageChange={handlePageChange}
				onInputKeyDown={handleInputKeyDown}
			/>
		</div>
	);
};
