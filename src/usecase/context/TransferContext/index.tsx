import type { ImportPreset, TransferContextValue } from './types';

import React from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

const TransferContext = React.createContext<null | TransferContextValue>(null);

export const TransferProvider = ({ children }: { children: React.ReactNode }) => {
	const [importOpen, setImportOpen] = React.useState(false);
	const [exportIds, setExportIds] = React.useState<null | number[]>(null);
	const [importPreset, setImportPreset] = React.useState<null | ImportPreset>(null);

	const closeExport = React.useCallback(() => setExportIds(null), []);
	const closeImport = React.useCallback(() => setImportOpen(false), []);
	const openExport = React.useCallback((ids: number[]) => setExportIds(ids), []);
	const openImport = React.useCallback((preset?: ImportPreset) => {
		setImportPreset(preset ?? null);
		setImportOpen(true);
	}, []);

	React.useEffect(() => {
		let unlisten: undefined | (() => void);
		let cancelled = false;

		getCurrentWebviewWindow()
			.onDragDropEvent((event) => {
				if (event.payload.type !== 'drop') return;
				const paths = event.payload.paths;
				const sfp = paths.find((p) => /\.sfp$/i.test(p));
				const obds = paths.filter((p) => /\.obd$/i.test(p));
				if (!sfp && obds.length === 0) return;
				if (sfp) openImport({ paths: [sfp], source: 'sfp' });
				else openImport({ paths: obds, source: 'obd' });
			})
			.then((fn) => {
				if (cancelled) fn();
				else unlisten = fn;
			});

		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, [openImport]);

	const value = React.useMemo(
		() => ({
			exportIds,
			importOpen,
			openImport,
			openExport,
			closeImport,
			closeExport,
			importPreset
		}),
		[importOpen, exportIds, importPreset, openImport, openExport, closeImport, closeExport]
	);

	return <TransferContext.Provider value={value}>{children}</TransferContext.Provider>;
};

export const useTransfer = () => {
	const ctx = React.useContext(TransferContext);
	if (!ctx) throw new Error('useTransfer must be used within a TransferProvider');
	return ctx;
};
