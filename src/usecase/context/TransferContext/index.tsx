import type { ImportPreset, TransferContextValue } from './types';

import React from 'react';
import { ExportDialog } from '@/components/ExportDialog';
import { ImportDialog } from '@/components/ImportDialog';

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
		const onDrop = async (e: DragEvent) => {
			const files = Array.from(e.dataTransfer?.files ?? []);
			const sfp = files.find((f) => /\.sfp$/i.test(f.name));
			const obds = files.filter((f) => /\.obd$/i.test(f.name));
			if (!sfp && obds.length === 0) return;
			e.preventDefault();
			e.stopPropagation();
			const toBytes = async (f: File) => new Uint8Array(await f.arrayBuffer());
			if (sfp) openImport({ source: 'sfp', files: [await toBytes(sfp)] });
			else openImport({ source: 'obd', files: await Promise.all(obds.map(toBytes)) });
		};
		window.addEventListener('drop', onDrop);
		return () => window.removeEventListener('drop', onDrop);
	}, [openImport]);

	const value = React.useMemo(
		() => ({ exportIds, importOpen, openImport, openExport, closeImport, closeExport, importPreset }),
		[importOpen, exportIds, importPreset, openImport, openExport, closeImport, closeExport]
	);

	return (
		<TransferContext.Provider value={value}>
			{children}
			<ExportDialog />
			<ImportDialog />
		</TransferContext.Provider>
	);
};

export const useTransfer = () => {
	const ctx = React.useContext(TransferContext);
	if (!ctx) throw new Error('useTransfer must be used within a TransferProvider');
	return ctx;
};
