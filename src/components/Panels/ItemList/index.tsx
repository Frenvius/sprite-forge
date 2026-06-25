import { Edit, Copy, Plus, Circle, Trash2, Upload, Package, Sparkles, Download, Clipboard, ClipboardPaste } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { DragHandleProps } from '~/usecase/util/dock';
import { ScrollArea } from '~/components/ui/scroll-area';
import { CheckerBoard } from '~/components/CheckerBoard';
import { useItemList } from '~/usecase/hooks/useItemList';
import { SpriteCanvas } from '~/components/commons/SpriteCanvas';
import { ViewModeMenu } from '~/components/commons/ViewModeMenu';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { ListPagination } from '~/components/commons/ListPagination';
import { ThingCategory, TIBIA_FORMAT_CONFIG } from '~/lib/formats/tibia';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '~/components/ui/tooltip';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from '~/components/ui/select';
import { ContextMenu, ContextMenuItem, ContextMenuContent, ContextMenuTrigger } from '~/components/ui/context-menu';

export const ItemList = ({ dragHandle }: { dragHandle?: DragHandleProps }) => {
	const {
		data,
		getThing,
		viewMode,
		editItem,
		selectItem,
		inputValue,
		removeItem,
		totalPages,
		spriteSize,
		importInto,
		currentPage,
		setViewMode,
		findSimilar,
		exportSheets,
		goToLastItem,
		importGeneral,
		createNewItem,
		setInputValue,
		updateCounter,
		duplicateItem,
		canFindSimilar,
		copyProperties,
		selectedItemIds,
		pasteProperties,
		handlePageChange,
		copiedProperties,
		selectedCategory,
		paginatedItemIds,
		scrollViewportRef,
		hasUnsavedChanges,
		highlightedItemId,
		handleInputKeyDown,
		setSelectedCategory,
		handleContextMenuTarget
	} = useItemList();

	const { getServerItemsForClient } = useAssetData();
	const showServerInfo = !!data?.otbPath && selectedCategory === ThingCategory.ITEM;
	const handleProps = dragHandle ? { ref: dragHandle.ref, ...dragHandle.attributes, ...dragHandle.listeners } : {};

	const selectionCount = selectedItemIds.size;
	const isMulti = selectionCount > 1;
	const selectionIds = Array.from(selectedItemIds);

	if (!data) {
		return (
			<div className="w-full h-full bg-card rounded-lg shadow-island flex flex-col overflow-hidden">
				<div
					{...handleProps}
					className={cn(
						'h-8 px-3 flex items-center gap-2 border-b border-border/50 bg-secondary/80',
						dragHandle && 'cursor-grab active:cursor-grabbing'
					)}
				>
					<Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as ThingCategory)}>
						<SelectTrigger className="h-6 w-24 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{TIBIA_FORMAT_CONFIG.categories.map((cat) => (
								<SelectItem key={cat.id} value={cat.id}>
									{cat.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<span className="ml-auto text-xs text-muted-foreground font-mono">0</span>
				</div>
				<div className="flex-1 flex items-center justify-center p-4">
					<div className="text-center text-muted-foreground">
						<Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
						<p className="text-xs">No files loaded</p>
						<p className="text-[10px] mt-1">Click "Open Files" to load Tibia.dat</p>
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
					'h-8 px-3 flex items-center gap-2 border-b border-border/50 bg-secondary/80',
					dragHandle && 'cursor-grab active:cursor-grabbing'
				)}
			>
				<Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as ThingCategory)}>
					<SelectTrigger className="h-6 w-24 text-xs mt-[1px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ThingCategory.ITEM}>Item</SelectItem>
						<SelectItem value={ThingCategory.OUTFIT}>Outfit</SelectItem>
						<SelectItem value={ThingCategory.EFFECT}>Effect</SelectItem>
						<SelectItem value={ThingCategory.MISSILE}>Missile</SelectItem>
					</SelectContent>
				</Select>

				<div className="ml-auto flex items-center gap-1">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button size="icon" variant="ghost" disabled={!data} className="h-6 w-6" onClick={createNewItem}>
									<Plus className="h-3.5 w-3.5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Create new item</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					<ViewModeMenu viewMode={viewMode} onViewModeChange={setViewMode} />
				</div>
			</div>

			<ContextMenu>
				<ContextMenuTrigger asChild>
					<ScrollArea className="flex-1" ref={scrollViewportRef}>
						<TooltipProvider>
							<div
								key={updateCounter}
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
								{paginatedItemIds.map((id) => {
									const item = getThing(id, selectedCategory);
									if (!item) return null;

									const server = showServerInfo ? getServerItemsForClient(id)[0] : undefined;
									const displayName = server?.nameXml || server?.name || (item.isMarketItem ? item.marketName : '') || '';

									return (
										<ContextMenu key={id}>
											<ContextMenuTrigger asChild>
												<button
													data-item-id={id}
													onDoubleClick={() => editItem(id)}
													onClick={(e) => selectItem(id, e)}
													onContextMenu={(e) => {
														e.stopPropagation();
														handleContextMenuTarget(id);
													}}
													className={cn(
														'w-full rounded-md transition-all hover:bg-item-hover relative',
														(selectedItemIds.has(id) || highlightedItemId === id) && 'bg-primary/15 ring-1 ring-primary/50',
														viewMode === 'list' && 'flex items-center gap-2 px-2 py-1',
														viewMode === 'grid' && 'flex items-center px-1 py-0.5 gap-1.5',
														viewMode === 'grid-3' && 'flex flex-col items-center px-1 py-1 gap-1',
														viewMode === 'grid-4' && 'flex flex-col items-center px-0.5 py-1 gap-0.5',
														viewMode === 'large' && 'flex items-center px-1 py-0.5 gap-1.5',
														viewMode === 'large-2' && 'flex flex-col items-stretch gap-1 p-1.5 overflow-hidden'
													)}
												>
													<CheckerBoard
														className={cn(
															'rounded-md border border-border/50 flex items-center justify-center flex-shrink-0 overflow-hidden',
															viewMode === 'list' && 'w-8 h-8',
															viewMode === 'grid' && 'w-12 h-12',
															viewMode === 'grid-3' && 'w-11 h-11',
															viewMode === 'grid-4' && 'w-9 h-9',
															viewMode === 'large' && 'w-24 h-24',
															viewMode === 'large-2' && 'w-full aspect-square'
														)}
													>
														<SpriteCanvas
															showEmpty
															thing={item}
															renderMode="list"
															width={item.width}
															height={item.height}
															fill={viewMode === 'large-2'}
															scale={
																({ list: 36, grid: 48, large: 96, 'grid-3': 44, 'grid-4': 36 }[viewMode] ?? 96) /
																(Math.max(item.width, item.height) * spriteSize)
															}
														/>
													</CheckerBoard>
													<div
														className={cn(
															'min-w-0',
															viewMode === 'list' && 'flex-1 text-left',
															viewMode === 'grid' && 'flex-1 text-right',
															viewMode === 'grid-3' && 'w-full text-center',
															viewMode === 'grid-4' && 'w-full text-center',
															viewMode === 'large' && 'flex-1 text-right',
															viewMode === 'large-2' && 'w-full text-center'
														)}
													>
														{viewMode === 'grid' || viewMode === 'large' ? (
															<div className="text-[11px] text-foreground font-mono font-medium leading-tight">{id}</div>
														) : viewMode === 'large-2' ? (
															<div className="text-[11px] text-foreground font-mono font-medium leading-tight truncate">{id}</div>
														) : viewMode === 'grid-3' ? (
															<div className="text-[10px] text-foreground font-mono font-medium leading-tight truncate">{id}</div>
														) : viewMode === 'grid-4' ? (
															<div className="text-[9px] text-foreground font-mono font-medium leading-tight truncate">{id}</div>
														) : (
															<>
																<div className="text-[11px] text-foreground font-mono font-medium leading-tight truncate">
																	{id}
																	{displayName ? ` - ${displayName}` : ''}
																</div>
																{server ? (
																	<div className="text-[9px] text-muted-foreground font-mono leading-tight truncate">
																		Server Id: {server.serverId}
																	</div>
																) : (
																	((item.isMarketItem && item.marketName) || item.stackable) && (
																		<div className="text-[9px] text-muted-foreground leading-tight truncate">
																			{item.isMarketItem && item.marketName ? item.marketName : ''}
																			{item.isMarketItem && item.marketName && item.stackable ? ' • ' : ''}
																			{item.stackable && !item.marketName ? 'Stackable' : ''}
																		</div>
																	)
																)}
															</>
														)}
													</div>
													{hasUnsavedChanges(id, selectedCategory) && (
														<Tooltip>
															<TooltipTrigger asChild>
																<Circle
																	className={cn(
																		'text-primary fill-primary flex-shrink-0',
																		viewMode === 'grid-3' || viewMode === 'grid-4'
																			? 'absolute top-0.5 right-0.5 h-2 w-2'
																			: 'h-2.5 w-2.5'
																	)}
																/>
															</TooltipTrigger>
															<TooltipContent>
																<p>Unsaved changes</p>
															</TooltipContent>
														</Tooltip>
													)}
												</button>
											</ContextMenuTrigger>
											<ContextMenuContent>
												<ContextMenuItem disabled={isMulti} onClick={() => editItem(id)}>
													<Edit className="mr-2 h-4 w-4" />
													<span>Edit</span>
												</ContextMenuItem>
												<ContextMenuItem onClick={() => duplicateItem(isMulti ? selectionIds : id, item)}>
													<Copy className="mr-2 h-4 w-4" />
													<span>{isMulti ? `Duplicate (${selectionCount})` : 'Duplicate'}</span>
												</ContextMenuItem>
												<ContextMenuItem
													disabled={isMulti ? false : !canFindSimilar(item)}
													onClick={() =>
														findSimilar(
															isMulti
																? selectionIds.map((sid) => ({ id: sid, category: selectedCategory }))
																: [{ id, category: selectedCategory }]
														)
													}
												>
													<Sparkles className="mr-2 h-4 w-4" />
													<span>{isMulti ? `Find Similar (${selectionCount})` : 'Find Similar'}</span>
												</ContextMenuItem>
												<ContextMenuItem disabled={isMulti} onClick={() => copyProperties(item)}>
													<Clipboard className="mr-2 h-4 w-4" />
													<span>Copy Properties</span>
												</ContextMenuItem>
												<ContextMenuItem
													disabled={!copiedProperties}
													onClick={() => pasteProperties(isMulti ? selectionIds : id)}
												>
													<ClipboardPaste className="mr-2 h-4 w-4" />
													<span>{isMulti ? `Paste Properties (${selectionCount})` : 'Paste Properties'}</span>
												</ContextMenuItem>
												<ContextMenuItem onClick={() => exportSheets(isMulti ? selectionIds : id)}>
													<Download className="mr-2 h-4 w-4" />
													<span>{isMulti ? `Export (${selectionCount})` : 'Export…'}</span>
												</ContextMenuItem>
												<ContextMenuItem onClick={() => importInto(item)}>
													<Upload className="mr-2 h-4 w-4" />
													<span>Import…</span>
												</ContextMenuItem>
												<ContextMenuItem
													className="text-destructive focus:text-destructive"
													onClick={() => removeItem(isMulti ? selectionIds : id)}
												>
													<Trash2 className="mr-2 h-4 w-4" />
													<span>{isMulti ? `Remove (${selectionCount})` : 'Remove'}</span>
												</ContextMenuItem>
											</ContextMenuContent>
										</ContextMenu>
									);
								})}
							</div>
						</TooltipProvider>
					</ScrollArea>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem onClick={createNewItem}>
						<Plus className="mr-2 h-4 w-4" />
						<span>Create new item</span>
					</ContextMenuItem>
					<ContextMenuItem onClick={importGeneral}>
						<Upload className="mr-2 h-4 w-4" />
						<span>Import…</span>
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			<ListPagination
				onLast={goToLastItem}
				totalPages={totalPages}
				inputValue={inputValue}
				currentPage={currentPage}
				onInputChange={setInputValue}
				onPageChange={handlePageChange}
				onInputKeyDown={handleInputKeyDown}
			/>
		</div>
	);
};
