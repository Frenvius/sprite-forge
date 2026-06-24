import type { DirEntry, FavoriteFolder } from '~/usecase/util/fileBrowserUtils';

export interface FileListProps {
	loading: boolean;
	pickExt?: string;
	entries: DirEntry[];
	error: null | string;
	currentPath: string[];
	selected: null | string;
	activeNames?: Set<string>;
	favorites: FavoriteFolder[];
	onRowClick: (e: DirEntry) => void;
	onRowDoubleClick: (e: DirEntry) => void;
	onToggleFavorite: (path: string) => void;
}
