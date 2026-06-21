import type { ImportSource } from '@/lib/formats/tibia';

export interface ImportPreset {
	paths: string[];
	source: ImportSource;
}

export interface TransferContextValue {
	importOpen: boolean;
	obdViewerOpen: boolean;
	closeExport: () => void;
	closeImport: () => void;
	openObdViewer: () => void;
	closeObdViewer: () => void;
	exportIds: null | number[];
	importPreset: null | ImportPreset;
	openExport: (ids: number[]) => void;
	openImport: (preset?: ImportPreset) => void;
}
