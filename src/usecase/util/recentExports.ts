export type ExportSource = 'sfp' | 'obd';

export interface RecentExport {
	at: number;
	path: string;
	name: string;
	source: ExportSource;
}

const KEY = 'sprite-forge-recent-exports';
const MAX = 12;

export const RECENT_EXPORTS_EVENT = 'sprite-forge-recent-exports';

export function getRecentExports(): RecentExport[] {
	try {
		if (typeof window === 'undefined') return [];
		const raw = localStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as RecentExport[]) : [];
	} catch {
		return [];
	}
}

export function addRecentExport(entry: RecentExport): RecentExport[] {
	const next = [entry, ...getRecentExports().filter((e) => e.path !== entry.path)].slice(0, MAX);
	try {
		if (typeof window !== 'undefined') {
			localStorage.setItem(KEY, JSON.stringify(next));
			window.dispatchEvent(new Event(RECENT_EXPORTS_EVENT));
		}
	} catch {
		void 0;
	}
	return next;
}

export function clearRecentExports(): RecentExport[] {
	try {
		if (typeof window !== 'undefined') {
			localStorage.removeItem(KEY);
			window.dispatchEvent(new Event(RECENT_EXPORTS_EVENT));
		}
	} catch {
		void 0;
	}
	return [];
}
