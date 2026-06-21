import type { Sprite, AssetData, ThingType, FormatConfig, ThingCategory } from './tibia/types';

type ModifiedItemMap = Map<string, { id: number; data: ThingType; category: ThingCategory }>;

export interface LoadRequest {
	datPath?: string;
	sprPath?: string;
	otbPath?: string;
	xmlPath?: string;
	filePath?: string;
	folderPath: string;
	extended?: boolean;
	transparency: boolean;
	frameGroups?: boolean;
	improvedAnimations?: boolean;
	onProgress?: (stage: string, current: number, total: number) => void;
}

export interface LoadResult {
	data: AssetData;
	formatConfig: FormatConfig;
}

export interface CompileRequest {
	data: AssetData;
	autoSyncServer: boolean;
	modifiedItems: ModifiedItemMap;
	modifiedServerIds: Set<number>;
	originalItems: ModifiedItemMap;
	modifiedSprites: Map<number, Sprite>;
	onProgress: (stage: string, current: number, total: number) => void;
}

export type CompileResult = null | { synced: number; created: number };

export interface FormatHandler {
	id: string;
	exts: string[];
	config: FormatConfig;
	kind: 'file' | 'folder';
	load(req: LoadRequest): Promise<LoadResult>;
	compile(req: CompileRequest): Promise<CompileResult>;
}

const handlers = new Map<string, FormatHandler>();

export const registerFormat = (handler: FormatHandler): void => {
	handlers.set(handler.id, handler);
};

export const getFormat = (id: string): undefined | FormatHandler => handlers.get(id);

export const allFormats = (): FormatHandler[] => [...handlers.values()];

export const formatByConfigName = (name: string): undefined | FormatHandler => allFormats().find((h) => h.config.name === name);

export const formatExts = (): Set<string> => new Set(allFormats().flatMap((h) => h.exts));
