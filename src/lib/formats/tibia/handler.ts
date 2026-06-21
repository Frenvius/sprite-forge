import { join } from '@tauri-apps/api/path';

import { loadTibiaData } from './loader';
import { TIBIA_FORMAT_CONFIG } from './types';
import { registerFormat, type FormatHandler } from '../registry';

export const tibiaHandler: FormatHandler = {
	id: 'tibia',
	kind: 'folder',
	config: TIBIA_FORMAT_CONFIG,
	exts: ['dat', 'spr', 'otfi'],

	async load(req) {
		const datPath = req.datPath ?? (await join(req.folderPath, 'Tibia.dat'));
		const sprPath = req.sprPath ?? (await join(req.folderPath, 'Tibia.spr'));
		const data = await loadTibiaData(
			datPath,
			sprPath,
			undefined,
			req.transparency ? true : undefined,
			req.onProgress,
			{ extended: req.extended, frameGroups: req.frameGroups, frameDurations: req.improvedAnimations },
			{ otbPath: req.otbPath, xmlPath: req.xmlPath }
		);
		return { data, formatConfig: TIBIA_FORMAT_CONFIG };
	},

	async compile(req) {
		const { data, onProgress, modifiedItems, originalItems, autoSyncServer, modifiedSprites, modifiedServerIds } = req;
		if (!data.datPath || !data.sprPath) {
			throw new Error('No data or file paths available for compilation');
		}

		const datChanged = modifiedItems.size > 0 || modifiedSprites.size > 0;
		const hasOtb = !!data.otbPath && !!data.serverItems;
		const serverChanged = hasOtb && (modifiedServerIds.size > 0 || (autoSyncServer && datChanged));

		if (!datChanged && !serverChanged) return null;

		if (datChanged) {
			const { compileFiles } = await import('./compiler');
			await compileFiles({
				data,
				onProgress,
				modifiedItems,
				originalItems,
				datPath: data.datPath,
				sprPath: data.sprPath,
				directlyModifiedSprites: modifiedSprites
			});
		}

		let otbResult: null | { synced: number; created: number } = null;
		if (hasOtb && (datChanged || serverChanged)) {
			onProgress('Writing server items (OTB/XML)...', 1, 1);
			const { compileServerItems } = await import('./otb');
			otbResult = await compileServerItems(data, autoSyncServer, data.version.value);
		}

		return otbResult;
	}
};

registerFormat(tibiaHandler);
