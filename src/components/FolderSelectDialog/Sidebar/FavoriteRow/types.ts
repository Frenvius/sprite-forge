import type { FavoriteFolder } from '@/usecase/util/fileBrowserUtils';

export interface FavoriteRowProps {
	isActive: boolean;
	fav: FavoriteFolder;
	onNavigate: (path: string[]) => void;
	onRemoveFavorite: (path: string) => void;
}
