export interface RecentLoad {
	label: string;
	datPath: string;
	sprPath: string;
	otbPath?: string;
	xmlPath?: string;
	extended: boolean;
	folderPath: string;
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
		return raw ? (JSON.parse(raw) as RecentLoad[]) : [];
	} catch {
		return [];
	}
}

export function addRecentLoad(entry: RecentLoad): RecentLoad[] {
	const next = [entry, ...getRecentLoads().filter((e) => e.datPath !== entry.datPath)].slice(0, MAX);
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
