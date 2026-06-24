import { useRef, useMemo, useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import { CheckerBoard } from '~/components/CheckerBoard';
import { ScrollArea } from '~/components/ui/scroll-area';
import { SpriteCanvas } from '~/components/commons/SpriteCanvas';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { Dialog, DialogTitle, DialogHeader, DialogContent } from '~/components/ui/dialog';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from '~/components/ui/select';
import {
	ThingCategory,
	type ThingType,
	getCategoryMap,
	isValidSpriteId,
	getCategoryCount,
	getCategoryStartId
} from '~/lib/formats/tibia';

interface ItemPickerDialogProps {
	open: boolean;
	onItemSelect: (id: number) => void;
	onOpenChange: (open: boolean) => void;
}

const ITEMS_PER_PAGE = 100;

export const ItemPickerDialog = ({ open, onOpenChange, onItemSelect }: ItemPickerDialogProps) => {
	const { data, spriteSize, formatConfig, updateCounter, notifySpritesLoaded } = useAssetData();
	const [category, setCategory] = useState<ThingCategory>(ThingCategory.ITEM);
	const [searchId, setSearchId] = useState('');
	const [currentPage, setCurrentPage] = useState(1);

	const [filters, setFilters] = useState({
		isFluid: false,
		isGround: false,
		isWritable: false,
		isContainer: false,
		isStackable: false,
		isAnimation: false
	});

	const scrollViewportRef = useRef<HTMLDivElement>(null);

	const allItems = useMemo(() => {
		if (!data) return [];
		const map = getCategoryMap(data, category);
		const minId = getCategoryStartId(formatConfig, category);
		const count = getCategoryCount(data, category);
		const items: ThingType[] = [];
		const maxId = minId + count - 1;
		for (let id = minId; id <= maxId; id++) {
			const item = map.get(id);
			if (item) {
				items.push(item);
			}
		}
		return items;
	}, [data, category, formatConfig, updateCounter]);

	const filteredItems = useMemo(() => {
		return allItems.filter((item) => {
			if (searchId && !item.id.toString().includes(searchId)) {
				return false;
			}

			if (filters.isContainer && !item.isContainer) return false;
			if (filters.isStackable && !item.stackable) return false;
			if (filters.isGround && !item.isGround) return false;
			if (filters.isFluid && !item.isFluidContainer && !item.isFluid) return false;
			if (filters.isWritable && !item.writable && !item.writableOnce) return false;
			if (filters.isAnimation && !item.isAnimation) return false;

			return true;
		});
	}, [allItems, searchId, filters]);

	const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
	const paginatedItems = useMemo(() => {
		const start = (currentPage - 1) * ITEMS_PER_PAGE;
		return filteredItems.slice(start, start + ITEMS_PER_PAGE);
	}, [filteredItems, currentPage]);

	useEffect(() => {
		setCurrentPage(1);
	}, [category, searchId, filters]);

	useEffect(() => {
		if (!data || !data.sprPath || !open) return;

		let cancelled = false;

		const loadSprites = async () => {
			const { loadSpriteIds, loadSpriteIdsLz4 } = await import('~/lib/formats/tibia');

			const collectSpriteIds = (items: ThingType[]) => {
				const ids: number[] = [];
				for (const item of items) {
					if (item.spriteIndex) {
						for (const spriteId of item.spriteIndex) {
							if (isValidSpriteId(spriteId)) {
								ids.push(spriteId);
							}
						}
					}
					if (item.frameGroupsData) {
						for (const group of item.frameGroupsData) {
							if (group.spriteIndex) {
								for (const spriteId of group.spriteIndex) {
									if (isValidSpriteId(spriteId)) {
										ids.push(spriteId);
									}
								}
							}
						}
					}
				}
				return ids;
			};

			const spriteIds = collectSpriteIds(paginatedItems);

			if (spriteIds.length > 0 && !cancelled) {
				if (spriteIds.length > 100) {
					await loadSpriteIdsLz4(data.sprPath!, spriteIds, data.transparency, data.sprites);
				} else {
					await loadSpriteIds(data.sprPath!, spriteIds, data.transparency, data.sprites);
				}

				if (!cancelled) {
					notifySpritesLoaded();
				}
			}
		};

		loadSprites();

		return () => {
			cancelled = true;
		};
	}, [paginatedItems, data, open, notifySpritesLoaded]);

	useEffect(() => {
		if (scrollViewportRef.current) {
			const viewport = scrollViewportRef.current.querySelector('[data-radix-scroll-area-viewport]');
			if (viewport) {
				viewport.scrollTop = 0;
			}
		}
	}, [currentPage]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[80vw] max-h-[85vh] flex flex-col p-0 gap-0">
				<DialogHeader className="px-4 py-3 border-b border-border/50">
					<DialogTitle>Select Item</DialogTitle>
				</DialogHeader>

				<div className="flex flex-1 overflow-hidden">
					{/* Sidebar Filters */}
					<div className="w-64 border-r border-border/50 p-4 bg-secondary/20 flex flex-col gap-4 overflow-y-auto">
						<div className="space-y-2">
							<Label>Category</Label>
							<Select value={category} onValueChange={(v) => setCategory(v as ThingCategory)}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{formatConfig.categories.map((cat) => (
										<SelectItem key={cat.id} value={cat.id}>
											{cat.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Search ID</Label>
							<div className="relative">
								<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									value={searchId}
									className="pl-8"
									placeholder="Search ID..."
									onChange={(e) => setSearchId(e.target.value)}
								/>
							</div>
						</div>

						<div className="space-y-3">
							<Label>Properties</Label>
							<div className="space-y-2">
								<div className="flex items-center space-x-2">
									<Checkbox
										id="filter-container"
										checked={filters.isContainer}
										onCheckedChange={(c) => setFilters((f) => ({ ...f, isContainer: !!c }))}
									/>
									<label
										htmlFor="filter-container"
										className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										Container
									</label>
								</div>
								<div className="flex items-center space-x-2">
									<Checkbox
										id="filter-stackable"
										checked={filters.isStackable}
										onCheckedChange={(c) => setFilters((f) => ({ ...f, isStackable: !!c }))}
									/>
									<label
										htmlFor="filter-stackable"
										className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										Stackable
									</label>
								</div>
								<div className="flex items-center space-x-2">
									<Checkbox
										id="filter-ground"
										checked={filters.isGround}
										onCheckedChange={(c) => setFilters((f) => ({ ...f, isGround: !!c }))}
									/>
									<label
										htmlFor="filter-ground"
										className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										Ground
									</label>
								</div>
								<div className="flex items-center space-x-2">
									<Checkbox
										id="filter-fluid"
										checked={filters.isFluid}
										onCheckedChange={(c) => setFilters((f) => ({ ...f, isFluid: !!c }))}
									/>
									<label
										htmlFor="filter-fluid"
										className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										Fluid
									</label>
								</div>
								<div className="flex items-center space-x-2">
									<Checkbox
										id="filter-writable"
										checked={filters.isWritable}
										onCheckedChange={(c) => setFilters((f) => ({ ...f, isWritable: !!c }))}
									/>
									<label
										htmlFor="filter-writable"
										className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										Writable
									</label>
								</div>
								<div className="flex items-center space-x-2">
									<Checkbox
										id="filter-animation"
										checked={filters.isAnimation}
										onCheckedChange={(c) => setFilters((f) => ({ ...f, isAnimation: !!c }))}
									/>
									<label
										htmlFor="filter-animation"
										className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										Animation
									</label>
								</div>
							</div>
						</div>

						<div className="mt-auto pt-4 text-xs text-muted-foreground">Found: {filteredItems.length} items</div>
					</div>

					{/* Main Grid */}
					<div className="flex-1 flex flex-col bg-background">
						<ScrollArea className="flex-1 p-4" ref={scrollViewportRef}>
							<div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
								{paginatedItems.map((item) => (
									<button
										key={item.id}
										onClick={() => {
											onItemSelect(item.id);
											onOpenChange(false);
										}}
										className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-accent border border-transparent hover:border-border transition-colors group"
									>
										<CheckerBoard className="w-12 h-12 rounded border border-border/50 overflow-hidden bg-background">
											<SpriteCanvas
												thing={item}
												renderMode="list"
												width={item.width}
												height={item.height}
												scale={48 / (Math.max(item.width, item.height) * spriteSize)}
											/>
										</CheckerBoard>
										<span className="text-[10px] font-mono text-muted-foreground group-hover:text-foreground">{item.id}</span>
									</button>
								))}
							</div>
							{paginatedItems.length === 0 && (
								<div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
									<p>No items found matching filters.</p>
								</div>
							)}
						</ScrollArea>

						{/* Pagination */}
						<div className="h-12 border-t border-border/50 flex items-center justify-between px-4 bg-secondary/10">
							<Button
								size="sm"
								variant="ghost"
								disabled={currentPage === 1}
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
							>
								<ChevronLeft className="h-4 w-4 mr-2" />
								Previous
							</Button>
							<span className="text-sm text-muted-foreground">
								Page {currentPage} of {Math.max(1, totalPages)}
							</span>
							<Button
								size="sm"
								variant="ghost"
								disabled={currentPage >= totalPages}
								onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
							>
								Next
								<ChevronRight className="h-4 w-4 ml-2" />
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
