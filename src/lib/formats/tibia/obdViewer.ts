export interface ObdRow {
	name: string;
	thumbW: number;
	thumbH: number;
	frames: number;
	isDup: boolean;
	category: number;
	sourceId: number;
	recordIndex: number;
	spriteCount: number;
}

export interface ObdQueryResult {
	total: number;
	status: number;
	rows: ObdRow[];
}

export interface ObdThumb {
	w: number;
	h: number;
	rgba: Uint8Array;
	recordIndex: number;
}

export interface ObdStats {
	done: number;
	item: number;
	total: number;
	error: string;
	status: number;
	outfit: number;
	effect: number;
	missile: number;
	elapsedMs: number;
	duplicates: number;
}

export interface ObdProgress {
	job: number;
	done: number;
	total: number;
	elapsedMs: number;
}

export const CATEGORY_NAME: Record<number, string> = { 1: 'item', 2: 'outfit', 3: 'effect', 4: 'missile' };
