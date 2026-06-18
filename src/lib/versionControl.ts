import { invoke } from '@tauri-apps/api/core';

import { ThingType, ThingCategory } from './tibia/types';

export const SCHEMA_VERSION = 2;

export interface CommitItemEntry {
	id: number;
	category: ThingCategory;
	after: null | ThingType;
	before: null | ThingType;
}

export interface CommitSpriteEntry {
	id: number;
	after: null | { transparent: boolean; compressedPixels: string };
	before: null | { transparent: boolean; compressedPixels: string };
}

export interface Commit {
	hash: string;
	message: string;
	timestamp: number;
	items: CommitItemEntry[];
	sprites: CommitSpriteEntry[];
	schema: typeof SCHEMA_VERSION;
}

export interface CommitLogEntry {
	hash: string;
	message: string;
	timestamp: number;
	itemCount: number;
	spriteCount: number;
}

export interface CommitLog {
	commits: CommitLogEntry[];
	schema: typeof SCHEMA_VERSION;
}

function generateCommitHash(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2);
	return `${timestamp}-${random}`;
}

function encodeBase64(data: Uint8Array): string {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < data.length; i += chunk) {
		const slice = data.subarray(i, Math.min(i + chunk, data.length));
		binary += String.fromCharCode.apply(null, slice as unknown as number[]);
	}
	return btoa(binary);
}

