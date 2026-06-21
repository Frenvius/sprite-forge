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
	frameGroups: boolean;
	transparency: boolean;
	improvedAnimations: boolean;
}

const KEY = 'sprite-forge-recent-loads';
const MAX = 8;

export function getRecentLoads(): RecentLoad[] {
	try {
		if (typeof window === 'undefined') return [];
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as RecentLoad[];
		return parsed.map((e) => ({
			...e,
			formatId: e.formatId ?? 'tibia',
			primaryPath: e.primaryPath ?? e.datPath ?? ''
		}));
	} catch {
		return [];
	}
}

export function addRecentLoad(entry: RecentLoad): RecentLoad[] {
	const next = [entry, ...getRecentLoads().filter((e) => e.primaryPath !== entry.primaryPath)].slice(0, MAX);
	try {
		if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(next));
	} catch {
		void 0;
	}
	return next;
}

export function clearRecentLoads(): RecentLoad[] {
	try {
		if (typeof window !== 'undefined') localStorage.removeItem(KEY);
	} catch {
		void 0;
	}
	return [];
}
