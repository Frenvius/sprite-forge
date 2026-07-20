const KEY = 'lua:scriptsEnabled';

export const isLuaEnabled = (): boolean => {
	try {
		const v = localStorage.getItem(KEY);
		return v === null ? true : v === '1';
	} catch {
		return true;
	}
};

export const setLuaEnabled = (enabled: boolean): void => {
	try {
		localStorage.setItem(KEY, enabled ? '1' : '0');
	} catch {
		void 0;
	}
};
