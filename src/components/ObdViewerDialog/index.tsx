import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, FolderOpen, PackageOpen, FolderSearch } from 'lucide-react';

import { cn } from '~/lib/utils';
import { ObdCard } from './ObdCard';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { useObdViewer } from '~/usecase/hooks/useObdViewer';
import { Dialog, DialogTitle, DialogHeader, DialogContent, DialogDescription } from '~/components/ui/dialog';

const ROW_H = 120;

const CATEGORIES = [
	{ value: 0, label: 'All' },
	{ value: 1, label: 'Items' },
	{ value: 2, label: 'Outfits' },
	{ value: 3, label: 'Effects' },
	{ value: 4, label: 'Missiles' }
];

const fmtTime = (s: number) => {
	if (!isFinite(s) || s < 0) return '--';
	const m = Math.floor(s / 60);
	const sec = Math.floor(s % 60);
	return `${m}m ${sec.toString().padStart(2, '0')}s`;
};

export const ObdViewerDialog = () => {
	const v = useObdViewer();

	const rowCount = Math.ceil(v.total / v.itemsPerRow);
	const virtualizer = useVirtualizer({
		overscan: 5,
		count: rowCount,
		estimateSize: () => ROW_H,
		getScrollElement: () => v.scrollRef.current
	});

	const items = virtualizer.getVirtualItems();
	const firstRow = items.length ? items[0].index : 0;
	const lastRow = items.length ? items[items.length - 1].index : 0;

	React.useEffect(() => {
		if (!v.total) return;
		const start = firstRow * v.itemsPerRow;
		const end = Math.min((lastRow + 1) * v.itemsPerRow, v.total);
		v.ensureVisible(start, end);
	}, [firstRow, lastRow, v.itemsPerRow, v.total, v.ensureVisible]);

	const speed = v.progress && v.progress.elapsedMs > 0 ? v.progress.done / (v.progress.elapsedMs / 1000) : 0;
	const remaining = speed > 0 && v.progress ? (v.progress.total - v.progress.done) / speed : 0;
	const parsing = v.status === 1;
	const empty = v.total === 0 && !parsing;

	const allCount = v.stats?.total ?? v.total;
	const dupCount = v.stats?.duplicates ?? 0;

	return (
		<Dialog open={v.obdViewerOpen} onOpenChange={(o) => (o ? null : v.closeObdViewer())}>
			<DialogContent className="flex h-[680px] max-h-[88vh] flex-col gap-0 p-0 sm:max-w-[920px]">
				<DialogHeader className="px-5 pb-3 pt-5">
					<DialogTitle>OBD Viewer</DialogTitle>
					<DialogDescription>Open one or many .obd files to inspect their objects without importing them.</DialogDescription>
				</DialogHeader>

				<div className="flex flex-wrap items-center gap-2 px-5 pb-3">
					<Button size="sm" variant="secondary" onClick={v.openFiles} className="h-8 gap-1.5 text-xs">
						<FolderOpen className="h-3.5 w-3.5" />
						Open files
					</Button>
					<Button size="sm" variant="secondary" onClick={v.openFolder} className="h-8 gap-1.5 text-xs">
						<FolderSearch className="h-3.5 w-3.5" />
						Open folder
					</Button>
					<div className="relative ml-auto min-w-[180px] flex-1">
						<Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={v.search}
							className="h-8 pl-7 text-xs"
							placeholder="Search by name or ID"
							onChange={(e) => v.setSearch(e.target.value)}
						/>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-5 pb-3">
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={() => v.setDupOnly(false)}
							className={cn(
								'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
								!v.dupOnly ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
							)}
						>
							All ({allCount})
						</button>
						<button
							type="button"
							onClick={() => v.setDupOnly(true)}
							className={cn(
								'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
								v.dupOnly ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
							)}
						>
							Duplicates ({dupCount})
						</button>
					</div>
					<div className="ml-auto flex items-center gap-1">
						{CATEGORIES.map((c) => (
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
					</div>
				</div>

				{parsing && v.progress && (
					<div className="border-b border-border/50 bg-secondary/30 px-5 py-2">
						<div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
							<span>
								Processing {v.progress.done.toLocaleString()} of {v.progress.total.toLocaleString()}…
							</span>
							<span className="font-mono">
								Elapsed {fmtTime(v.progress.elapsedMs / 1000)} · {Math.round(speed).toLocaleString()}/s · Remaining{' '}
								{fmtTime(remaining)}
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
					{empty ? (
						<div className="flex h-full flex-col items-center justify-center gap-4 text-center">
							<PackageOpen className="h-12 w-12 text-muted-foreground" />
							<div className="space-y-1">
								<p className="text-sm text-foreground">Drop .obd files or a folder here</p>
								<p className="text-xs text-muted-foreground">or use Open files / Open folder above</p>
							</div>
						</div>
					) : (
						<div style={{ width: '100%', position: 'relative', height: virtualizer.getTotalSize() }}>
							{items.map((vr) => {
								const start = vr.index * v.itemsPerRow;
								const cells = [];
								for (let c = 0; c < v.itemsPerRow; c++) {
									const pos = start + c;
									if (pos >= v.total) break;
									const row = v.getRow(pos);
									cells.push(
										<div key={pos} className="flex-shrink-0">
											{row ? (
												<ObdCard
													row={row}
													onToggle={v.toggle}
													thumb={v.getThumb(row.recordIndex)}
													selected={v.selected.has(row.recordIndex)}
												/>
											) : (
												<div className="h-[112px] w-[88px] animate-pulse rounded-lg bg-secondary/40" />
											)}
										</div>
									);
								}
								return (
									<div
										key={vr.key}
										className="absolute left-0 top-0 flex gap-2"
										style={{ height: ROW_H, width: '100%', transform: `translateY(${vr.start}px)` }}
									>
										{cells}
									</div>
								);
							})}
						</div>
					)}
				</div>

				<div className="flex items-center justify-between border-t border-border/50 px-5 py-3">
					<span className="text-xs text-muted-foreground">
						{v.selected.size > 0 ? `${v.selected.size} selected` : `${v.total.toLocaleString()} objects`}
						{!v.hasProject && ' · open a project to import'}
					</span>
					<div className="flex gap-2">
						{v.selected.size > 0 && (
							<Button size="sm" variant="ghost" className="text-xs" onClick={v.clearSelection}>
								Clear
							</Button>
						)}
						<Button size="sm" onClick={v.importSelected} disabled={v.busy || v.selected.size === 0 || !v.hasProject}>
							{v.busy ? 'Importing…' : `Import${v.selected.size > 0 ? ` (${v.selected.size})` : ''}`}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
