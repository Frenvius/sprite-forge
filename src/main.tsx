import { invoke } from '@tauri-apps/api/core';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import './index.css';
import { registerLuaFormats } from './lib/formats/lua';
import { isLuaEnabled } from './usecase/util/luaSettings';
import { tibiaHandler } from './lib/formats/tibia/handler';
import { allFormats, registerFormat } from './lib/formats/registry';
import { setScriptedProfiles, type ScriptedProfile } from './lib/formats/tibia/serverAttributes';
import { type CategoryDef, TIBIA_FORMAT_CONFIG, setVirtualCategoryResolver } from './lib/formats/tibia/types';

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

function isPageReload(): boolean {
	const nav = performance.getEntriesByType('navigation')[0] as undefined | PerformanceNavigationTiming;
	return nav?.type === 'reload';
}

async function boot() {
	const luaEnabled = isLuaEnabled();

	let clientVersions = true;
	let appName: string | undefined;

	if (luaEnabled && isPageReload()) {
		try {
			await invoke<number>('reload_scripts');
		} catch (err) {
			console.error('lua reload failed', err);
		}
	}

	if (luaEnabled) {
		let builtinServerProfiles = true;
		try {
			const ui = await invoke<{ clientVersions: boolean; builtinServerProfiles: boolean }>('forge_ui_config');
			clientVersions = ui.clientVersions;
			builtinServerProfiles = ui.builtinServerProfiles;
		} catch {
			void 0;
		}
		try {
			const profiles = await invoke<ScriptedProfile[]>('forge_server_profiles');
			setScriptedProfiles(profiles ?? [], !builtinServerProfiles);
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

	if (luaEnabled) {
		try {
			const labels = await invoke<Record<string, string>>('forge_category_labels');
			const patch = (cats: { id: string; label: string }[]) => {
				for (const cat of cats) {
					const override = labels[cat.id];
					if (override) cat.label = override;
				}
			};
			patch(TIBIA_FORMAT_CONFIG.categories);
			for (const h of allFormats()) patch(h.config.categories);
		} catch {
			void 0;
		}
		try {
			const virtuals =
				await invoke<Array<{ id: string; base: string; label: string; startId: number }>>('forge_virtual_categories');
			const virtualBases = new Map(virtuals.map((v) => [v.id, v.base]));
			setVirtualCategoryResolver((cat) => virtualBases.get(cat) ?? cat);
			const spliceInto = (cats: CategoryDef[]) => {
				for (const v of virtuals) {
					const baseIdx = cats.findIndex((c) => c.id === v.base);
					if (baseIdx === -1) continue;
					if (cats.some((c) => c.id === v.id)) continue;
					const baseCat = cats[baseIdx];
					cats.splice(baseIdx + 1, 0, {
						id: v.id,
						base: v.base,
						label: v.label,
						startId: v.startId,
						defaults: baseCat.defaults,
						rendering: baseCat.rendering
					});
				}
			};
			spliceInto(TIBIA_FORMAT_CONFIG.categories);
			for (const h of allFormats()) spliceInto(h.config.categories);
		} catch {
			void 0;
		}
	}

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
