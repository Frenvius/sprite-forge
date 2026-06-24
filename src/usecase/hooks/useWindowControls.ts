import { useState, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const useWindowControls = () => {
	const [isMaximized, setIsMaximized] = useState(false);

	useEffect(() => {
		const appWindow = getCurrentWindow();
		let unlisten: undefined | (() => void);
		void appWindow.isMaximized().then(setIsMaximized);
		void appWindow
			.onResized(() => {
				void appWindow.isMaximized().then(setIsMaximized);
			})
			.then((fn) => {
				unlisten = fn;
			});
		return () => unlisten?.();
	}, []);

	const minimize = useCallback(async () => {
		await getCurrentWindow().minimize();
	}, []);

	const toggleMaximize = useCallback(async () => {
		await getCurrentWindow().toggleMaximize();
	}, []);

	return { minimize, isMaximized, toggleMaximize };
};