function decodeBase64(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

async function getVersionsDir(): Promise<string> {
	const configDir = await invoke<string>('get_config_dir_path');
	return `${configDir}/versions`;
}

async function getCommitsLogPath(): Promise<string> {
	const versionsDir = await getVersionsDir();
	return `${versionsDir}/commits.json`;
}

async function getSchemaMarkerPath(): Promise<string> {
	const versionsDir = await getVersionsDir();
	return `${versionsDir}/.schema`;
}

async function getCommitPath(hash: string): Promise<string> {
	const versionsDir = await getVersionsDir();
	return `${versionsDir}/${hash}.json`;
}

let schemaCheckPromise: null | Promise<void> = null;

async function ensureSchema(): Promise<void> {
	if (!schemaCheckPromise) {
		schemaCheckPromise = (async () => {
			await invoke('ensure_versions_dir');
			const markerPath = await getSchemaMarkerPath();
			let current = '';
			try {
				current = await invoke<string>('read_file_text', { path: markerPath });
			} catch {
				current = '';
			}
			if (current.trim() !== String(SCHEMA_VERSION)) {
				await invoke('clear_versions_dir');
				await invoke('ensure_versions_dir');
				await invoke('write_json_file', { path: markerPath, content: String(SCHEMA_VERSION) });
			}
		})().catch((err) => {
			schemaCheckPromise = null;
			throw err;
		});
	}
	return schemaCheckPromise;
}

interface ReadOnDiskSprite {
	id: number;
	isEmpty: boolean;
	compressedPixels: Uint8Array;
}

export async function readOnDiskSprites(
	sprPath: string,
	ids: number[],
	extended: boolean
): Promise<Map<number, ReadOnDiskSprite>> {
	const out = new Map<number, ReadOnDiskSprite>();
	if (ids.length === 0) return out;

	const resp = await invoke<ArrayBuffer>('read_sprites_compressed_raw', {
		ids,
		extended,
		path: sprPath
	});
	const view = new DataView(resp);
	let offset = 0;
	const count = view.getUint32(offset, true);
	offset += 4;
	for (let i = 0; i < count; i++) {
		const id = view.getUint32(offset, true);
		offset += 4;
		const isEmpty = view.getUint8(offset) === 1;
		offset += 1;
		const len = view.getUint32(offset, true);
		offset += 4;
		const pixels = new Uint8Array(resp, offset, len);
		offset += len;
		out.set(id, {
			id,
			isEmpty,
			compressedPixels: pixels.slice()
		});
	}
	return out;
}

function encodeSpriteEntry(
	transparent: boolean,
	compressedPixels: null | undefined | Uint8Array
): { transparent: boolean; compressedPixels: string } {
	return {
		transparent,
		compressedPixels: encodeBase64(compressedPixels ?? new Uint8Array(0))
	};
}

export interface CreateCommitInput {
	message: string;
	items: Map<string, { id: number; category: ThingCategory; after: null | ThingType; before: null | ThingType }>;
	sprites: Map<
		number,
		{
			after: null | { transparent: boolean; compressedPixels: Uint8Array };
			before: null | { transparent: boolean; compressedPixels: Uint8Array };
		}
	>;
}

export async function createCommit(input: CreateCommitInput): Promise<Commit> {
	await ensureSchema();

	const hash = generateCommitHash();
	const timestamp = Date.now();

	const items: CommitItemEntry[] = Array.from(input.items.values()).map((entry) => ({
		id: entry.id,
		category: entry.category,
		after: entry.after ? (JSON.parse(JSON.stringify(entry.after)) as ThingType) : null,
		before: entry.before ? (JSON.parse(JSON.stringify(entry.before)) as ThingType) : null
	}));

	const sprites: CommitSpriteEntry[] = Array.from(input.sprites.entries()).map(([id, entry]) => ({
		id,
		after: entry.after ? encodeSpriteEntry(entry.after.transparent, entry.after.compressedPixels) : null,
		before: entry.before ? encodeSpriteEntry(entry.before.transparent, entry.before.compressedPixels) : null
	}));

	const commit: Commit = {
		hash,
		items,
		sprites,
		timestamp,
		schema: SCHEMA_VERSION,
		message: input.message
	};

	const commitPath = await getCommitPath(hash);
	await invoke('write_json_file', {
		path: commitPath,
		content: JSON.stringify(commit)
	});

	await appendToCommitLog({
		hash,
		timestamp,
		message: input.message,
		itemCount: items.length,
		spriteCount: sprites.length
	});

	return commit;
}

async function appendToCommitLog(entry: CommitLogEntry): Promise<void> {
	const logPath = await getCommitsLogPath();
	let log: CommitLog;
	try {
		const content = await invoke<string>('read_file_text', { path: logPath });
		const parsed = JSON.parse(content) as CommitLog;
		log = parsed.schema === SCHEMA_VERSION && Array.isArray(parsed.commits) ? parsed : { commits: [], schema: SCHEMA_VERSION };
	} catch {
		log = { commits: [], schema: SCHEMA_VERSION };
	}

	log.commits.unshift(entry);

	await invoke('write_json_file', {
		path: logPath,
		content: JSON.stringify(log, null, 2)
	});
}

export async function getCommitHistory(): Promise<CommitLog> {
	await ensureSchema();
	const logPath = await getCommitsLogPath();

	let log: CommitLog;
	try {
		const content = await invoke<string>('read_file_text', { path: logPath });
		const parsed = JSON.parse(content) as CommitLog;
		log =
			parsed && parsed.schema === SCHEMA_VERSION && Array.isArray(parsed.commits)
				? parsed
				: { commits: [], schema: SCHEMA_VERSION };
	} catch {
		log = { commits: [], schema: SCHEMA_VERSION };
	}

	let onDiskHashes: string[];
	try {
		onDiskHashes = await invoke<string[]>('list_versions_dir');
	} catch (e) {
		console.error('Failed to list versions dir for reconcile:', e);
		return log;
	}

	const diskSet = new Set(onDiskHashes);
	const logSet = new Set(log.commits.map((c) => c.hash));

	const survivors = log.commits.filter((c) => diskSet.has(c.hash));
	const ghosts = log.commits.length - survivors.length;
	const orphanHashes = onDiskHashes.filter((h) => !logSet.has(h));

	const recoveredOrphans: CommitLogEntry[] = [];
	for (const hash of orphanHashes) {
		try {
			const path = await getCommitPath(hash);
			const content = await invoke<string>('read_file_text', { path });
			const parsed = JSON.parse(content) as Commit;
			if (parsed.schema !== SCHEMA_VERSION) continue;
			recoveredOrphans.push({
				hash: parsed.hash,
				message: parsed.message,
				timestamp: parsed.timestamp,
				itemCount: Array.isArray(parsed.items) ? parsed.items.length : 0,
				spriteCount: Array.isArray(parsed.sprites) ? parsed.sprites.length : 0
			});
		} catch (e) {
			console.error(`Failed to read orphan commit ${hash}:`, e);
		}
	}

	if (ghosts === 0 && recoveredOrphans.length === 0) {
		return log;
	}

	const merged = [...survivors, ...recoveredOrphans].sort((a, b) => b.timestamp - a.timestamp);
	const reconciled: CommitLog = { commits: merged, schema: SCHEMA_VERSION };

	try {
		await invoke('write_json_file', {
			path: logPath,
			content: JSON.stringify(reconciled, null, 2)
		});
		if (ghosts > 0 || recoveredOrphans.length > 0) {
			console.log(`Version log reconciled: dropped ${ghosts} ghost entries, recovered ${recoveredOrphans.length} orphan files.`);
		}
	} catch (e) {
		console.error('Failed to persist reconciled log:', e);
	}

	return reconciled;
}

export async function getCommitState(hash: string): Promise<null | Commit> {
	await ensureSchema();
	const commitPath = await getCommitPath(hash);
	try {
		const content = await invoke<string>('read_file_text', { path: commitPath });
		const parsed = JSON.parse(content) as Commit;
		if (parsed.schema !== SCHEMA_VERSION) return null;
		return parsed;
	} catch (e) {
		console.error(`Failed to load commit ${hash}:`, e);
		return null;
	}
}

export function decodeCommitSpritePayload(entry: { transparent: boolean; compressedPixels: string }): {
	transparent: boolean;
	compressedPixels: Uint8Array;
} {
	return {
		transparent: entry.transparent,
		compressedPixels: decodeBase64(entry.compressedPixels)
	};
}

export async function cleanOldVersions(options: { keepLast?: number; olderThanDays?: number }): Promise<number> {
	await ensureSchema();
	const log = await getCommitHistory();
	const commitsToDelete: string[] = [];

	const now = Date.now();
	const msPerDay = 24 * 60 * 60 * 1000;

	for (let i = 0; i < log.commits.length; i++) {
		const commit = log.commits[i];
		let shouldDelete = false;

		if (options.keepLast !== undefined && i >= options.keepLast) {
			shouldDelete = true;
		}

		if (options.olderThanDays !== undefined) {
			const age = (now - commit.timestamp) / msPerDay;
			if (age > options.olderThanDays) {
				shouldDelete = true;
			}
		}

		if (shouldDelete) {
			commitsToDelete.push(commit.hash);
		}
	}

	for (const hash of commitsToDelete) {
		const commitPath = await getCommitPath(hash);
		try {
			await invoke('delete_file', { path: commitPath });
		} catch (e) {
			console.error(`Failed to delete commit file ${hash}:`, e);
		}
	}

	if (commitsToDelete.length > 0) {
		const updatedLog: CommitLog = {
			schema: SCHEMA_VERSION,
			commits: log.commits.filter((c) => !commitsToDelete.includes(c.hash))
		};

		const logPath = await getCommitsLogPath();
		await invoke('write_json_file', {
			path: logPath,
			content: JSON.stringify(updatedLog, null, 2)
		});
	}

	return commitsToDelete.length;
}
