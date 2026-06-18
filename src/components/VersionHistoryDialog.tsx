import type { CommitLog } from '@/lib/versionControl';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/usecase/hooks/use-toast';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useAssetData } from '@/usecase/context/AssetDataContext';
import { getCommitHistory, cleanOldVersions } from '@/lib/versionControl';
import { Clock, Trash2, Package, RotateCcw, FolderOpen } from 'lucide-react';

import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogTitle, DialogHeader, DialogContent, DialogDescription } from './ui/dialog';

interface VersionHistoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const VersionHistoryDialog = ({ open, onOpenChange }: VersionHistoryDialogProps) => {
	const { toast } = useToast();
	const { data, restoreCommit } = useAssetData();
	const [commitLog, setCommitLog] = useState<null | CommitLog>(null);
	const [loading, setLoading] = useState(false);
	const [cleanupDays, setCleanupDays] = useState('30');
	const [cleanupCount, setCleanupCount] = useState('10');
	const [restoringHash, setRestoringHash] = useState<null | string>(null);

	// Load commit history when dialog opens
	useEffect(() => {
		if (open) {
			loadCommitHistory();
		}
	}, [open]);

	const loadCommitHistory = async () => {
		setLoading(true);
		try {
			const history = await getCommitHistory();
			setCommitLog(history);
		} catch (err) {
			console.error('Failed to load commit history:', err);
			toast({
				variant: 'destructive',
				title: 'Failed to load history',
				description: err instanceof Error ? err.message : 'Unknown error'
			});
		} finally {
			setLoading(false);
		}
	};

	const handleCleanupByDays = async () => {
		const days = parseInt(cleanupDays, 10);
		if (isNaN(days) || days < 1) {
			toast({
				variant: 'destructive',
				title: 'Invalid input',
				description: 'Please enter a valid number of days'
			});
			return;
		}

		try {
			const deleted = await cleanOldVersions({ olderThanDays: days });

			toast({
				title: 'Cleanup complete',
				description: `Deleted ${deleted} old version${deleted !== 1 ? 's' : ''}`
			});

			// Reload history
			await loadCommitHistory();
		} catch (err) {
			toast({
				variant: 'destructive',
				title: 'Cleanup failed',
				description: err instanceof Error ? err.message : 'Unknown error'
			});
		}
	};

