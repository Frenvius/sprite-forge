import type { ThingType, ExportFormat } from '@/lib/formats/tibia';

import React from 'react';
import { join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useTransfer } from '@/usecase/context/TransferContext';
import { useAssetData } from '@/usecase/context/AssetDataContext';
import { exportObd, exportPack, loadSpriteIdsLz4, collectReferencedSpriteIds } from '@/lib/formats/tibia';

import { useToast } from './use-toast';

const SHEET_FORMATS: ExportFormat[] = ['png', 'bmp', 'jpg'];

const LS_FORMAT = 'sprite-forge-export-format';
const LS_FOLDER = 'sprite-forge-export-folder';
const LS_TRANSPARENT = 'sprite-forge-export-transparent';

const readLS = (key: string, fallback: string): string => {
	try {
		return localStorage.getItem(key) ?? fallback;
	} catch {
		return fallback;
	}
};

const writeLS = (key: string, value: string): void => {
	try {
		localStorage.setItem(key, value);
	} catch {
		/* localStorage unavailable */
	}
};

export const useExportDialog = () => {
	const { toast } = useToast();
	const { data, getThing, selectedCategory } = useAssetData();
	const { exportIds, closeExport } = useTransfer();

	const [busy, setBusy] = React.useState(false);
	const [name, setName] = React.useState('objects');
	const [appendPath, setAppendPath] = React.useState<null | string>(null);
	const [outputFolder, setOutputFolder] = React.useState(() => readLS(LS_FOLDER, ''));
	const [transparentBg, setTransparentBg] = React.useState(() => readLS(LS_TRANSPARENT, '1') !== '0');
	const [format, setFormat] = React.useState<ExportFormat>(() => readLS(LS_FORMAT, 'png') as ExportFormat);

	const things = React.useMemo<ThingType[]>(() => {
		if (!exportIds || !data) return [];
		return exportIds.map((id) => getThing(id, selectedCategory)).filter((t): t is ThingType => !!t);
	}, [exportIds, data, getThing, selectedCategory]);

	const open_ = exportIds !== null;
	const isSheet = SHEET_FORMATS.includes(format);
	const multi = things.length > 1;
	const isAppend = format === 'sfp' && !!appendPath;
	const canConfirm = things.length > 0 && (isAppend || outputFolder.length > 0);

	React.useEffect(() => {
		if (!open_) return;
		setAppendPath(null);
		const first = things[0];
		setName(first ? (things.length === 1 ? `${first.category}_${first.id}` : `${first.category}_pack`) : 'objects');
	}, [open_]);

	React.useEffect(() => writeLS(LS_FORMAT, format), [format]);
	React.useEffect(() => writeLS(LS_FOLDER, outputFolder), [outputFolder]);
	React.useEffect(() => writeLS(LS_TRANSPARENT, transparentBg ? '1' : '0'), [transparentBg]);

	const pickFolder = React.useCallback(async () => {
		const picked = await open({ directory: true, multiple: false });
		if (typeof picked === 'string') setOutputFolder(picked);
	}, []);

	const pickAppend = React.useCallback(async () => {
		const selected = await open({ multiple: false, filters: [{ extensions: ['sfp'], name: 'Sprite Forge Pack' }] });
		if (typeof selected === 'string') setAppendPath(selected);
	}, []);

	const fileName = React.useCallback(
		(thing: ThingType, ext: string) => (multi ? `${name}_${thing.id}.${ext}` : `${name}.${ext}`),
		[multi, name]
	);

	const exportSheets = React.useCallback(
		async (list: ThingType[], ext: string) => {
			if (!data?.sprPath || !outputFolder) return 0;
			let count = 0;
			for (const thing of list) {
				const path = await join(outputFolder, fileName(thing, ext));
				await invoke('export_object_sheet_rust', { path, thing, sprPath: data.sprPath, transparent: transparentBg });
				count++;
			}
			return count;
		},
		[data, outputFolder, transparentBg, fileName]
	);

	const exportObds = React.useCallback(
		async (list: ThingType[]) => {
			if (!data || !outputFolder) return 0;
			await loadSpriteIdsLz4(data.sprPath!, collectReferencedSpriteIds(list), data.transparency, data.sprites);
			let count = 0;
			for (const thing of list) {
				const path = await join(outputFolder, fileName(thing, 'obd'));
				await exportObd(thing, data, path);
				count++;
			}
			return count;
		},
		[data, outputFolder, fileName]
	);

	const exportSfp = React.useCallback(
		async (list: ThingType[]) => {
			if (!data) return 0;
			await loadSpriteIdsLz4(data.sprPath!, collectReferencedSpriteIds(list), data.transparency, data.sprites);
			const outPath = appendPath ?? (outputFolder ? await join(outputFolder, `${name}.sfp`) : null);
			if (!outPath) return 0;
			await exportPack(list, data, outPath, appendPath);
			return list.length;
		},
		[data, appendPath, outputFolder, name]
	);

	const confirm = React.useCallback(async () => {
		if (!data || !canConfirm) return;
		setBusy(true);
		try {
			let count = 0;
			if (SHEET_FORMATS.includes(format)) {
				count = await exportSheets(things, format);
			} else if (format === 'obd') {
				count = await exportObds(things);
			} else {
				count = await exportSfp(things);
			}
			if (count > 0) {
				toast({ description: `Exported ${count} object${count > 1 ? 's' : ''} as ${format.toUpperCase()}` });
				closeExport();
			}
		} catch (err) {
			const message = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);
			toast({ variant: 'destructive', description: `Export failed: ${message}` });
		} finally {
			setBusy(false);
		}
	}, [data, canConfirm, things, format, exportSheets, exportObds, exportSfp, toast, closeExport]);

	return {
		busy,
		name,
		open_,
		multi,
		things,
		format,
		isSheet,
		confirm,
		setName,
		isAppend,
		setFormat,
		appendPath,
		pickAppend,
		canConfirm,
		pickFolder,
		closeExport,
		outputFolder,
		setAppendPath,
		transparentBg,
		setTransparentBg
	};
};
