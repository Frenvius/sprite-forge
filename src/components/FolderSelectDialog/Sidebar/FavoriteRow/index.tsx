import type { FavoriteRowProps } from './types';

import { X, Folder } from 'lucide-react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

import { pathSegments } from '~/usecase/util/fileBrowserUtils';

export const FavoriteRow = ({ fav, isActive, onNavigate, onRemoveFavorite }: FavoriteRowProps) => {
	const { listeners, transform, attributes, setNodeRef, transition, isDragging } = useSortable({ id: fav.path });

	return (
		<li ref={setNodeRef} style={{ transition, transform: CSS.Transform.toString(transform) }}>
			<div
				tabIndex={0}
				role="button"
				title={fav.path}
				{...attributes}
				{...listeners}
				onClick={() => onNavigate(pathSegments(fav.path))}
				className={'fb-tree-row' + (isActive ? ' fb-tree-row-active' : '') + (isDragging ? ' fb-tree-row-dragging' : '')}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onNavigate(pathSegments(fav.path));
					}
				}}
			>
				<span className="fb-caret-spacer" />
				<Folder size={15} className="fb-tree-icon fb-icon-folder" />
				<span className="fb-tree-label">{fav.name}</span>
				<button
					type="button"
					title="Remove from favorites"
					className="fb-tree-pin-button"
					aria-label="Remove from favorites"
					onClick={(e) => {
						e.stopPropagation();
						onRemoveFavorite(fav.path);
					}}
				>
					<X size={11} />
				</button>
			</div>
		</li>
	);
};
