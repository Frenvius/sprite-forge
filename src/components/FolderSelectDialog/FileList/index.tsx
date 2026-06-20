import type { FileListProps } from './types';

import { Star, Folder, FileText } from 'lucide-react';
import { entryType, pathString, pathsEqual, formatSize, formatModified } from '@/usecase/util/fileBrowserUtils';

export const FileList = ({
	error,
	pickExt,
	entries,
	loading,
	selected,
	favorites,
	onRowClick,
	currentPath,
	activeNames,
	onRowDoubleClick,
	onToggleFavorite
}: FileListProps) => {
	return (
		<div className="fb-list">
			<div className="fb-list-header">
				<div className="fb-col fb-col-name">
					<span>Name</span>
				</div>
				<div className="fb-col fb-col-modified">Date modified</div>
				<div className="fb-col fb-col-type">Type</div>
				<div className="fb-col fb-col-size">Size</div>
			</div>
			<div className="fb-list-body">
				{error ? (
					<div className="fb-list-empty">Could not open this folder.</div>
				) : loading ? (
					<div className="fb-list-empty">Loading…</div>
				) : entries.length === 0 ? (
					<div className="fb-list-empty">This folder is empty.</div>
				) : (
					entries.map((entry) => {
						const entryPath = currentPath.length === 0 ? entry.path : pathString([...currentPath, entry.name]);
						const favorited = entry.is_dir && favorites.some((f) => pathsEqual(f.path, entryPath));
						const matchesPick = !!pickExt && !entry.is_dir && entry.name.toLowerCase().endsWith('.' + pickExt);
						const disabled = !entry.is_dir && (pickExt ? !matchesPick : true);
						const inert = !!pickExt && disabled;
						const activeAsset = !pickExt && !entry.is_dir && !!activeNames?.has(entry.name);
						return (
							<div
								key={entry.path}
								onClick={inert ? undefined : () => onRowClick(entry)}
								onDoubleClick={inert ? undefined : () => onRowDoubleClick(entry)}
								className={
									'fb-list-row' +
									(selected === entry.path ? ' fb-list-row-active' : '') +
									(disabled ? ' fb-list-row-disabled' : '') +
									(matchesPick ? ' fb-list-row-pick' : '') +
									(activeAsset ? ' fb-list-row-asset' : '')
								}
							>
								<div className="fb-col fb-col-name">
									{entry.is_dir ? (
										<Folder size={15} className="fb-row-icon fb-icon-folder" />
									) : (
										<FileText size={15} className="fb-row-icon" />
									)}
									<span className="fb-row-name">{entry.name}</span>
									{entry.is_dir && currentPath.length > 0 && (
										<button
											type="button"
											className={'fb-row-star' + (favorited ? ' fb-row-star-on' : '')}
											title={favorited ? 'Remove from favorites' : 'Add to favorites'}
											onClick={(e) => {
												e.stopPropagation();
												onToggleFavorite(entryPath);
											}}
										>
											<Star size={15} fill={favorited ? 'currentColor' : 'none'} />
										</button>
									)}
								</div>
								<div className="fb-col fb-col-modified">{formatModified(entry.modified_ms)}</div>
								<div className="fb-col fb-col-type">{entryType(entry)}</div>
								<div className="fb-col fb-col-size">{formatSize(entry.size)}</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
};
