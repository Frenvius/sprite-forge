import React from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface GeneralSettings {
	defaultZoom: number;
	backupOnSave: boolean;
	listThumbScale: number;
	listAmountObjects: number;
	listAmountSprites: number;
	autoPlayAnimation: boolean;
}

interface GeneralSettingsContextType {
	settings: GeneralSettings;
	setSettings: (settings: GeneralSettings) => void;
}

const DEFAULT_SETTINGS: GeneralSettings = {
	defaultZoom: 2,
	listThumbScale: 1,
	backupOnSave: true,
	listAmountObjects: 100,
	listAmountSprites: 100,
	autoPlayAnimation: false
};

const GeneralSettingsContext = React.createContext<undefined | GeneralSettingsContextType>(undefined);

export const GeneralSettingsProvider = ({ children }: { children: React.ReactNode }) => {
	const [settings, setSettingsState] = React.useState<GeneralSettings>(DEFAULT_SETTINGS);

	React.useEffect(() => {
		invoke<{
			default_zoom: number;
			backup_on_save: boolean;
			list_thumb_scale: number;
			list_amount_objects: number;
			list_amount_sprites: number;
			auto_play_animation: boolean;
		}>('get_general_settings')
			.then((saved) => {
				setSettingsState({
					defaultZoom: saved.default_zoom ?? 2,
					backupOnSave: saved.backup_on_save ?? true,
					listThumbScale: saved.list_thumb_scale ?? 1,
					listAmountObjects: saved.list_amount_objects,
					listAmountSprites: saved.list_amount_sprites,
					autoPlayAnimation: saved.auto_play_animation
				});
			})
			.catch((err) => {
				console.error('Failed to load general settings:', err);
			});
	}, []);

	const setSettings = (next: GeneralSettings) => {
		setSettingsState(next);
		invoke('set_general_settings', {
			settings: {
				default_zoom: next.defaultZoom,
				backup_on_save: next.backupOnSave,
				list_thumb_scale: next.listThumbScale,
				list_amount_objects: next.listAmountObjects,
				list_amount_sprites: next.listAmountSprites,
				auto_play_animation: next.autoPlayAnimation
			}
		}).catch((err) => {
			console.error('Failed to save general settings:', err);
		});
	};

	return <GeneralSettingsContext.Provider value={{ settings, setSettings }}>{children}</GeneralSettingsContext.Provider>;
};

export const useGeneralSettings = () => {
	const context = React.useContext(GeneralSettingsContext);
	if (!context) {
		throw new Error('useGeneralSettings must be used within GeneralSettingsProvider');
	}
	return context;
};
