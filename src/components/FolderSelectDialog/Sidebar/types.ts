import type { DriveInfo, FavoriteFolder, SystemDirectory } from '~/usecase/util/fileBrowserUtils';

export interface SidebarProps {
	drives: DriveInfo[];
	currentPath: string[];
	computerExpanded: boolean;
	favorites: FavoriteFolder[];
	onToggleComputer: () => void;
	systemDirs: SystemDirectory[];
	onNavigate: (path: string[]) => void;
	onRemoveFavorite: (path: string) => void;
	onReorderFavorites: (from: number, to: number) => void;
}
