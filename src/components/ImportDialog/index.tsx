import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, FolderOpen, PackageOpen, FolderSearch } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Input } from '~/components/ui/input';
import { ObdCard } from '~/components/ObdCard';
import { Button } from '~/components/ui/button';
import { fmtTime } from '~/usecase/util/timeUtils';
import { useImportDialog } from '~/usecase/hooks/useImportDialog';
import { OBD_CATEGORIES, OBD_ROW_HEIGHT } from '~/usecase/util/constants';
import { Dialog, DialogTitle, DialogFooter, DialogHeader, DialogContent, DialogDescription } from '~/components/ui/dialog';

export const ImportDialog = () => {
	const v = useImportDialog();

	const rowVirtualizer = useVirtualizer({
		overscan: 5,
		estimateSize: () => OBD_ROW_HEIGHT,
		count: Math.ceil(v.total / v.itemsPerRow),
		getScrollElement: () => v.scrollRef.current
	});

	const items = rowVirtualizer.getVirtualItems();
	const firstRow = items.length ? items[0].index : 0;
	const lastRow = items.length ? items[items.length - 1].index : 0;

	React.useEffect(() => {
		if (!v.total) return;
		v.ensureVisible(firstRow * v.itemsPerRow, Math.min((lastRow + 1) * v.itemsPerRow, v.total));
	}, [firstRow, lastRow, v.itemsPerRow, v.total, v.ensureVisible]);

	const speed = v.progress && v.progress.elapsedMs > 0 ? v.progress.done / (v.progress.elapsedMs / 1000) : 0;
	const remaining = speed > 0 && v.progress ? (v.progress.total - v.progress.done) / speed : 0;
	const parsing = v.status === 1;
	const loaded = v.status !== 0 || v.total > 0;
	const dupCount = v.duplicateCount;

	return (
		<Dialog open={v.importOpen} onOpenChange={(o) => (o ? null : v.closeImport())}>
			<DialogContent className="flex h-[660px] max-h-[88vh] flex-col gap-0 border-0 p-0 outline-none focus:outline-none sm:max-w-[900px]">
				<DialogHeader className="px-5 pb-3 pt-5">
					<div className="flex items-end justify-between gap-4">
						<div className="space-y-1.5">
							<DialogTitle>Import</DialogTitle>
							<DialogDescription>Pick the objects you want to bring in</DialogDescription>
						</div>
						{loaded && (
							<span className="whitespace-nowrap text-xs text-muted-foreground">
								{v.selected.size} selected{v.total ? ` of ${v.total.toLocaleString()}` : ''}
							</span>
						)}
					</div>
				</DialogHeader>

				{!loaded && (
					<div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
						<PackageOpen className="h-12 w-12 text-muted-foreground" />
						<div className="space-y-1">
							<p className="text-sm text-foreground">Choose a pack or OBD file</p>
							<p className="text-xs text-muted-foreground">.sfp pack or one/many .obd files</p>
						</div>
						<div className="flex gap-2">
							<Button className="gap-2" onClick={v.pickFile}>
								<FolderOpen className="h-4 w-4" />
								Browse files
							</Button>
							<Button className="gap-2" variant="secondary" onClick={v.pickFolder}>
								<FolderSearch className="h-4 w-4" />
								Open folder
							</Button>
						</div>
					</div>
				)}

				{loaded && (
					<>
						<div className="flex flex-wrap items-center gap-2 px-5 pb-3 pt-3">
							<div className="relative min-w-[160px] flex-1">
								<Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={v.search}
									className="h-8 pl-7 text-xs"
									placeholder="Search name or id"
									onChange={(e) => v.setSearch(e.target.value)}
								/>
							</div>
							<div className="flex items-center gap-1">
								{OBD_CATEGORIES.map((c) => (
									<button
										type="button"
										key={c.value}
										onClick={() => v.setCategory(c.value)}
										className={cn(
											'rounded-md px-2 py-1 text-xs transition-colors',
											v.category === c.value ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-secondary'
										)}
									>
										{c.label}
									</button>
								))}
								<button
									type="button"
									disabled={dupCount === 0}
									onClick={() => v.setDupOnly(!v.dupOnly)}
									className={cn(
										'rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-40',
										v.dupOnly ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-secondary'
									)}
								>
									Duplicates ({dupCount})
								</button>
							</div>
							<Button size="sm" variant="ghost" onClick={v.selectAll} className="h-8 text-xs">
								All
							</Button>
							<Button size="sm" variant="ghost" onClick={v.selectNone} className="h-8 text-xs">
								None
							</Button>
							<Button size="sm" variant="outline" onClick={v.pickFile} className="h-8 gap-1.5 text-xs">
								<FolderOpen className="h-3.5 w-3.5" />
								Open
							</Button>
							<Button size="sm" variant="outline" onClick={v.pickFolder} className="h-8 gap-1.5 text-xs">
								<FolderSearch className="h-3.5 w-3.5" />
								Folder
							</Button>
						</div>

						{parsing && v.progress && (
							<div className="border-y border-border/50 bg-secondary/30 px-5 py-2">
								<div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
									<span>
										Processing {v.progress.done.toLocaleString()} of {v.progress.total.toLocaleString()}…
									</span>
									<span className="font-mono">
										{fmtTime(v.progress.elapsedMs / 1000)} · {Math.round(speed).toLocaleString()}/s · {fmtTime(remaining)} left
									</span>
								</div>
								<div className="h-1 w-full overflow-hidden rounded bg-secondary">
									<div
										className="h-full bg-primary transition-all"
										style={{ width: `${v.progress.total ? (v.progress.done / v.progress.total) * 100 : 0}%` }}
									/>
								</div>
							</div>
						)}

						<div ref={v.scrollRef} className="custom-scrollbar relative flex-1 overflow-auto px-5 py-3">
							{v.total === 0 ? (
								<div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
									{parsing ? 'Reading…' : 'No matching objects'}
								</div>
							) : (
								<div style={{ width: '100%', position: 'relative', height: rowVirtualizer.getTotalSize() }}>
									{items.map((vr) => {
										const start = vr.index * v.itemsPerRow;
										const cells = [];
										for (let c = 0; c < v.itemsPerRow; c++) {
											const pos = start + c;
											if (pos >= v.total) break;
											const row = v.getRow(pos);
											cells.push(
												row ? (
													<ObdCard
														fill
														row={row}
														key={pos}
														onToggle={v.toggle}
														thumb={v.getThumb(row.recordIndex)}
														selected={v.selected.has(row.recordIndex)}
													/>
												) : (
													<div key={pos} className="h-[112px] w-full animate-pulse rounded-lg bg-secondary/40" />
												)
											);
										}
										return (
											<div
												key={vr.key}
												className="absolute left-0 top-0 grid gap-2"
												style={{
													width: '100%',
													height: OBD_ROW_HEIGHT,
													transform: `translateY(${vr.start}px)`,
													gridTemplateColumns: `repeat(${v.itemsPerRow}, minmax(0, 1fr))`
												}}
											>
												{cells}
											</div>
										);
									})}
								</div>
							)}
						</div>
					</>
				)}

				<DialogFooter className="border-t border-border/50 px-5 py-3 sm:justify-between">
					{loaded ? (
						<Button
							size="sm"
							variant="outline"
							className="h-9 text-xs"
							onClick={v.deselectDuplicates}
							disabled={v.busy || dupCount === 0}
						>
							Deselect duplicates{dupCount > 0 ? ` (${dupCount})` : ''}
						</Button>
					) : (
						<span />
					)}
					<div className="flex items-center gap-2">
						{!v.hasProject && <span className="text-xs text-muted-foreground">Open a project to import</span>}
						<Button variant="ghost" disabled={v.busy} onClick={v.closeImport}>
							Cancel
						</Button>
						<Button onClick={v.confirm} disabled={v.busy || v.selected.size === 0 || !v.hasProject}>
							{v.busy ? 'Importing…' : 'Import'}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
