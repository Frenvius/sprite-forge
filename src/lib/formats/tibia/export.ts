import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

import { log } from '~/lib/log';
import { AssetData, ThingType } from './types';

export async function exportObjectSheets(things: ThingType[], data: AssetData): Promise<number> {
	if (!things.length || !data || !data.sprPath) return 0;

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
				log.error(`Failed to export ${thing.category}_${thing.id}`, err);
			}
		}

		log.info(`Exported ${exported} object sheet(s) to ${dir}`);
		return exported;
	} catch (err) {
		log.error('Batch export failed', err);
		return 0;
	}
}

export async function exportObjectSheet(thing: ThingType, data: AssetData) {
	if (!data || !data.sprPath) return;

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
	} catch (err) {
		log.error('Export failed', err);
	}
}