	const handleCleanupByCount = async () => {
		const count = parseInt(cleanupCount, 10);
		if (isNaN(count) || count < 1) {
			toast({
				variant: 'destructive',
				title: 'Invalid input',
				description: 'Please enter a valid number'
			});
			return;
		}

		try {
			const deleted = await cleanOldVersions({ keepLast: count });

			toast({
				title: 'Cleanup complete',
				description: `Deleted ${deleted} old version${deleted !== 1 ? 's' : ''}`
			});

			// Reload history
			await loadCommitHistory();
		} catch (err) {
			toast({
				variant: 'destructive',
				title: 'Cleanup failed',
				description: err instanceof Error ? err.message : 'Unknown error'
			});
		}
	};

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleString();
	};

	const formatRelativeTime = (timestamp: number) => {
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
		if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
		if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
		return 'Just now';
	};

	const handleRestore = async (hash: string) => {
		if (!data) {
			toast({
				variant: 'destructive',
				title: 'No project open',
				description: 'Open a DAT/SPR project before restoring a version'
			});
			return;
		}

		const confirmed = window.confirm(
			'Restore this version?\n\nIt will revert the affected items and sprites in memory. You still need to compile to write the rollback to disk.'
		);
		if (!confirmed) return;

		setRestoringHash(hash);
		try {
			const result = await restoreCommit(hash);
			toast({
				title: 'Version restored',
				description: `Reverted ${result.itemsRestored} items and ${result.spritesRestored} sprites. Compile to persist.${
					result.itemsSkipped + result.spritesSkipped > 0
						? ` (${result.itemsSkipped + result.spritesSkipped} entries skipped: they were created in this commit and have no prior state.)`
						: ''
				}`
			});
			onOpenChange(false);
		} catch (err) {
			toast({
				variant: 'destructive',
				title: 'Restore failed',
				description: err instanceof Error ? err.message : 'Unknown error'
			});
		} finally {
			setRestoringHash(null);
		}
	};

	const handleOpenSettingsFolder = async () => {
		try {
			const configDir = await invoke<string>('get_config_dir_path');
			await revealItemInDir(configDir);
		} catch (err) {
			toast({
				variant: 'destructive',
				title: 'Failed to open folder',
				description: err instanceof Error ? err.message : 'Unknown error'
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
				<DialogHeader>
					<div className="flex items-center justify-between">
						<DialogTitle>Version History</DialogTitle>
						<Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleOpenSettingsFolder}>
							<FolderOpen className="h-3 w-3 mr-1" />
							Open Settings Folder
						</Button>
					</div>
					<DialogDescription>View and manage compilation history with version control</DialogDescription>
				</DialogHeader>

				<div className="flex-1 flex flex-col gap-4 overflow-hidden">
					{/* Commit History */}
					<div className="flex-1 flex flex-col overflow-hidden">
						<h3 className="text-sm font-medium mb-2">Commits</h3>
						{loading ? (
							<div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Loading...</div>
						) : commitLog && commitLog.commits.length > 0 ? (
							<ScrollArea className="flex-1 border rounded-md">
								<div className="p-3 space-y-2">
									{commitLog.commits.map((commit) => (
										<div
											key={commit.hash}
											className="p-3 rounded-md bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
										>
											<div className="flex items-start justify-between gap-3">
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 mb-1">
														<Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
														<span className="text-xs text-muted-foreground">{formatRelativeTime(commit.timestamp)}</span>
														<span className="text-xs text-muted-foreground">•</span>
														<span className="text-xs text-muted-foreground font-mono">{formatDate(commit.timestamp)}</span>
													</div>
													<p className="text-sm font-medium mb-2">{commit.message}</p>
													<div className="flex items-center gap-3 text-xs text-muted-foreground">
														<div className="flex items-center gap-1">
															<Package className="h-3 w-3" />
															<span>
																{commit.itemCount} item{commit.itemCount !== 1 ? 's' : ''}
															</span>
														</div>
														<div className="flex items-center gap-1">
															<Package className="h-3 w-3" />
															<span>
																{commit.spriteCount} sprite{commit.spriteCount !== 1 ? 's' : ''}
															</span>
														</div>
													</div>
												</div>
												<div className="flex flex-col items-end gap-1 flex-shrink-0">
													<code className="text-xs bg-background px-2 py-0.5 rounded border font-mono">
														{commit.hash.substring(0, 8)}
													</code>
													<Button
														size="sm"
														variant="outline"
														className="h-7 text-xs"
														disabled={restoringHash !== null}
														onClick={() => handleRestore(commit.hash)}
													>
														<RotateCcw className="h-3 w-3 mr-1" />
														{restoringHash === commit.hash ? 'Restoring...' : 'Restore'}
													</Button>
												</div>
											</div>
										</div>
									))}
								</div>
							</ScrollArea>
						) : (
							<div className="flex items-center justify-center h-32 text-sm text-muted-foreground border rounded-md">
								No commits yet. Make changes and compile to create your first version.
							</div>
						)}
					</div>

					{/* Cleanup Section */}
					<div className="border-t pt-4">
						<h3 className="text-sm font-medium mb-3">Version Cleanup</h3>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label className="text-xs" htmlFor="cleanup-days">
									Delete versions older than (days)
								</Label>
								<div className="flex gap-2">
									<Input
										min="1"
										type="number"
										id="cleanup-days"
										value={cleanupDays}
										className="h-8 text-sm"
										onChange={(e) => setCleanupDays(e.target.value)}
									/>
									<Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleCleanupByDays}>
										<Trash2 className="h-3 w-3 mr-1" />
										Clean
									</Button>
								</div>
							</div>
							<div className="space-y-2">
								<Label className="text-xs" htmlFor="cleanup-count">
									Keep only last N versions
								</Label>
								<div className="flex gap-2">
									<Input
										min="1"
										type="number"
										id="cleanup-count"
										value={cleanupCount}
										className="h-8 text-sm"
										onChange={(e) => setCleanupCount(e.target.value)}
									/>
									<Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleCleanupByCount}>
										<Trash2 className="h-3 w-3 mr-1" />
										Clean
									</Button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
