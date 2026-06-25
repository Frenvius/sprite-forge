import React from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PanelSettings {
	showExports: boolean;
	showOpenedItems: boolean;
	showVisualization: boolean;
}

interface PanelSettingsContextType {
	settings: PanelSettings;
	setSettings: (settings: PanelSettings) => void;
	togglePanel: (panel: keyof PanelSettings) => void;
}

const EXPORTS_KEY = 'sprite-forge-show-exports';

const readShowExports = (): boolean => {
	try {
		return localStorage.getItem(EXPORTS_KEY) === '1';
	} catch {
		return false;
	}
};

const PanelSettingsContext = React.createContext<undefined | PanelSettingsContextType>(undefined);

export const PanelSettingsProvider = ({ children }: { children: React.ReactNode }) => {
	const [settings, setSettings] = React.useState<PanelSettings>(() => ({
		showOpenedItems: false,
		showVisualization: false,
		showExports: readShowExports()
	}));

	React.useEffect(() => {
		const loadSettings = async () => {
			try {
				const savedSettings = await invoke<{ show_opened_items: boolean; show_visualization: boolean }>('get_panel_settings');
				setSettings((prev) => ({
					...prev,
					showOpenedItems: savedSettings.show_opened_items,
					showVisualization: savedSettings.show_visualization
				}));
			} catch (err) {
				console.error('Failed to load panel settings:', err);
			}
		};
		loadSettings();
	}, []);

	const saveSettings = async (newSettings: PanelSettings) => {
		try {
			localStorage.setItem(EXPORTS_KEY, newSettings.showExports ? '1' : '0');
		} catch {
			void 0;
		}
		try {
			await invoke('set_panel_settings', {
				settings: {
					show_opened_items: newSettings.showOpenedItems,
					show_visualization: newSettings.showVisualization
				}
			});
		} catch (err) {
			console.error('Failed to save panel settings:', err);
		}
	};

	const updateSettings = (newSettings: PanelSettings) => {
		setSettings(newSettings);
		saveSettings(newSettings);
	};

	const togglePanel = (panel: keyof PanelSettings) => {
		const newSettings = { ...settings, [panel]: !settings[panel] };
		updateSettings(newSettings);
	};

	return (
		<PanelSettingsContext.Provider value={{ settings, togglePanel, setSettings: updateSettings }}>
			{children}
		</PanelSettingsContext.Provider>
	);
};

export const usePanelSettings = () => {
	const context = React.useContext(PanelSettingsContext);
	if (!context) {
		throw new Error('usePanelSettings must be used within PanelSettingsProvider');
	}
	return context;
};
