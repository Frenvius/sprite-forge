import { useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { type useUpdater } from '@/usecase/hooks/use-updater';
import { Download, RotateCw, RefreshCw, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';

import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface UpdateIndicatorProps {
	updater: ReturnType<typeof useUpdater>;
}

const RELEASES_URL = 'https://github.com/Frenvius/sprite-forge/releases/latest';
const downloadUrlFor = (version: null | string) =>
	version ? `https://github.com/Frenvius/sprite-forge/releases/tag/v${version}` : RELEASES_URL;

const formatBytes = (bytes: number) => {
	if (!bytes) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const UpdateIndicator = ({ updater }: UpdateIndicatorProps) => {
	const { state, restart, dismiss, checkForUpdate, downloadAndInstall } = updater;
	const [open, setOpen] = useState(false);

	const { notes, error, status, version, downloaded, contentLength, currentVersion } = state;

	if (status === 'idle' || status === 'checking' || status === 'up-to-date') return null;

	const progressPct = contentLength > 0 ? Math.min(100, (downloaded / contentLength) * 100) : 0;

	const renderTrigger = () => {
		if (status === 'error') {
			return (
				<Button
					size="icon"
					variant="ghost"
					onMouseDown={(e) => e.stopPropagation()}
					title={`Update error: ${error ?? 'unknown'}`}
					className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive transition-colors text-destructive"
				>
					<AlertCircle className="h-3.5 w-3.5" />
				</Button>
			);
		}

		if (status === 'ready') {
			return (
				<Button
					size="icon"
					variant="ghost"
					title="Update ready: restart to apply"
					onMouseDown={(e) => e.stopPropagation()}
					className="h-6 w-6 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-500 transition-colors"
				>
					<CheckCircle2 className="h-3.5 w-3.5" />
				</Button>
			);
		}

		if (status === 'downloading') {
			return (
				<Button
					size="icon"
					variant="ghost"
					onMouseDown={(e) => e.stopPropagation()}
					title={`Downloading update ${Math.round(progressPct)}%`}
					className="h-6 w-6 text-primary hover:bg-primary/20 hover:text-primary transition-colors"
				>
					<RefreshCw className="h-3.5 w-3.5 animate-spin" />
				</Button>
			);
		}

		return (
			<Button
				size="icon"
				variant="ghost"
				title={`Update available: v${version}`}
				onMouseDown={(e) => e.stopPropagation()}
				className="h-6 w-6 relative text-primary hover:bg-primary/20 hover:text-primary transition-colors"
			>
				<Download className="h-3.5 w-3.5" />
				<span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
			</Button>
		);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>{renderTrigger()}</PopoverTrigger>
			<PopoverContent align="end" side="bottom" className="w-[320px] p-0 overflow-hidden">
				<div className="px-4 pt-3 pb-2 border-b border-border/50">
					<div className="flex items-center justify-between gap-2">
						<h3 className="text-sm font-semibold tracking-tight">
							{status === 'available' && 'Update available'}
							{status === 'downloading' && 'Downloading update'}
							{status === 'ready' && 'Restart required'}
							{status === 'error' && 'Update failed'}
						</h3>
						{version && (
							<span className="text-[10px] font-mono text-primary px-1.5 py-0.5 rounded bg-primary/10">v{version}</span>
						)}
					</div>
					{currentVersion && (
						<p className="text-[11px] text-muted-foreground mt-0.5">
							Current: <span className="font-mono">v{currentVersion}</span>
						</p>
					)}
				</div>

				<div className="px-4 py-3 space-y-3">
					{status === 'available' && (
						<>
							{notes && (
								<div className="max-h-32 overflow-y-auto text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
									{notes}
								</div>
							)}
							<div className="flex items-center gap-2">
								<Button size="sm" className="h-8 text-xs flex-1" onClick={() => void downloadAndInstall()}>
									<Download className="h-3.5 w-3.5 mr-1.5" />
									Download & Install
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="h-8 text-xs"
									onClick={() => {
										dismiss();
										setOpen(false);
									}}
								>
									Later
								</Button>
							</div>
						</>
					)}

					{status === 'downloading' && (
						<>
							<Progress className="h-1.5" value={progressPct} />
							<div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
								<span>
									{formatBytes(downloaded)}
									{contentLength > 0 && ` / ${formatBytes(contentLength)}`}
								</span>
								<span>{Math.round(progressPct)}%</span>
							</div>
						</>
					)}

					{status === 'ready' && (
						<>
							<p className="text-xs text-muted-foreground leading-relaxed">
								The update was installed. Restart Sprite Forge to start using the new version.
							</p>
							<div className="flex items-center gap-2">
								<Button size="sm" className="h-8 text-xs flex-1" onClick={() => void restart()}>
									<RotateCw className="h-3.5 w-3.5 mr-1.5" />
									Restart now
								</Button>
								<Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setOpen(false)}>
									Later
								</Button>
							</div>
						</>
					)}

					{status === 'error' && (
						<>
							<p className="text-xs text-destructive leading-relaxed break-words">{error ?? 'Could not check for updates.'}</p>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								Auto-update failed. Download the installer manually from the release page.
							</p>
							<Button size="sm" className="h-8 text-xs w-full" onClick={() => void openUrl(downloadUrlFor(version))}>
								<ExternalLink className="h-3.5 w-3.5 mr-1.5" />
								Download {version ? `v${version}` : 'latest'}
							</Button>
							<div className="flex items-center gap-2">
								<Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => void checkForUpdate()}>
									<RefreshCw className="h-3.5 w-3.5 mr-1.5" />
									Try again
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="h-8 text-xs"
									onClick={() => {
										dismiss();
										setOpen(false);
									}}
								>
									Dismiss
								</Button>
							</div>
						</>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
};
