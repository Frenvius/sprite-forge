import type { Sprite, AssetData, ThingType, FormatConfig, ThingCategory } from './tibia/types';

type ModifiedItemMap = Map<string, { id: number; data: ThingType; category: ThingCategory }>;

export interface OptimizeResult {
	oldTotal: number;
	newTotal: number;
	tempPath: string;
	removedCount: number;
}

export type SpriteLoader = (data: AssetData, ids: number[]) => Promise<void>;
export type SpriteOptimizer = (
	data: AssetData,
	onProgress?: (m: string, c: number, t: number) => void
) => Promise<OptimizeResult>;

export interface LoadRequest {
	datPath?: string;
	sprPath?: string;
	otbPath?: string;
	xmlPath?: string;
	filePath?: string;
	folderPath: string;
	extended?: boolean;
	itemdbPath?: string;
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
	confirmXmlRewrite?: () => Promise<boolean>;
	onProgress: (stage: string, current: number, total: number) => void;
}

export type CompileResult = null | { synced: number; created: number };

export interface FormatHandler {
	id: string;
	exts: string[];
	config: FormatConfig;
	alphaChannel?: boolean;
	kind: 'file' | 'folder';
	loadDialogTitle?: string;
	loadSprites?: SpriteLoader;
	optimize?: SpriteOptimizer;
	loadSpritesLz4?: SpriteLoader;
	companion?: { ext: string; label: string };
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
