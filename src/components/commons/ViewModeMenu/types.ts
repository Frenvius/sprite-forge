import type { ViewMode } from '~/usecase/util/listViewMode';

export interface ViewModeMenuProps {
	viewMode: ViewMode;
	onViewModeChange: (mode: ViewMode) => void;
}
