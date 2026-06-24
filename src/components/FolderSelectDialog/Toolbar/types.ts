import type { DriveInfo } from '~/usecase/util/fileBrowserUtils';

export interface ToolbarProps {
	path: string[];
	canUp: boolean;
	canBack: boolean;
	onUp: () => void;
	onBack: () => void;
	drives: DriveInfo[];
	canForward: boolean;
	isFavorited: boolean;
	canFavorite: boolean;
	onForward: () => void;
	onRefresh: () => void;
	onCrumb: (i: number) => void;
	onToggleFavorite: () => void;
	onNavigatePath: (path: string) => void;
}
