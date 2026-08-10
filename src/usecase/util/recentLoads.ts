import { invoke } from '@tauri-apps/api/core';

import { getActiveProject } from '~/usecase/util/projects';

export interface RecentLoad {
	label: string;
	formatId: string;
	datPath?: string;
	sprPath?: string;
	otbPath?: string;
	xmlPath?: string;
	extended: boolean;
	folderPath: string;
	primaryPath: string;
	itemdbPath?: string;
	frameGroups: boolean;
	transparency: boolean;
	improvedAnimations: boolean;
}

const KEY = 'recentLoads';
const LOCAL_KEY = 'sprite-forge-recent-loads';
const MAX = 8;

async function hasProject(): Promise<boolean> {
	return (await getActiveProject()) !== null;
}

function readLocal(): RecentLoad[] {
	try {
		if (typeof window === 'undefined') return [];
		const raw = localStorage.getItem(LOCAL_KEY);
		return raw ? (JSON.parse(raw) as RecentLoad[]) : [];
	} catch {
		return [];
	}
}

export async function getRecentLoads(): Promise<RecentLoad[]> {
	try {
		const stored = (await hasProject()) ? await invoke<null | RecentLoad[]>('project_state_get', { key: KEY }) : readLocal();
		if (!stored) return [];
		return stored.map((e) => ({
			...e,
			formatId: e.formatId ?? 'tibia',
			primaryPath: e.primaryPath ?? e.datPath ?? ''
		}));
	} catch {
		return [];
	}
}

async function store(entries: RecentLoad[]): Promise<RecentLoad[]> {
	try {
		if (await hasProject()) {
			await invoke('project_state_set', { key: KEY, value: entries });
		} else if (typeof window !== 'undefined') {
			localStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
		}
	} catch {
		void 0;
	}
	return entries;
}

export async function addRecentLoad(entry: RecentLoad): Promise<RecentLoad[]> {
	const current = await getRecentLoads();
	return store([entry, ...current.filter((e) => e.primaryPath !== entry.primaryPath)].slice(0, MAX));
}

export async function clearRecentLoads(): Promise<RecentLoad[]> {
	return store([]);
}
