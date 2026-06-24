import React from 'react';
import { invoke } from '@tauri-apps/api/core';

import { VIEW_MODES, type ViewMode } from '~/usecase/util/listViewMode';

export const useListViewMode = (getCommand: string, setCommand: string) => {
	const [viewMode, setViewModeState] = React.useState<ViewMode>('list');

	React.useEffect(() => {
		invoke<null | string>(getCommand)
			.then((mode) => {
				if (mode && VIEW_MODES.includes(mode as ViewMode)) {
					setViewModeState(mode as ViewMode);
				}
			})
			.catch(() => {});
	}, [getCommand]);

	const setViewMode = React.useCallback(
		(mode: ViewMode) => {
			setViewModeState(mode);
			invoke(setCommand, { mode }).catch(() => {});
		},
		[setCommand]
	);

	return { viewMode, setViewMode };
};
