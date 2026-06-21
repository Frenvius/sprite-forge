import type { SidebarProps } from './types';

import { Folder, Computer, HardDrive } from 'lucide-react';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { pathString, pathsEqual, pathSegments } from '@/usecase/util/fileBrowserUtils';
import { useSensor, DndContext, useSensors, closestCenter, PointerSensor, type DragEndEvent } from '@dnd-kit/core';

import { Caret } from './Caret';
import { FavoriteRow } from './FavoriteRow';
import { quickAccessIcons } from './constants';

export const Sidebar = ({
	drives,
	favorites,
	systemDirs,
	onNavigate,
	currentPath,
	onRemoveFavorite,
	computerExpanded,
	onToggleComputer,
	onReorderFavorites
}: SidebarProps) => {
	const currentString = pathString(currentPath);
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

	const onDragEnd = (e: DragEndEvent) => {
		const { over, active } = e;
		if (!over || active.id === over.id) return;
		const from = favorites.findIndex((f) => f.path === active.id);
		const to = favorites.findIndex((f) => f.path === over.id);
		if (from === -1 || to === -1) return;
		onReorderFavorites(from, from < to ? to + 1 : to);
	};

	return (
		<aside className="fb-sidebar">
			<ul className="fb-tree">
				<DndContext
					sensors={sensors}
					onDragEnd={onDragEnd}
					collisionDetection={closestCenter}
					modifiers={[restrictToVerticalAxis]}
					accessibility={{ container: document.body }}
				>
					<SortableContext items={favorites.map((f) => f.path)} strategy={verticalListSortingStrategy}>
						{favorites.map((fav) => (
							<FavoriteRow
								fav={fav}
								key={fav.path}
								onNavigate={onNavigate}
								onRemoveFavorite={onRemoveFavorite}
								isActive={pathsEqual(fav.path, currentString)}
							/>
						))}
					</SortableContext>
				</DndContext>

				{systemDirs.length > 0 && (
					<li className="fb-tree-section">
						<ul className="fb-tree-children">
							{systemDirs.map((dir) => {
								const isActive = pathsEqual(pathString(currentPath), dir.path);
								return (
									<li key={dir.path}>
										<button
											type="button"
											onClick={() => onNavigate(pathSegments(dir.path))}
											className={'fb-tree-row' + (isActive ? ' fb-tree-row-active' : '')}
										>
											<span className="fb-caret-spacer" />
											{quickAccessIcons[dir.name] ?? <Folder size={14} className="fb-tree-icon" />}
											<span>{dir.name}</span>
										</button>
									</li>
								);
							})}
						</ul>
					</li>
				)}

				<li className="fb-tree-section">
					<button type="button" onClick={onToggleComputer} className="fb-tree-row fb-tree-header">
						<Caret open={computerExpanded} />
						<Computer size={15} className="fb-tree-icon" />
						<span>This PC</span>
					</button>
					{computerExpanded && (
						<ul className="fb-tree-children">
							{drives.map((d) => {
								const isActive = currentPath.length === 1 && currentPath[0] === d.letter;
								return (
									<li key={d.letter}>
										<button
											type="button"
											onClick={() => onNavigate([d.letter])}
											className={'fb-tree-row' + (isActive ? ' fb-tree-row-active' : '')}
										>
											<span className="fb-caret-spacer" />
											<HardDrive size={14} className="fb-tree-icon" />
											<span>{d.label}</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</li>
			</ul>
		</aside>
	);
};
