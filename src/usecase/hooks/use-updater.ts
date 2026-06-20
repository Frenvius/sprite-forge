import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { useRef, useState, useEffect, useCallback } from 'react';

export type UpdaterStatus = 'idle' | 'ready' | 'error' | 'checking' | 'available' | 'up-to-date' | 'downloading';

export interface UpdaterState {
	downloaded: number;
	date: null | string;
	notes: null | string;
	error: null | string;
	status: UpdaterStatus;
	contentLength: number;
	version: null | string;
	currentVersion: null | string;
}

const INITIAL_STATE: UpdaterState = {
	date: null,
	notes: null,
	error: null,
	version: null,
	downloaded: 0,
	status: 'idle',
	contentLength: 0,
	currentVersion: null
};

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const PREVIEW_STATUSES: UpdaterStatus[] = ['available', 'downloading', 'ready', 'error'];

const readPreviewStatus = (): null | UpdaterStatus => {
	if (typeof window === 'undefined') return null;
	const params = new URLSearchParams(window.location.search);
	const fromUrl = params.get('updateUi');
	const fromStorage = window.localStorage?.getItem('updateUi');
	const value = (fromUrl ?? fromStorage)?.toLowerCase();
	return value && (PREVIEW_STATUSES as string[]).includes(value) ? (value as UpdaterStatus) : null;
};

const PREVIEW_NOTES = `What's new in this preview build

- Added a header indicator that shows when an update is available
- Background auto-check 3s after launch
- Progress bar with byte counter during download
- One-click restart after install

Bug fixes
- Updater no longer panics on slow networks
- Manifest signature is verified before install`;

const buildPreviewState = (status: UpdaterStatus): UpdaterState => ({
	status,
	version: '99.9.9',
	notes: PREVIEW_NOTES,
	currentVersion: '0.1.2',
	date: new Date().toISOString(),
	contentLength: status === 'downloading' || status === 'ready' ? 5_300_000 : 0,
	downloaded: status === 'downloading' ? 2_400_000 : status === 'ready' ? 5_300_000 : 0,
	error: status === 'error' ? 'Preview error: failed to fetch update manifest (network unreachable).' : null
});

export const useUpdater = (options?: { autoCheck?: boolean; autoCheckDelayMs?: number }) => {
	const autoCheck = options?.autoCheck ?? true;
	const autoCheckDelayMs = options?.autoCheckDelayMs ?? 3000;

	const previewStatus = readPreviewStatus();
	const [state, setState] = useState<UpdaterState>(previewStatus ? buildPreviewState(previewStatus) : INITIAL_STATE);
	const updateRef = useRef<null | Update>(null);
	const checkingRef = useRef(false);
	const previewRef = useRef(previewStatus);

	const checkForUpdate = useCallback(async (): Promise<UpdaterStatus> => {
		if (previewRef.current) {
			setState(buildPreviewState(previewRef.current));
			return previewRef.current;
		}
		if (!isTauri() || checkingRef.current) return 'checking';
		checkingRef.current = true;

		setState((prev) => ({ ...prev, error: null, status: 'checking' }));

		try {
			const result = await check();
			if (!result) {
				setState((prev) => ({ ...prev, status: 'up-to-date' }));
				updateRef.current = null;
				return 'up-to-date';
			}

			updateRef.current = result;
			setState((prev) => ({
				...prev,
				status: 'available',
				version: result.version,
				date: result.date ?? null,
				notes: result.body ?? null,
				currentVersion: result.currentVersion
			}));
			return 'available';
		} catch (err) {
			setState((prev) => ({
				...prev,
				status: 'error',
				error: err instanceof Error ? err.message : String(err)
			}));
			return 'error';
		} finally {
			checkingRef.current = false;
		}
	}, []);

	const downloadAndInstall = useCallback(async () => {
		if (previewRef.current) {
			const total = 5_300_000;
			setState((prev) => ({ ...prev, error: null, downloaded: 0, contentLength: total, status: 'downloading' }));
			let downloaded = 0;
			const tick = window.setInterval(() => {
				downloaded += Math.round(total / 30);
				if (downloaded >= total) {
					window.clearInterval(tick);
					setState((prev) => ({ ...prev, status: 'ready', downloaded: total }));
				} else {
					setState((prev) => ({ ...prev, downloaded }));
				}
			}, 120);
			return;
		}

		const update = updateRef.current;
		if (!update) return;

		setState((prev) => ({ ...prev, error: null, downloaded: 0, contentLength: 0, status: 'downloading' }));

		try {
			let downloaded = 0;
			let contentLength = 0;

			await update.downloadAndInstall((event) => {
				switch (event.event) {
					case 'Started':
						contentLength = event.data.contentLength ?? 0;
						setState((prev) => ({ ...prev, contentLength, downloaded: 0 }));
						break;
					case 'Progress':
						downloaded += event.data.chunkLength;
						setState((prev) => ({ ...prev, downloaded }));
						break;
					case 'Finished':
						setState((prev) => ({ ...prev, status: 'ready' }));
						break;
				}
			});
		} catch (err) {
			setState((prev) => ({
				...prev,
				status: 'error',
				error: err instanceof Error ? err.message : String(err)
			}));
		}
	}, []);

	const restart = useCallback(async () => {
		if (previewRef.current) {
			window.alert('[preview] would restart the app now');
			return;
		}
		try {
			await relaunch();
		} catch (err) {
			setState((prev) => ({
				...prev,
				status: 'error',
				error: err instanceof Error ? err.message : String(err)
			}));
		}
	}, []);

	const dismiss = useCallback(() => {
		if (previewRef.current) return;
		setState(INITIAL_STATE);
		updateRef.current = null;
	}, []);

	useEffect(() => {
		if (previewRef.current) return;
		if (!autoCheck || !isTauri()) return;
		const timer = window.setTimeout(() => {
			void checkForUpdate();
		}, autoCheckDelayMs);
		return () => window.clearTimeout(timer);
	}, [autoCheck, autoCheckDelayMs, checkForUpdate]);

	useEffect(() => {
		const cycle: UpdaterStatus[] = ['available', 'downloading', 'ready', 'error'];
		const handler = (e: KeyboardEvent) => {
			if (!e.altKey || e.key.toLowerCase() !== 'u') return;
			e.preventDefault();
			const current = previewRef.current;
			const next = current ? cycle[(cycle.indexOf(current) + 1) % cycle.length] : cycle[0];
			previewRef.current = next;
			window.localStorage?.setItem('updateUi', next);
			setState(buildPreviewState(next));
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, []);

	return { state, restart, dismiss, checkForUpdate, downloadAndInstall };
};
