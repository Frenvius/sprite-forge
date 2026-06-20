import { X, Loader2, ChevronDown } from 'lucide-react';
import { useFolderSelectDialog, type FolderSelectDialogProps } from '@/usecase/hooks/useFolderSelectDialog';

import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { FileList } from './FileList';
import { TibiaAssetPanel } from './TibiaAssetPanel';

export type { LoadOptions } from '@/usecase/hooks/useFolderSelectDialog';

export const FolderSelectDialog = (props: FolderSelectDialogProps) => {
	const { title = 'Select Folder' } = props;
	const c = useFolderSelectDialog(props);

	if (!c.mounted) return null;

	const canBack = c.historyIndex > 0;
	const canForward = c.historyIndex < c.historyLength - 1;

	return (
		<div onMouseDown={() => c.onOpenChange(false)} className={'fb-backdrop' + (c.closing ? ' fb-closing' : '')}>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={title}
				onMouseDown={(e) => e.stopPropagation()}
				className={'fb-dialog' + (c.closing ? ' fb-closing' : '')}
			>
				<header className="fb-titlebar">
					<span className="fb-title">{title}</span>
					<button aria-label="Close" className="fb-titlebar-close" onClick={() => c.onOpenChange(false)}>
						<X size={14} />
					</button>
				</header>

				<Toolbar
					path={c.path}
					onUp={c.goUp}
					canBack={canBack}
					drives={c.drives}
					onBack={c.goBack}
					onForward={c.goForward}
					canForward={canForward}
					onRefresh={c.onRefresh}
					canUp={c.path.length > 0}
					canFavorite={c.path.length > 0}
					isFavorited={c.isCurrentFavorited}
					onCrumb={(i) => c.navigateTo(c.path.slice(0, i))}
					onToggleFavorite={() => c.toggleFavorite(c.currentPathString)}
				/>

				<div className="fb-body">
					<Sidebar
						drives={c.drives}
						currentPath={c.path}
						favorites={c.favorites}
						systemDirs={c.systemDirs}
						onNavigate={(p) => c.navigateTo(p)}
						computerExpanded={c.computerExpanded}
						onReorderFavorites={c.reorderFavorites}
						onRemoveFavorite={(p) => c.toggleFavorite(p)}
						onToggleComputer={() => c.setComputerExpanded((v) => !v)}
					/>
					<FileList
						error={c.error}
						loading={c.loading}
						entries={c.entries}
						currentPath={c.path}
						selected={c.selected}
						favorites={c.favorites}
						onRowClick={c.onRowClick}
						onRowDoubleClick={c.onRowDoubleClick}
						onToggleFavorite={(p) => c.toggleFavorite(p)}
					/>
					{c.assetMode && c.hasTibiaFiles && (
						<TibiaAssetPanel
							info={c.assetInfo}
							extended={c.extended}
							loading={c.assetLoading}
							serverFiles={c.serverFiles}
							frameGroups={c.frameGroups}
							transparency={c.transparency}
							onExtendedChange={c.setExtended}
							onFrameGroupsChange={c.setFrameGroups}
							onTransparencyChange={c.setTransparency}
							improvedAnimations={c.improvedAnimations}
							onImprovedAnimationsChange={c.setImprovedAnimations}
						/>
					)}
				</div>

				<footer className="fb-footer">
					<label className="fb-field">
						<span className="fb-field-label">Name:</span>
						<div className="fb-field-input">
							<input
								value={c.nameInput}
								className="fb-input"
								onChange={(e) => c.setNameInput(e.target.value)}
								placeholder={c.currentPathString || 'No folder selected'}
								onKeyDown={(e) => {
									if (e.key === 'Enter') void c.confirmCurrent();
								}}
							/>
							<button type="button" aria-label="History" className="fb-input-chevron">
								<ChevronDown size={12} />
							</button>
						</div>
					</label>
					{!c.pathOnlyMode && !c.assetMode && (
						<label className="fb-transparency">
							<input type="checkbox" checked={c.transparency} onChange={(e) => c.setTransparency(e.target.checked)} />
							<span>Enable Alpha Channel</span>
						</label>
					)}
					<div className="fb-footer-buttons">
						<button type="button" className="fb-btn" onClick={() => c.onOpenChange(false)}>
							Cancel
						</button>
						{c.assetMode ? (
							<button
								type="button"
								disabled={!c.canLoad}
								className="fb-btn fb-btn-primary"
								onClick={() => void c.confirmCurrent()}
							>
								{c.assetLoading ? (
									<span className="fb-btn-loading">
										<Loader2 size={14} className="fb-spin" />
										Reading…
									</span>
								) : (
									'Load'
								)}
							</button>
						) : (
							<button
								type="button"
								disabled={!c.currentPathString}
								className="fb-btn fb-btn-primary"
								onClick={() => void c.confirmCurrent()}
							>
								Select Folder
							</button>
						)}
					</div>
				</footer>
			</div>
		</div>
	);
};
