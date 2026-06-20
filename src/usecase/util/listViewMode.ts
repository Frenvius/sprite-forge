export type ViewMode = 'grid' | 'list' | 'large' | 'grid-3' | 'grid-4' | 'large-2';

export const VIEW_MODES: ViewMode[] = ['list', 'grid', 'grid-3', 'grid-4', 'large', 'large-2'];

export const listContainerClass = (viewMode: ViewMode): string => {
	switch (viewMode) {
		case 'grid':
			return 'grid grid-cols-2 gap-1';
		case 'grid-3':
			return 'grid grid-cols-3 gap-1';
		case 'grid-4':
			return 'grid grid-cols-4 gap-1';
		case 'large':
			return 'grid grid-cols-1 gap-2';
		case 'large-2':
			return 'grid grid-cols-2 gap-2';
		default:
			return 'space-y-0.5';
	}
};
