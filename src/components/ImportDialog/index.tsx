import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ThingCategory } from '@/lib/formats/tibia';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FolderOpen, PackageOpen } from 'lucide-react';
import { useImportDialog } from '@/usecase/hooks/useImportDialog';
import { Dialog, DialogTitle, DialogFooter, DialogHeader, DialogContent, DialogDescription } from '@/components/ui/dialog';

import { EntryCard } from './EntryCard';
import { CATEGORY_FILTERS } from './constants';

export const ImportDialog = () => {
	const {
		busy,
		filter,
		search,
		toggle,
		confirm,
		loading,
		manifest,
		selected,
		pickFile,
		setFilter,
		setSearch,
		selectAll,
		selectNone,
		importOpen,
		closeImport,
		visibleEntries
	} = useImportDialog();

	return (
		<Dialog open={importOpen} onOpenChange={(o) => (o ? null : closeImport())}>
			<DialogContent className="flex h-[640px] max-h-[85vh] flex-col sm:max-w-[820px]">
				<DialogHeader>
					<DialogTitle>Import</DialogTitle>
					<DialogDescription>Pick the objects you want to bring in</DialogDescription>
				</DialogHeader>

				{!manifest && !loading && (
					<div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
						<PackageOpen className="h-12 w-12 text-muted-foreground" />
						<div className="space-y-1">
							<p className="text-sm text-foreground">Choose a pack or Object Builder file</p>
							<p className="text-xs text-muted-foreground">.sfp pack or one/many .obd files</p>
						</div>
						<Button className="gap-2" onClick={pickFile}>
							<FolderOpen className="h-4 w-4" />
							Browse files
						</Button>
					</div>
				)}

				{loading && <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Reading file…</div>}

				{manifest && !loading && (
					<>
						<div className="flex flex-wrap items-center gap-2">
							<div className="relative flex-1 min-w-[160px]">
								<Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={search}
									className="h-8 pl-7 text-xs"
									placeholder="Search name or id"
									onChange={(e) => setSearch(e.target.value)}
								/>
							</div>
							<div className="flex items-center gap-1">
								{CATEGORY_FILTERS.map((opt) => (
									<button
										type="button"
										key={opt.value}
										onClick={() => setFilter(opt.value as 'all' | ThingCategory)}
										className={cn(
											'rounded-md px-2 py-1 text-xs capitalize transition-colors',
											filter === opt.value ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-secondary'
										)}
									>
										{opt.label}
									</button>
								))}
							</div>
							<Button size="sm" variant="ghost" onClick={selectAll} className="h-8 text-xs">
								All
							</Button>
							<Button size="sm" variant="ghost" onClick={selectNone} className="h-8 text-xs">
								None
							</Button>
							<Button size="sm" variant="outline" onClick={pickFile} className="h-8 gap-1.5 text-xs">
								<FolderOpen className="h-3.5 w-3.5" />
								Open
							</Button>
						</div>

						<ScrollArea className="flex-1 rounded-lg border border-border/50 bg-background/40 p-2">
							{visibleEntries.length === 0 ? (
								<div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No matching objects</div>
							) : (
								<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
									{visibleEntries.map((entry) => (
										<EntryCard entry={entry} key={entry.index} onToggle={toggle} selected={selected.has(entry.index)} />
									))}
								</div>
							)}
						</ScrollArea>
					</>
				)}

				<DialogFooter className="items-center sm:justify-between">
					<span className="text-xs text-muted-foreground">
						{selected.size} selected{manifest ? ` of ${manifest.entries.length}` : ''}
					</span>
					<div className="flex gap-2">
						<Button variant="ghost" disabled={busy} onClick={closeImport}>
							Cancel
						</Button>
						<Button onClick={confirm} disabled={busy || selected.size === 0}>
							{busy ? 'Importing…' : 'Import'}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
