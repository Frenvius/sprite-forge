import { invoke } from '@tauri-apps/api/core';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import './index.css';
import { registerLuaFormats } from './lib/formats/lua';
import { registerFormat } from './lib/formats/registry';
import { isLuaEnabled } from './usecase/util/luaSettings';
import { tibiaHandler } from './lib/formats/tibia/handler';

if (typeof window !== 'undefined') {
	document.addEventListener('contextmenu', (e) => {
		e.preventDefault();
	});

	window.addEventListener('dragover', (e) => {
		e.preventDefault();
	});
	window.addEventListener('drop', (e) => {
		if (!(e.target as null | HTMLElement)?.closest('[data-file-drop="true"]')) {
			e.preventDefault();
		}
	});
}

async function boot() {
	const luaEnabled = isLuaEnabled();

	let clientVersions = true;
	let appName: string | undefined;

	if (luaEnabled) {
		try {
			const ui = await invoke<{ clientVersions: boolean }>('forge_ui_config');
			clientVersions = ui.clientVersions;
		} catch {
			void 0;
		}
		try {
			const app = await invoke<{ name?: string }>('forge_app_config');
			appName = app.name ?? undefined;
		} catch {
			void 0;
		}
	}

	if (clientVersions) registerFormat(tibiaHandler);
	if (luaEnabled) await registerLuaFormats();

	if (appName) {
		document.title = appName;
		try {
			const { getCurrentWindow } = await import('@tauri-apps/api/window');
			await getCurrentWindow().setTitle(appName);
		} catch {
			void 0;
		}
	}

	createRoot(document.getElementById('root')!).render(<App />);
}

void boot();
