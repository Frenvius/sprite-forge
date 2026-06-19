import React from 'react';
import { join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import {
	readOtfiFile,
	readDatHeader,
	readSprHeader,
	type OtfiData,
	type DatHeader,
	type SprHeader,
	type ClientVersion
} from '@/lib/formats/tibia';
import {
	pathString,
	pathsEqual,
	pathSegments,
	getFolderName,
	type DirEntry,
	type DriveInfo,
	type FavoriteFolder,
	type SystemDirectory
} from '@/usecase/util/fileBrowserUtils';

export interface LoadOptions {
	otbPath?: string;
	xmlPath?: string;
	extended: boolean;
	folderPath: string;
	frameGroups: boolean;
	transparency: boolean;
	improvedAnimations: boolean;
}

export interface AssetInfo {
	error: null | string;
	otfi: null | OtfiData;
	datHeader: null | DatHeader;
	sprHeader: null | SprHeader;
	version: null | ClientVersion;
}

export interface FolderSelectDialogProps {
	open: boolean;
	title?: string;
	onOpenChange: (open: boolean) => void;
	onLoad?: (options: LoadOptions) => void;
	onFolderSelected?: (path: string) => void;
	onSelect?: (path: string, transparency: boolean) => void;
}

const EXIT_MS = 160;

export const useFolderSelectDialog = ({ open, onLoad, onSelect, onOpenChange, onFolderSelected }: FolderSelectDialogProps) => {
	const assetMode = !!onLoad;
	const pathOnlyMode = !assetMode && !!onFolderSelected && !onSelect;

	const [mounted, setMounted] = React.useState(open);
	const [drives, setDrives] = React.useState<DriveInfo[]>([]);
	const [systemDirs, setSystemDirs] = React.useState<SystemDirectory[]>([]);
	const [favorites, setFavorites] = React.useState<FavoriteFolder[]>([]);
	const [history, setHistory] = React.useState<string[][]>([[]]);
	const [historyIndex, setHistoryIndex] = React.useState(0);
	const [entries, setEntries] = React.useState<DirEntry[]>([]);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<null | string>(null);
	const [selected, setSelected] = React.useState<null | string>(null);
	const [nameInput, setNameInput] = React.useState('');
	const [refreshTick, setRefreshTick] = React.useState(0);
	const [computerExpanded, setComputerExpanded] = React.useState(true);

	const [hasTibiaFiles, setHasTibiaFiles] = React.useState(false);
	const [serverFiles, setServerFiles] = React.useState<{ otb: boolean; xml: boolean }>({ otb: false, xml: false });
	const [assetLoading, setAssetLoading] = React.useState(false);
	const [assetInfo, setAssetInfo] = React.useState<AssetInfo>({
		otfi: null,
		error: null,
		version: null,
		datHeader: null,
		sprHeader: null
	});
	const [extended, setExtended] = React.useState(false);
	const [transparency, setTransparency] = React.useState(false);
	const [improvedAnimations, setImprovedAnimations] = React.useState(false);
	const [frameGroups, setFrameGroups] = React.useState(false);

	const path = history[historyIndex];
	const currentPathString = pathString(path);
	const isCurrentFavorited = favorites.some((f) => pathsEqual(f.path, currentPathString));

	React.useEffect(() => {
		if (open) {
			setMounted(true);
			return;
		}
		if (!mounted) return;
		const t = window.setTimeout(() => setMounted(false), EXIT_MS);
		return () => window.clearTimeout(t);
	}, [open, mounted]);

	React.useEffect(() => {
		if (!mounted) return;
		let cancelled = false;

		const init = async () => {
			try {
				const [d, favs, sysDirs] = await Promise.all([
					invoke<DriveInfo[]>('list_drives').catch(() => [] as DriveInfo[]),
					invoke<FavoriteFolder[]>('get_favorite_folders').catch(() => [] as FavoriteFolder[]),
					invoke<SystemDirectory[]>('get_system_directories').catch(() => [] as SystemDirectory[])
				]);
				if (cancelled) return;
				setDrives(d);
				setFavorites(favs);
				setSystemDirs(sysDirs);

				let startPath = '';
				try {
					const last = await invoke<null | string>('get_last_folder');
					if (last) startPath = last;
				} catch {
					/* ignore */
				}
				if (!startPath) {
					try {
						startPath = await invoke<string>('get_home_dir');
					} catch {
						startPath = '';
					}
				}
				if (cancelled) return;
				if (startPath) {
					setHistory([pathSegments(startPath)]);
					setHistoryIndex(0);
				} else {
					setHistory([[]]);
					setHistoryIndex(0);
				}
			} catch (e) {
				if (!cancelled) setError(String(e));
			}
		};

		void init();
		return () => {
			cancelled = true;
		};
	}, [mounted]);

	React.useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onOpenChange(false);
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, onOpenChange]);

	React.useEffect(() => {
		if (path.length === 0) {
			setEntries(
				drives.map((d) => ({
					size: null,
					is_dir: true,
					name: d.label,
					path: d.letter,
					modified_ms: null
				}))
			);
			setLoading(false);
			setError(null);
			setHasTibiaFiles(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		const target = pathString(path);

		invoke<DirEntry[]>('list_directory', { path: target })
			.then((es) => {
				if (cancelled) return;
				setEntries(es);
				setLoading(false);
			})
			.catch((e) => {
				if (cancelled) return;
				setError(String(e));
				setEntries([]);
				setLoading(false);
			});

		invoke<boolean[]>('check_files_exist', { path: target, filenames: ['Tibia.dat', 'Tibia.spr', 'items.otb', 'items.xml'] })
			.then((res) => {
				if (cancelled) return;
				setHasTibiaFiles(res.length >= 2 && res[0] && res[1]);
				setServerFiles({ otb: res[2] ?? false, xml: res[3] ?? false });
			})
			.catch(() => {
				if (!cancelled) {
					setHasTibiaFiles(false);
					setServerFiles({ otb: false, xml: false });
				}
			});

		return () => {
			cancelled = true;
		};
	}, [path, drives, refreshTick]);

	React.useEffect(() => {
		if (!assetMode || !hasTibiaFiles || !currentPathString) {
			setAssetInfo({ otfi: null, error: null, version: null, datHeader: null, sprHeader: null });
			setAssetLoading(false);
			return;
		}

		let cancelled = false;
		setAssetLoading(true);
		setAssetInfo({ otfi: null, error: null, version: null, datHeader: null, sprHeader: null });

		(async () => {
			try {
				const datPath = await join(currentPathString, 'Tibia.dat');
				const sprPath = await join(currentPathString, 'Tibia.spr');
				const [datHeader, sprHeaderRaw, otfi] = await Promise.all([
					readDatHeader(datPath),
					readSprHeader(sprPath),
					readOtfiFile(currentPathString)
				]);
				if (cancelled) return;
				const sprHeader: SprHeader = {
					extended: sprHeaderRaw.extended,
					signature: sprHeaderRaw.signature,
					spriteCount: sprHeaderRaw.spriteCount ?? (sprHeaderRaw as any).sprite_count
				};
				const version = datHeader.version;
				setAssetInfo({ otfi, version, datHeader, sprHeader, error: null });
				if (otfi) {
					setExtended(otfi.extended);
					setTransparency(otfi.transparency);
					setImprovedAnimations(otfi.frameDurations);
					setFrameGroups(otfi.frameGroups);
				} else if (version) {
					setExtended(version.supportsExtended);
					setTransparency(version.supportsAlphaChannel);
					setImprovedAnimations(version.supportsFrameDurations);
					setFrameGroups(version.supportsFrameDurations);
				}
			} catch (err) {
				if (!cancelled) {
					setAssetInfo({
						otfi: null,
						version: null,
						datHeader: null,
						sprHeader: null,
						error: err instanceof Error ? err.message : 'Failed to read file headers'
					});
				}
			} finally {
				if (!cancelled) setAssetLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [assetMode, hasTibiaFiles, currentPathString]);

	const navigateTo = (next: string[]) => {
		const trimmed = history.slice(0, historyIndex + 1);
		trimmed.push(next);
		setHistory(trimmed);
		setHistoryIndex(trimmed.length - 1);
		setSelected(null);
		setNameInput('');
	};

	const goBack = () => {
		if (historyIndex > 0) {
			setHistoryIndex(historyIndex - 1);
			setSelected(null);
			setNameInput('');
		}
	};

	const goForward = () => {
		if (historyIndex < history.length - 1) {
			setHistoryIndex(historyIndex + 1);
			setSelected(null);
			setNameInput('');
		}
	};

	const goUp = () => {
		if (path.length > 0) navigateTo(path.slice(0, -1));
	};

	const onRowClick = (entry: DirEntry) => {
		setSelected(entry.path);
		setNameInput(entry.name);
	};

	const onRowDoubleClick = (entry: DirEntry) => {
		if (!entry.is_dir) return;
		if (path.length === 0) {
			navigateTo([entry.path]);
		} else {
			navigateTo([...path, entry.name]);
		}
	};

	const confirmCurrent = async () => {
		const target = currentPathString;
		if (!target) return;
		try {
			await invoke('set_last_folder', { path: target });
		} catch {
			/* */
		}
		if (assetMode && onLoad) {
			const otbPath = serverFiles.otb ? await join(target, 'items.otb') : undefined;
			const xmlPath = serverFiles.xml ? await join(target, 'items.xml') : undefined;
			onLoad({ otbPath, xmlPath, extended, frameGroups, transparency, improvedAnimations, folderPath: target });
		} else if (pathOnlyMode && onFolderSelected) {
			onFolderSelected(target);
		} else if (onSelect) {
			onSelect(target, transparency);
		}
		onOpenChange(false);
	};

	const canLoad = assetMode && hasTibiaFiles && !!assetInfo.datHeader && !!assetInfo.sprHeader && !assetLoading;

	const saveFavorites = async (next: FavoriteFolder[]) => {
		setFavorites(next);
		try {
			await invoke('set_favorite_folders', { folders: next });
		} catch {
			/* */
		}
	};

	const toggleFavorite = async (targetPath: string) => {
		const exists = favorites.some((f) => pathsEqual(f.path, targetPath));
		if (exists) {
			await saveFavorites(favorites.filter((f) => !pathsEqual(f.path, targetPath)));
		} else {
			await saveFavorites([...favorites, { path: targetPath, name: getFolderName(targetPath) }]);
		}
	};

	const reorderFavorites = (from: number, to: number) => {
		if (from === to) return;
		const next = [...favorites];
		const [item] = next.splice(from, 1);
		next.splice(from < to ? to - 1 : to, 0, item);
		void saveFavorites(next);
	};

	return {
		path,
		goUp,
		error,
		drives,
		goBack,
		mounted,
		loading,
		entries,
		canLoad,
		selected,
		extended,
		favorites,
		nameInput,
		assetMode,
		assetInfo,
		goForward,
		systemDirs,
		onRowClick,
		navigateTo,
		frameGroups,
		setExtended,
		serverFiles,
		assetLoading,
		pathOnlyMode,
		transparency,
		setNameInput,
		onOpenChange,
		historyIndex,
		hasTibiaFiles,
		closing: !open,
		toggleFavorite,
		setFrameGroups,
		confirmCurrent,
		setTransparency,
		computerExpanded,
		onRowDoubleClick,
		reorderFavorites,
		currentPathString,
		isCurrentFavorited,
		improvedAnimations,
		setComputerExpanded,
		setImprovedAnimations,
		historyLength: history.length,
		onRefresh: () => setRefreshTick((t) => t + 1)
	};
};
