import { invoke } from '@tauri-apps/api/core';

export interface ProjectInfo {
	id: string;
	name: string;
	root: string;
	manifestPath: string;
	assetsDir: null | string;
	scriptsDir: null | string;
}

export interface RecentProject {
	path: string;
	id: null | string;
	available: boolean;
	name: null | string;
}

export async function getActiveProject(): Promise<null | ProjectInfo> {
	try {
		return await invoke<null | ProjectInfo>('project_active');
	} catch {
		return null;
	}
}

export async function closeProject(): Promise<void> {
	await invoke('project_close');
}

export async function openProject(path: string): Promise<ProjectInfo> {
	return invoke<ProjectInfo>('project_open', { path });
}

export async function getRecentProjects(): Promise<RecentProject[]> {
	try {
		return await invoke<RecentProject[]>('project_recents');
	} catch {
		return [];
	}
}

export async function clearRecentProjects(): Promise<RecentProject[]> {
	try {
		await invoke('project_clear_recents');
	} catch {
		void 0;
	}
	return [];
}
