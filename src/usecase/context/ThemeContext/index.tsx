import type { Theme } from '~/lib/themes/types';

import React from 'react';
import { invoke } from '@tauri-apps/api/core';

import themesData from '~/lib/themes/themes.json';
import { defaultTheme } from '~/lib/themes/default';
import { applyTheme, exportTheme, importTheme, validateTheme } from '~/lib/themes/utils';

interface ThemeContextType {
	themes: Theme[];
	isDark: boolean;
	acrylic: boolean;
	isWindows: boolean;
	currentTheme: Theme;
	toggleDarkMode: () => void;
	setTheme: (theme: Theme) => void;
	exportCurrentTheme: () => string;
	setAcrylic: (enabled: boolean) => void;
	setThemeByName: (name: string) => void;
	importThemeFromJson: (json: string) => void;
}

const ThemeContext = React.createContext<undefined | ThemeContextType>(undefined);

const THEME_STORAGE_KEY = 'sprite-forge-theme';
const DARK_MODE_STORAGE_KEY = 'sprite-forge-dark-mode';
const ACRYLIC_STORAGE_KEY = 'sprite-forge-acrylic';

const CUSTOM_THEMES_STORAGE_KEY = 'sprite-forge-custom-themes';

const isWindows = typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows');

const hslStringToRgb = (hsl: string): [number, number, number] => {
	const parts = hsl.trim().split(/\s+/);
	const h = parseFloat(parts[0]);
	const s = parseFloat(parts[1]) / 100;
	const l = parseFloat(parts[2]) / 100;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
	};
	return [f(0), f(8), f(4)];
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
	const [currentTheme, setCurrentTheme] = React.useState<Theme>(defaultTheme);
	const [customThemes, setCustomThemes] = React.useState<Theme[]>(() => {
		try {
			const saved = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
			return saved ? JSON.parse(saved) : [];
		} catch {
			return [];
		}
	});
	const [isDark, setIsDark] = React.useState<boolean>(() => {
		const saved = localStorage.getItem(DARK_MODE_STORAGE_KEY);
		return saved ? JSON.parse(saved) : true;
	});
	const [acrylic, setAcrylicState] = React.useState<boolean>(() => {
		const saved = localStorage.getItem(ACRYLIC_STORAGE_KEY);
		return saved ? JSON.parse(saved) : false;
	});

	const themes = React.useMemo(() => [...(themesData as Theme[]), ...customThemes], [customThemes]);

	React.useEffect(() => {
		const loadTheme = () => {
			try {
				const savedThemeName = localStorage.getItem(THEME_STORAGE_KEY);
				if (savedThemeName) {
					const theme = themes.find((t) => t.name === savedThemeName);
					if (theme) {
						setCurrentTheme(theme);
					}
				}
			} catch (err) {
				console.error('Failed to load theme:', err);
			}
		};

		loadTheme();
	}, [themes]);

	React.useEffect(() => {
		applyTheme(currentTheme, isDark);
		localStorage.setItem(THEME_STORAGE_KEY, currentTheme.name);
		localStorage.setItem(DARK_MODE_STORAGE_KEY, JSON.stringify(isDark));

		const root = document.documentElement;
		if (isDark) {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}
	}, [currentTheme, isDark]);

	const setTheme = (theme: Theme) => {
		setCurrentTheme(theme);
	};

	const setThemeByName = (name: string) => {
		const theme = themes.find((t) => t.name === name);
		if (theme) {
			setCurrentTheme(theme);
		}
	};

	const toggleDarkMode = () => {
		setIsDark((prev) => !prev);
	};

	React.useEffect(() => {
		document.documentElement.classList.toggle('acrylic', acrylic && isWindows);
		if (!isWindows) return;
		const palette = currentTheme.colors[isDark ? 'dark' : 'light'];
		const [r, g, b] = hslStringToRgb(palette.background);
		void invoke('set_window_acrylic', { enabled: acrylic, color: [r, g, b, 180] }).catch((err) => {
			console.error('Failed to toggle acrylic:', err);
		});
		localStorage.setItem(ACRYLIC_STORAGE_KEY, JSON.stringify(acrylic));
	}, [acrylic, currentTheme, isDark]);

	const setAcrylic = (enabled: boolean) => {
		setAcrylicState(enabled);
	};

	const exportCurrentTheme = () => {
		return exportTheme(currentTheme);
	};

	const importThemeFromJson = (json: string) => {
		try {
			const theme = importTheme(json);
			if (validateTheme(theme)) {
				setCurrentTheme(theme);

				const existingCustom = customThemes.find((t) => t.name === theme.name);
				if (!existingCustom) {
					const builtInTheme = (themesData as Theme[]).find((t) => t.name === theme.name);
					if (!builtInTheme) {
						const updatedCustomThemes = [...customThemes, theme];
						setCustomThemes(updatedCustomThemes);
						localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(updatedCustomThemes));
					}
				}
			} else {
				throw new Error('Invalid theme format');
			}
		} catch (err) {
			console.error('Failed to import theme:', err);
			throw err;
		}
	};

	return (
		<ThemeContext.Provider
			value={{
				themes,
				isDark,
				acrylic,
				setTheme,
				isWindows,
				setAcrylic,
				currentTheme,
				setThemeByName,
				toggleDarkMode,
				exportCurrentTheme,
				importThemeFromJson
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
};

export const useTheme = () => {
	const context = React.useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within ThemeProvider');
	}
	return context;
};
