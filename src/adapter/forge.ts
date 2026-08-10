import { invoke } from '@tauri-apps/api/core';

export interface CbRef {
	__cb: number;
}

export interface VNode {
	type: string;
	children: (VNode | string)[];
	props: Record<string, unknown>;
}

export interface PanelRender {
	id: string;
	tree: VNode;
	dock: string;
	title: string;
}

export const forgePanels = (): Promise<PanelRender[]> => invoke('forge_panels');

export const forgeDispatch = (cbId: number, arg?: unknown): Promise<void> =>
	invoke('forge_dispatch', { cbId, args: arg === undefined ? null : JSON.stringify(arg) });

export const forgeCommand = (name: string, arg?: unknown): Promise<void> =>
	invoke('forge_command', { name, args: arg === undefined ? null : JSON.stringify(arg) });

export const isCbRef = (v: unknown): v is CbRef => typeof v === 'object' && v !== null && typeof (v as CbRef).__cb === 'number';

export interface ForgeThing {
	id: number;
	width: number;
	height: number;
	layers: number;
	frames: number;
	offsetX: number;
	offsetY: number;
	category: string;
	patternX: number;
	patternY: number;
	patternZ: number;
	isOnTop: boolean;
	elevation: number;
	exactSize: number;
	isGround: boolean;
	hasOffset: boolean;
	groundSpeed: number;
	isOnBottom: boolean;
	isUnpassable: boolean;
	hasElevation: boolean;
	spriteIndex: number[];
	isGroundBorder: boolean;
	attrs: Record<string, number | string | boolean>;
}

export const forgeLoadAssets = (path: string): Promise<number> => invoke('forge_load_assets', { path });
export const forgeLoadItemdb = (path: string): Promise<number> => invoke('forge_load_itemdb', { path });
export const forgeThings = (): Promise<ForgeThing[]> => invoke('forge_things');
export const forgeItemName = (id: number): Promise<null | string> => invoke('forge_item_name', { id });

export interface ForgeToolMeta {
	id: string;
	label: string;
	description?: string;
}

export interface ForgeToolResult {
	message?: string;
	itemsChanged: boolean;
}

export const forgeListTools = (formatId: string): Promise<ForgeToolMeta[]> => invoke('forge_list_tools', { formatId });
export const forgeRunTool = (formatId: string, toolId: string): Promise<ForgeToolResult> =>
	invoke('forge_run_tool', { toolId, formatId });

export const forgeReadSprites = async (ids: number[]): Promise<Map<number, null | Uint8Array>> => {
	const res = await invoke<ArrayBuffer>('forge_read_sprites', { ids });
	const view = new DataView(res);
	const out = new Map<number, null | Uint8Array>();
	let o = 0;
	const count = view.getUint32(o, true);
	o += 4;
	for (let i = 0; i < count; i++) {
		const id = view.getUint32(o, true);
		o += 4;
		const empty = view.getUint8(o) === 1;
		o += 1;
		o += 4;
		if (empty) {
			out.set(id, null);
		} else {
			out.set(id, new Uint8Array(res, o, 4096).slice());
			o += 4096;
		}
	}
	return out;
};
