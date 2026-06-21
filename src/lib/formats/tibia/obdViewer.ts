import { invoke } from '@tauri-apps/api/core';

import { ByteWriter } from './compiler';

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

export const obdOpen = (paths: string[], recursive: boolean) => invoke<number>('obd_open', { paths, recursive });
export const obdStats = () => invoke<ObdStats>('obd_stats');
export const obdGetPaths = (indices: number[]) => invoke<string[]>('obd_get_paths', { indices });
export const obdClear = () => invoke('obd_clear');

const asBytes = (resp: unknown): Uint8Array => (resp instanceof Uint8Array ? resp : new Uint8Array(resp as ArrayBuffer));

export async function obdQuery(opts: {
	limit: number;
	offset: number;
	search: string;
	category: number;
	dupOnly: boolean;
}): Promise<ObdQueryResult> {
	const w = new ByteWriter(256);
	w.u8(opts.category);
	w.u8(opts.dupOnly ? 1 : 0);
	w.u32(opts.offset);
	w.u32(opts.limit);
	const enc = new TextEncoder().encode(opts.search);
	w.u16(enc.length);
	w.bytes(enc);

	const buf = asBytes(await invoke<Uint8Array>('obd_query', w.finish()));
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	const dec = new TextDecoder();
	let o = 0;

	const status = view.getUint8(o);
	o += 1;
	const total = view.getUint32(o, true);
	o += 4;
	const count = view.getUint32(o, true);
	o += 4;

	const rows: ObdRow[] = [];
	for (let i = 0; i < count; i++) {
		const recordIndex = view.getUint32(o, true);
		o += 4;
		const category = view.getUint8(o);
		o += 1;
		const sourceId = view.getUint32(o, true);
		o += 4;
		const thumbW = view.getUint16(o, true);
		o += 2;
		const thumbH = view.getUint16(o, true);
		o += 2;
		const frames = view.getUint8(o);
		o += 1;
		const spriteCount = view.getUint32(o, true);
		o += 4;
		const isDup = view.getUint8(o) !== 0;
		o += 1;
		const nameLen = view.getUint16(o, true);
		o += 2;
		const name = dec.decode(buf.subarray(o, o + nameLen));
		o += nameLen;
		rows.push({ name, isDup, thumbW, thumbH, frames, category, sourceId, recordIndex, spriteCount });
	}

	return { rows, total, status };
}

export async function obdThumbs(indices: number[]): Promise<ObdThumb[]> {
	const w = new ByteWriter(16 + indices.length * 4);
	w.u32(indices.length);
	for (const i of indices) w.u32(i);

	const buf = asBytes(await invoke<Uint8Array>('obd_thumbs', w.finish()));
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	let o = 0;
	const count = view.getUint32(o, true);
	o += 4;

	const out: ObdThumb[] = [];
	for (let k = 0; k < count; k++) {
		const recordIndex = view.getUint32(o, true);
		o += 4;
		const wd = view.getUint16(o, true);
		o += 2;
		const ht = view.getUint16(o, true);
		o += 2;
		const len = view.getUint32(o, true);
		o += 4;
		const rgba = buf.slice(o, o + len);
		o += len;
		out.push({ rgba, w: wd, h: ht, recordIndex });
	}
	return out;
}
