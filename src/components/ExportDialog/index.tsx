import type { ExportFormat } from '~/lib/formats/tibia';

import { Check, Package, Layers3, FolderOpen, FileArchive, ArrowUpRight } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Button } from '~/components/ui/button';
import { useExportDialog } from '~/usecase/hooks/useExportDialog';
import { FORMAT_ICONS, SECTION_LABEL, FORMAT_OPTIONS } from './constants';
import { Dialog, DialogTitle, DialogHeader, DialogContent, DialogDescription } from '~/components/ui/dialog';

export const ExportDialog = () => {
	const {
		busy,
		name,
		open_,
		things,
		format,
		isSheet,
		confirm,
		setName,
		isAppend,
		setFormat,
		appendPath,
		pickAppend,
		canConfirm,
		pickFolder,
		closeExport,
		outputFolder,
		setAppendPath,
		transparentBg,
		setTransparentBg
	} = useExportDialog();

	const appendName = appendPath ? appendPath.replace(/^.*[\\/]/, '') : null;

	return (
		<Dialog open={open_} onOpenChange={(o) => (o ? null : closeExport())}>
			<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
				<DialogHeader className="space-y-0 border-b border-border/60 bg-secondary/30 px-5 py-3 pr-12">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
							<Package className="h-4 w-4" />
						</div>
						<div className="min-w-0">
							<DialogTitle className="text-sm font-semibold tracking-tight">Export objects</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground">
								<span className="font-medium text-foreground/80 tabular-nums">{things.length}</span> object
								{things.length === 1 ? '' : 's'} selected
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-3 px-5 py-3.5">
					{!isAppend && (
						<>
							<div className="space-y-1">
								<Label htmlFor="export-name" className={SECTION_LABEL}>
									Name
								</Label>
								<Input value={name} id="export-name" className="h-7 text-sm" onChange={(e) => setName(e.target.value)} />
							</div>

							<div className="space-y-1">
								<Label htmlFor="export-folder" className={SECTION_LABEL}>
									Output folder
								</Label>
								<div className="flex gap-1.5">
									<Input
										readOnly
										id="export-folder"
										value={outputFolder}
										onClick={pickFolder}
										placeholder="Choose a folder…"
										className="h-7 cursor-pointer truncate text-sm"
									/>
									<Button size="sm" type="button" variant="outline" onClick={pickFolder} className="h-7 shrink-0 gap-1.5 px-2.5">
										<FolderOpen className="h-3.5 w-3.5" />
										Browse
									</Button>
								</div>
							</div>
						</>
					)}

					<div className="space-y-1.5">
						<Label className={SECTION_LABEL}>Format</Label>
						<div className="grid grid-cols-5 gap-1.5">
							{FORMAT_OPTIONS.map((opt) => {
								const Icon = FORMAT_ICONS[opt.value as ExportFormat];
								const active = format === opt.value;
								return (
									<button
										type="button"
										key={opt.value}
										onClick={() => setFormat(opt.value as ExportFormat)}
										className={cn(
											'group relative flex flex-col items-center gap-1 rounded-lg border py-2 transition-all duration-150',
											active
												? 'border-primary/60 bg-gradient-to-b from-primary/15 to-primary/5'
												: 'border-border bg-secondary/25 hover:border-border/80 hover:bg-secondary/50'
										)}
									>
										{active && (
											<span className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-primary-foreground">
												<Check strokeWidth={3} className="h-2 w-2" />
											</span>
										)}
										<Icon
											className={cn(
												'h-4 w-4 transition-colors',
												active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
											)}
										/>
										<span
											className={cn('text-[11px] font-semibold leading-none', active ? 'text-foreground' : 'text-foreground/80')}
										>
											{opt.label}
										</span>
										<span className="text-[9px] leading-none text-muted-foreground">{opt.hint}</span>
									</button>
								);
							})}
						</div>
					</div>

					{format === 'sfp' && (
						<div className="space-y-1.5">
							<Label className={SECTION_LABEL}>Destination</Label>
							<div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary/40 p-1">
								<button
									type="button"
									onClick={() => setAppendPath(null)}
									className={cn(
										'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
										!appendPath
											? 'bg-card text-foreground shadow-sm ring-1 ring-inset ring-border'
											: 'text-muted-foreground hover:text-foreground'
									)}
								>
									<Layers3 className="h-3.5 w-3.5" />
									New pack
								</button>
								<button
									type="button"
									onClick={pickAppend}
									className={cn(
										'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
										appendPath
											? 'bg-card text-foreground shadow-sm ring-1 ring-inset ring-border'
											: 'text-muted-foreground hover:text-foreground'
									)}
								>
									<FileArchive className="h-3.5 w-3.5" />
									Append
								</button>
							</div>
							{isAppend && (
								<div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs">
									<FileArchive className="h-3.5 w-3.5 shrink-0 text-primary" />
									<span className="truncate font-medium text-foreground">{appendName}</span>
									<button
										type="button"
										onClick={() => setAppendPath(null)}
										className="ml-auto shrink-0 text-muted-foreground transition-colors hover:text-foreground"
									>
										Remove
									</button>
								</div>
							)}
						</div>
					)}

					{isSheet && (
						<label
							htmlFor="transparent-bg"
							className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 bg-secondary/25 px-3 py-2"
						>
							<span>
								<span className="block text-xs font-medium text-foreground">Transparent background</span>
								<span className="block text-[11px] text-muted-foreground">Keep alpha instead of filling the canvas</span>
							</span>
							<Switch id="transparent-bg" checked={transparentBg} onCheckedChange={setTransparentBg} />
						</label>
					)}
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-border/60 bg-secondary/20 px-5 py-2.5">
					<Button size="sm" variant="ghost" disabled={busy} onClick={closeExport}>
						Cancel
					</Button>
					<Button size="sm" onClick={confirm} className="gap-1.5" disabled={busy || !canConfirm}>
						{busy ? 'Exporting…' : 'Export'}
						{!busy && <ArrowUpRight className="h-3.5 w-3.5" />}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
