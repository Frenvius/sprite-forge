import { useState } from 'react';
import { X, Loader2, ChevronDown } from 'lucide-react';
import { useFolderSelectDialog, type FolderSelectDialogProps } from '@/usecase/hooks/useFolderSelectDialog';

import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { FileList } from './FileList';
import { TibiaAssetPanel } from './TibiaAssetPanel';

export type { LoadOptions } from '@/usecase/hooks/useFolderSelectDialog';

export const FolderSelectDialog = (props: FolderSelectDialogProps) => {
	const { pickExt, title = 'Select Folder' } = props;
	const c = useFolderSelectDialog(props);
	const [otbPickerOpen, setOtbPickerOpen] = useState(false);

	if (!c.mounted) return null;

	const canBack = c.historyIndex > 0;
	const canForward = c.historyIndex < c.historyLength - 1;

	return (
		<>
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
						onNavigatePath={c.navigatePath}
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
							pickExt={pickExt}
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
								serverOtb={c.serverOtb}
								loading={c.assetLoading}
								frameGroups={c.frameGroups}
								transparency={c.transparency}
								includeServer={c.includeServer}
								onExtendedChange={c.setExtended}
								onFrameGroupsChange={c.setFrameGroups}
								onTransparencyChange={c.setTransparency}
								improvedAnimations={c.improvedAnimations}
								onBrowseOtb={() => setOtbPickerOpen(true)}
								onIncludeServerChange={c.setIncludeServer}
								onImprovedAnimationsChange={c.setImprovedAnimations}
							/>
						)}
					</div>

					<footer className="fb-footer">
						<label className="fb-field">
							<span className="fb-field-label">{c.pickFileMode ? 'File:' : 'Name:'}</span>
							<div className="fb-field-input">
								<input
									className="fb-input"
									readOnly={c.pickFileMode}
									onChange={(e) => c.setNameInput(e.target.value)}
									value={c.pickFileMode ? (c.pickedFile ?? '') : c.nameInput}
									onKeyDown={(e) => {
										if (e.key === 'Enter') void c.confirmCurrent();
									}}
									placeholder={c.pickFileMode ? `Select a .${pickExt} file` : c.currentPathString || 'No folder selected'}
								/>
								<button type="button" aria-label="History" className="fb-input-chevron">
									<ChevronDown size={12} />
								</button>
							</div>
						</label>
						{!c.pathOnlyMode && !c.assetMode && !c.pickFileMode && (
							<label className="fb-transparency">
								<input type="checkbox" checked={c.transparency} onChange={(e) => c.setTransparency(e.target.checked)} />
								<span>Enable Alpha Channel</span>
							</label>
						)}
						<div className="fb-footer-buttons">
							<button type="button" className="fb-btn" onClick={() => c.onOpenChange(false)}>
								Cancel
							</button>
							{c.pickFileMode ? (
								<button
									type="button"
									disabled={!c.pickedFile}
									className="fb-btn fb-btn-primary"
									onClick={() => void c.confirmCurrent()}
								>
									Select
								</button>
							) : c.assetMode ? (
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

			{c.assetMode && otbPickerOpen && (
				<FolderSelectDialog
					open
					pickExt="otb"
					onOpenChange={setOtbPickerOpen}
					title="Select items.otb (server item database)"
					onPickFile={(p) => {
						void c.applyPickedOtb(p);
						setOtbPickerOpen(false);
					}}
				/>
			)}
		</>
	);
};
