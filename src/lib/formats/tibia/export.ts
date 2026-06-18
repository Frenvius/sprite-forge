import { invoke } from '@tauri-apps/api/core';
import { logger, EventCode } from '@/lib/debug';
import { open, save } from '@tauri-apps/plugin-dialog';

import { AssetData, ThingType } from './types';

export async function exportObjectSheets(things: ThingType[], data: AssetData): Promise<number> {
	if (!things.length || !data || !data.sprPath) {
		logger.log(EventCode.ERROR, { msg: 'Cannot export object sheets: Data not loaded' });
		return 0;
	}

	try {
		const dir = await open({ directory: true, multiple: false });
		if (!dir || typeof dir !== 'string') return 0;

		let exported = 0;
		for (const thing of things) {
			const filename = `${thing.category}_${thing.id}.png`;
			const sep = dir.includes('\\') ? '\\' : '/';
			const filePath = dir.endsWith(sep) ? `${dir}${filename}` : `${dir}${sep}${filename}`;

			try {
				await invoke('export_object_sheet_rust', {
					thing,
					path: filePath,
					sprPath: data.sprPath,
					transparent: data.transparency
				});
				exported++;
			} catch (err) {
				logger.log(EventCode.ERROR, { err, msg: 'Failed to export object sheet', thing: `${thing.category}_${thing.id}` });
			}
		}

		logger.log(EventCode.CANVAS_DRAW, { dir, count: exported, msg: 'Batch export complete' });
		return exported;
	} catch (err) {
		logger.log(EventCode.ERROR, { err, msg: 'Failed to export object sheets' });
		console.error('Batch export failed:', err);
		return 0;
	}
}

export async function exportObjectSheet(thing: ThingType, data: AssetData) {
	if (!data || !data.sprPath) {
		logger.log(EventCode.ERROR, { msg: 'Cannot export object sheet: Data not loaded' });
		return;
	}

	try {
		const filePath = await save({
			defaultPath: `${thing.category}_${thing.id}.png`,
			filters: [
				{
					name: 'Image',
					extensions: ['png']
				}
			]
		});

		if (!filePath) return;

		await invoke('export_object_sheet_rust', {
			thing,
			path: filePath,
			sprPath: data.sprPath,
			transparent: data.transparency
		});

		logger.log(EventCode.CANVAS_DRAW, { path: filePath, msg: 'Export successful' });
	} catch (err) {
		logger.log(EventCode.ERROR, { err, msg: 'Failed to export object sheet' });
		console.error('Export failed:', err);
	}
}
