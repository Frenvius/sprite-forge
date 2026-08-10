import type { OptimizeResult } from '~/lib/formats/registry';

import { useState, useEffect } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
	X,
	Copy,
	Info,
	Minus,
	Boxes,
	Square,
	Search,
	Server,
	Palette,
	History,
	Grid3x3,
	Sparkles,
	Settings,
	FileCode,
	RotateCw,
	Scissors,
	RefreshCw,
	HardDrive,
	FolderOpen,
	HelpCircle,
	PackagePlus
} from 'lucide-react';

import { cn } from '~/lib/utils';
import { forgeRunTool } from '~/adapter/forge';
import { Button } from '~/components/ui/button';
import { errorToString } from '~/lib/errorMessage';
import { useToast } from '~/usecase/hooks/useToast';
import { AboutDialog } from '~/components/AboutDialog';
import { ProjectMenu } from '~/components/ProjectMenu';
import { useUpdater } from '~/usecase/hooks/useUpdater';
import { optimizeSprites } from '~/lib/formats/sprites';
import { LoadingDialog } from '~/components/LoadingDialog';
import { SettingsDialog } from '~/components/SettingsDialog';
import { SceneEditorDialog } from '~/components/SceneEditor';
import { LoadOptions } from '~/components/FolderSelectDialog';
import { useLuaPanels } from '~/usecase/lua/LuaPanelsContext';
import { UpdateIndicator } from '~/components/UpdateIndicator';
import { useTransfer } from '~/usecase/context/TransferContext';
import { LuaScriptsDialog } from '~/components/LuaScriptsDialog';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { FolderSelectDialog } from '~/components/FolderSelectDialog';
import { useWindowControls } from '~/usecase/hooks/useWindowControls';
import { useErrorDialog } from '~/usecase/context/ErrorDialogContext';
import { getFormat, formatByConfigName } from '~/lib/formats/registry';
import { ThemeSettingsDialog } from '~/components/ThemeSettingsDialog';
import { VersionHistoryDialog } from '~/components/VersionHistoryDialog';
import { usePanelSettings } from '~/usecase/context/PanelSettingsContext';
import { SpriteOptimizerDialog } from '~/components/SpriteOptimizerDialog';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { NewAssetDialog, type NewAssetOptions } from '~/components/NewAssetDialog';
import { type AssetData, type ThingType, getCategoryMap, addSpritesBatch } from '~/lib/formats/tibia';
import { addRecentLoad, getRecentLoads, type RecentLoad, clearRecentLoads } from '~/usecase/util/recentLoads';
import {
	Menubar,
	MenubarSub,
	MenubarMenu,
	MenubarItem,
	MenubarContent,
	MenubarTrigger,
	MenubarShortcut,
	MenubarSeparator,
	MenubarSubContent,
	MenubarSubTrigger,
	MenubarCheckboxItem
} from '~/components/ui/menubar';

export const Toolbar = () => {
	const {
		data,
		setData,
		setError,
		isLoading,
		setLoading,
		compileFiles,
		formatConfig,
		markDatDirty,
		setFormatConfig,
		loadingProgress,
		hasModifiedItems,
		notifyDataChanged,
		reloadServerAttributes,
		createMissingServerItems
	} = useAssetData();
	const { settings, togglePanel } = usePanelSettings();
	const { panels: luaPanels, toggle: toggleLua, isVisible: luaVisible } = useLuaPanels();
	const { showError } = useErrorDialog();
	const { openImport } = useTransfer();
	const { toast } = useToast();
	const updater = useUpdater();
	const [folderDialogOpen, setFolderDialogOpen] = useState(false);
	const [newAssetDialogOpen, setNewAssetDialogOpen] = useState(false);
	const [themeDialogOpen, setThemeDialogOpen] = useState(false);
	const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
	const [optimizerOpen, setOptimizerOpen] = useState(false);
	const [isOptimizing, setIsOptimizing] = useState(false);
	const [optimizerProgress, setOptimizerProgress] = useState({ total: 0, current: 0, message: '' });
	const [optimizerResult, setOptimizerResult] = useState<null | OptimizeResult>(null);
	const [sceneEditorOpen, setSceneEditorOpen] = useState(false);
	const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
	const [luaDialogOpen, setLuaDialogOpen] = useState(false);
	const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
	const { minimize, isMaximized, toggleMaximize } = useWindowControls();
	const [recentLoads, setRecentLoads] = useState<RecentLoad[]>([]);
	const [itemToAdd, setItemToAdd] = useState<null | ThingType>(null);
	const [isMac, setIsMac] = useState(false);

	const [originalSprPath, setOriginalSprPath] = useState<null | string>(null);

	useEffect(() => {
		setIsMac(navigator.userAgent.includes('Mac'));
		void getRecentLoads().then(setRecentLoads);

		const handleOpenScene = (e: CustomEvent<{ item: ThingType }>) => {
			setItemToAdd(e.detail.item);
			setSceneEditorOpen(true);
		};

		const handleOpenSlicerLocal = () => {
			void handleOpenSlicer();
		};

		window.addEventListener('open-scene-editor', handleOpenScene as EventListener);
		window.addEventListener('open-sprite-slicer', handleOpenSlicerLocal as EventListener);
		return () => {
			window.removeEventListener('open-scene-editor', handleOpenScene as EventListener);
			window.removeEventListener('open-sprite-slicer', handleOpenSlicerLocal as EventListener);
		};
	}, []);

	useEffect(() => {
		const unlistenQuery = listen('slicer:query-project', () => {
			void emit('slicer:project-state', !!data);
		});
		const unlistenImport = listen<{ pixels: number[][] }>('slicer:import', async (event) => {
			if (!data) {
				toast({ variant: 'destructive', title: 'No project loaded', description: 'Open a project before importing sprites.' });
				return;
			}
			const pixelsArrays = event.payload.pixels.map((arr) => new Uint8Array(arr));
			try {
				const results = await addSpritesBatch(data, pixelsArrays);
				const added = results
					.filter((r) => r.success)
					.map((r) => r.spriteId!)
					.filter((id) => id !== undefined);
				const failed = results.filter((r) => !r.success);
				notifyDataChanged(added);
				toast({
					title: `Imported ${added.length} sprite${added.length === 1 ? '' : 's'} from slicer`,
					description:
						failed.length > 0 ? `${failed.length} failed - ${failed[0].message ?? 'unknown'}` : 'Compile to save changes.'
				});
			} catch (e) {
				toast({ variant: 'destructive', description: String(e), title: 'Slicer import failed' });
			}
		});
		void emit('slicer:project-state', !!data);
		return () => {
			void unlistenQuery.then((u) => u());
			void unlistenImport.then((u) => u());
		};
	}, [data, notifyDataChanged, toast]);

	const handleOptimize = () => {
		setOptimizerOpen(true);
		setOptimizerResult(null);
		setOptimizerProgress({ total: 0, current: 0, message: 'Ready to optimize' });
	};

	const runOptimization = async () => {
		if (!data) return;

		setIsOptimizing(true);
		if (!originalSprPath) {
			setOriginalSprPath(data.sprPath);
		}

		try {
			const result = await optimizeSprites(data, (message, current, total) => {
				setOptimizerProgress({ total, message, current });
			});

			setOptimizerResult(result);

			const newData = { ...data };
			newData.sprPath = result.tempPath;
			newData.spritesCount = result.newTotal;

			setData(newData, null as any);

			toast({
				title: 'Optimization Complete',
				description: `Removed ${result.removedCount} sprites. New total: ${result.newTotal}. Click Compile to save changes.`
			});

			markDatDirty();
			notifyDataChanged();
		} catch (error) {
			toast({
				variant: 'destructive',
				title: 'Optimization Failed',
				description: error instanceof Error ? error.message : 'Unknown error'
			});
			setOptimizerOpen(false);
		} finally {
			setIsOptimizing(false);
		}
	};

	const handleFolderSelect = async (
		selectedPath: string,
		transparency: boolean,
		assetPaths?: { datPath?: string; sprPath?: string; filePath?: string; itemdbPath?: string },
		overrides?: { extended?: boolean; frameGroups?: boolean; frameDurations?: boolean },
		serverPaths?: { otbPath?: string; xmlPath?: string },
		formatId = 'tibia'
	) => {
		try {
			setLoading(true);
			setError(null);
			setOriginalSprPath(null); // Reset original path on new load

			const handler = getFormat(formatId);
			if (!handler) throw new Error(`No format handler registered for '${formatId}'`);

			const { data: loaded, formatConfig: loadedConfig } = await handler.load({
				folderPath: selectedPath,
				datPath: assetPaths?.datPath,
				sprPath: assetPaths?.sprPath,
				otbPath: serverPaths?.otbPath,
				xmlPath: serverPaths?.xmlPath,
				extended: overrides?.extended,
				filePath: assetPaths?.filePath,
				itemdbPath: assetPaths?.itemdbPath,
				frameGroups: overrides?.frameGroups,
				improvedAnimations: overrides?.frameDurations,
				transparency: handler.alphaChannel || transparency,
				onProgress: (stage, current, total) => {
					setLoading(true, { stage, total, current });
				}
			});

			setData(loaded, null as any);
			setFormatConfig(loadedConfig);

			const folderName = selectedPath.split(/[\\/]/).filter(Boolean).pop() ?? selectedPath;
			setRecentLoads(
				await addRecentLoad({
					transparency,
					formatId: handler.id,
					datPath: loaded.datPath,
					sprPath: loaded.sprPath,
					folderPath: selectedPath,
					otbPath: serverPaths?.otbPath,
					xmlPath: serverPaths?.xmlPath,
					itemdbPath: loaded.itemdbPath,
					extended: !!overrides?.extended,
					frameGroups: !!overrides?.frameGroups,
					improvedAnimations: !!overrides?.frameDurations,
					primaryPath: assetPaths?.filePath ?? loaded.datPath ?? selectedPath,
					label: `${loaded.version?.label ?? handler.config.name} · ${folderName}`
				})
			);

			const protectedPaths = ['Program Files', 'Program Files (x86)', 'Windows', 'System32', 'ProgramData'];

			const isProtectedLocation = protectedPaths.some((protectedPath) =>
				selectedPath.toLowerCase().includes(protectedPath.toLowerCase())
			);

			if (isProtectedLocation) {
				toast({
					duration: 8000,
					variant: 'default',
					title: 'Warning: Protected Location',
					description:
						'Files are in a protected folder. You may need Administrator privileges to compile changes. Consider copying files to Documents folder.'
				});
			}

			setLoading(false);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err) || 'Failed to load files';
			setError(errorMessage);
			setLoading(false);

			toast({
				variant: 'destructive',
				description: errorMessage,
				title: 'Error loading files'
			});
		}
	};

	const handleOpenFiles = () => {
		setFolderDialogOpen(true);
	};

	const handleNewAsset = (opts: NewAssetOptions) => {
		const handler = getFormat(opts.formatId);
		if (!handler) {
			toast({ variant: 'destructive', description: `Unknown format: ${opts.formatId}` });
			return;
		}
		const isTibia = opts.formatId === 'tibia';
		const emptyData: AssetData = {
			itemsCount: 0,
			outfitsCount: 0,
			effectsCount: 0,
			spritesCount: 0,
			items: new Map(),
			missilesCount: 0,
			outfits: new Map(),
			effects: new Map(),
			sprites: new Map(),
			missiles: new Map(),
			extended: opts.extended,
			frameGroups: opts.frameGroups,
			frameDurations: opts.improvedAnimations,
			transparency: handler.alphaChannel || opts.transparency,
			version: isTibia ? opts.version : { ...opts.version, value: 0, label: handler.config.name }
		};
		setData(emptyData, null as any);
		setFormatConfig(handler.config);
		setNewAssetDialogOpen(false);
		toast({
			title: 'New project created',
			description: `${handler.config.name}${isTibia ? ` ${opts.version.label}` : ''}. Compile (Ctrl+S) to choose where to save.`
		});
	};

	const handleOpenRecent = async (entry: RecentLoad) => {
		await handleFolderSelect(
			entry.folderPath,
			entry.transparency,
			{
				datPath: entry.datPath,
				sprPath: entry.sprPath,
				itemdbPath: entry.itemdbPath,
				filePath: entry.formatId === 'tibia' ? undefined : entry.primaryPath
			},
			{ extended: entry.extended, frameGroups: entry.frameGroups, frameDurations: entry.improvedAnimations },
			{ otbPath: entry.otbPath, xmlPath: entry.xmlPath },
			entry.formatId
		);
	};

	const handleLoadWithOptions = async (options: LoadOptions) => {
		setFolderDialogOpen(false);
		await handleFolderSelect(
			options.folderPath,
			options.transparency,
			{ datPath: options.datPath, sprPath: options.sprPath, filePath: options.filePath, itemdbPath: options.itemdbPath },
			{
				extended: options.extended,
				frameGroups: options.frameGroups,
				frameDurations: options.improvedAnimations
			},
			{ otbPath: options.otbPath, xmlPath: options.xmlPath },
			options.formatId
		);
	};

	const handleMinimize = async (e: React.MouseEvent) => {
		e.stopPropagation();
		await minimize();
	};

	const handleMaximize = async (e: React.MouseEvent) => {
		e.stopPropagation();
		await toggleMaximize();
	};

	const handleClose = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const appWindow = getCurrentWindow();
		await appWindow.close();
	};

	const handleCompile = async () => {
		const isFreshProject = !!data && (!data.datPath || !data.sprPath);

		if (isFreshProject) {
			const handler = formatByConfigName(formatConfig.name) ?? getFormat('tibia');
			const primaryExt = handler?.exts[0] ?? 'dat';
			const secondaryExt = handler?.id === 'tibia' ? 'spr' : null;
			const { save } = await import('@tauri-apps/plugin-dialog');
			const chosen = await save({
				title: 'Save assets as…',
				defaultPath: `${handler?.config.name ?? 'Asset'}.${primaryExt}`,
				filters: [{ extensions: [primaryExt], name: handler?.config.name ?? 'Asset' }]
			});
			if (!chosen) return;
			const base = chosen.replace(new RegExp(`\\.${primaryExt}$`, 'i'), '');
			if (secondaryExt) {
				data!.datPath = `${base}.${primaryExt}`;
				data!.sprPath = `${base}.${secondaryExt}`;
			} else {
				data!.sprPath = `${base}.${primaryExt}`;
				data!.datPath = data!.sprPath;
			}
		} else if (!hasModifiedItems() && !originalSprPath) {
			toast({
				title: 'No changes to compile',
				description: 'Make some changes to items before compiling.'
			});
			return;
		}

		try {
			if (originalSprPath && data && data.sprPath && data.sprPath !== originalSprPath) {
				const { invoke } = await import('@tauri-apps/api/core');

				await invoke('close_spr_file', { path: data.sprPath });

				await invoke('apply_optimization', {
					tempPath: data.sprPath,
					originalPath: originalSprPath
				});

				data.sprPath = originalSprPath;
				setOriginalSprPath(null);

				await invoke('open_spr_file', {
					path: data.sprPath,
					extended: data.extended
				});
			} else if (originalSprPath) {
				setOriginalSprPath(null);
			}

			const otbResult = await compileFiles();

			const otbNote = otbResult ? ` items.otb updated (${otbResult.synced} synced, ${otbResult.created} created).` : '';

			toast({
				title: 'Compile successful',
				description: `Files have been compiled and a version was created.${otbNote}`
			});
		} catch (err) {
			const errorMessage = errorToString(err);
			console.error('Compile error details:', err);

			const isPermissionError =
				errorMessage.includes('Acesso negado') ||
				errorMessage.includes('Access denied') ||
				errorMessage.includes('Permission denied') ||
				errorMessage.includes('os error 5');

			const isMemoryError =
				errorMessage.includes('out of memory') ||
				errorMessage.includes('allocation') ||
				errorMessage.includes('too large') ||
				errorMessage.includes('timeout');

			if (isPermissionError) {
				toast({
					duration: 10000,
					variant: 'destructive',
					title: 'Permission Denied',
					description:
						'Cannot write to files. Please run the application as Administrator or move the files to a writable location (e.g., Documents folder).'
				});
			} else if (isMemoryError) {
				toast({
					duration: 10000,
					variant: 'destructive',
					title: 'Compile failed',
					description:
						'File is too large or system ran out of memory. Try closing other applications or compiling fewer changes at once.'
				});
			} else {
				showError('Compile failed', err);
			}
		}
	};

	const handleOpenSlicer = async () => {
		try {
			const existingWindow = await WebviewWindow.getByLabel('slicer');
			if (existingWindow) {
				await existingWindow.show();
				await existingWindow.setFocus();
			} else {
				const newWindow = new WebviewWindow('slicer', {
					width: 1100,
					height: 720,
					center: true,
					shadow: true,
					minWidth: 800,
					minHeight: 500,
					resizable: true,
					transparent: true,
					url: 'slicer.html',
					decorations: false,
					backgroundColor: [0, 0, 0, 0],
					title: 'Slice Editor - Sprite Forge'
				});
				newWindow.once('tauri://error', () => {
					toast({ title: 'Error', variant: 'destructive', description: 'Failed to create slicer window' });
				});
			}
		} catch (error: any) {
			toast({
				title: 'Error',
				variant: 'destructive',
				description: error instanceof Error ? error.message : String(error) || 'Failed to open slicer window'
			});
		}
	};

	const handleOpenFind = async () => {
		try {
			const existingWindow = await WebviewWindow.getByLabel('find');

			if (existingWindow) {
				await existingWindow.show();
				await existingWindow.setFocus();
			} else {
				const newWindow = new WebviewWindow('find', {
					width: 900,
					height: 600,
					center: true,
					minWidth: 700,
					shadow: false,
					minHeight: 500,
					resizable: true,
					url: 'find.html',
					transparent: true,
					decorations: false,
					title: 'Find - Sprite Forge',
					backgroundColor: [0, 0, 0, 0]
				});

				newWindow.once('tauri://error', () => {
					toast({ title: 'Error', variant: 'destructive', description: 'Failed to create find window' });
				});
			}
		} catch (error: any) {
			toast({
				title: 'Error',
				variant: 'destructive',
				description: error instanceof Error ? error.message : String(error) || 'Failed to open find window'
			});
		}
	};

	const handleCreateMissing = () => {
		const { created } = createMissingServerItems();
		toast({
			description: created > 0 ? 'Compile to save items.otb.' : undefined,
			title: created > 0 ? `Created ${created} server item${created === 1 ? '' : 's'}` : 'No missing server items'
		});
	};

	const handleReloadAttributes = () => {
		const { synced } = reloadServerAttributes();
		toast({
			description: synced > 0 ? 'Compile to save items.otb.' : undefined,
			title: synced > 0 ? `Reloaded attributes for ${synced} item${synced === 1 ? '' : 's'}` : 'No server items to reload'
		});
	};

	const activeHandler = data?.formatId ? getFormat(data.formatId) : undefined;
	const formatTools = activeHandler?.tools ?? [];

	const handleRunTool = async (toolId: string, label: string) => {
		if (!data?.formatId) return;
		try {
			const res = await forgeRunTool(data.formatId, toolId);
			if (res.itemsChanged) markDatDirty();
			toast({
				title: label,
				description: res.message ?? (res.itemsChanged ? 'Compile to save changes.' : 'No changes')
			});
		} catch (e) {
			toast({
				title: label,
				variant: 'destructive',
				description: e instanceof Error ? e.message : String(e)
			});
		}
	};

	const handleCheckUpdates = async () => {
		toast({ title: 'Checking for updates...' });
		const result = await updater.checkForUpdate();
		if (result === 'up-to-date') {
			toast({
				title: "You're on the latest version",
				description: updater.state.currentVersion ? `v${updater.state.currentVersion}` : undefined
			});
		}
	};

	const stop = (e: React.MouseEvent) => e.stopPropagation();

	const renderWindowControls = () => {
		if (isMac) {
			return (
				<div className="flex items-center gap-2 mr-4 group ml-2">
					<div
						onClick={handleClose}
						onMouseDown={(e) => e.stopPropagation()}
						className="w-3 h-3 rounded-full bg-[#FF5F56] hover:bg-[#FF5F56]/80 cursor-pointer flex items-center justify-center border border-black/10 transition-colors"
					>
						<X className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
					</div>
					<div
						onClick={handleMinimize}
						onMouseDown={(e) => e.stopPropagation()}
						className="w-3 h-3 rounded-full bg-[#FFBD2E] hover:bg-[#FFBD2E]/80 cursor-pointer flex items-center justify-center border border-black/10 transition-colors"
					>
						<Minus className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
					</div>
					<div
						onClick={handleMaximize}
						onMouseDown={(e) => e.stopPropagation()}
						className="w-3 h-3 rounded-full bg-[#27C93F] hover:bg-[#27C93F]/80 cursor-pointer flex items-center justify-center border border-black/10 transition-colors"
					>
						<Square className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
					</div>
				</div>
			);
		}

		return (
			<div className="ml-2 flex items-center flex-shrink-0 -mr-3">
				<button
					type="button"
					aria-label="Minimize"
					onClick={handleMinimize}
					onMouseDown={(e) => e.stopPropagation()}
					className="h-8 w-9 inline-flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors"
				>
					<Minus strokeWidth={1.5} className="h-4 w-4" />
				</button>
				<button
					type="button"
					onClick={handleMaximize}
					onMouseDown={(e) => e.stopPropagation()}
					aria-label={isMaximized ? 'Restore' : 'Maximize'}
					className="h-8 w-9 inline-flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors"
				>
					{isMaximized ? (
						<Copy strokeWidth={1.5} className="h-3.5 w-3.5 -scale-x-100" />
					) : (
						<Square strokeWidth={1.5} className="h-3.5 w-3.5" />
					)}
				</button>
				<button
					type="button"
					aria-label="Close"
					onClick={handleClose}
					onMouseDown={(e) => e.stopPropagation()}
					className="h-8 w-9 inline-flex items-center justify-center text-foreground/70 hover:text-white hover:bg-[#e81123] transition-colors"
				>
					<X strokeWidth={1.5} className="h-4 w-4" />
				</button>
			</div>
		);
	};

	return (
		<>
			<LoadingDialog
				open={isLoading}
				stage={loadingProgress?.stage}
				total={loadingProgress?.total}
				current={loadingProgress?.current}
			/>

			<div data-tauri-drag-region className="h-8 bg-toolbar-bg border-b border-border/50 flex items-center pl-1.5 pr-3 gap-1">
				{isMac && renderWindowControls()}
				<Menubar>
					<MenubarMenu>
						<MenubarTrigger onMouseDown={stop}>File</MenubarTrigger>
						<MenubarContent onMouseDown={stop}>
							<MenubarItem disabled={isLoading} onSelect={() => setNewAssetDialogOpen(true)}>
								<Sparkles className="mr-2 h-3.5 w-3.5" />
								New…
							</MenubarItem>
							<MenubarItem disabled={isLoading} onSelect={handleOpenFiles}>
								<FolderOpen className="mr-2 h-3.5 w-3.5" />
								Open Files
								<MenubarShortcut>Ctrl+O</MenubarShortcut>
							</MenubarItem>
							<MenubarSub>
								<MenubarSubTrigger disabled={isLoading}>
									<History className="mr-2 h-3.5 w-3.5" />
									Open Recent
								</MenubarSubTrigger>
								<MenubarSubContent>
									{(() => {
										const visible = recentLoads.filter((e) => getFormat(e.formatId));
										if (visible.length === 0) return <MenubarItem disabled>No recent files</MenubarItem>;
										return (
											<>
												{visible.map((entry) => (
													<MenubarItem key={entry.datPath} title={entry.folderPath} onSelect={() => void handleOpenRecent(entry)}>
														{entry.otbPath && <Server className="mr-2 h-3.5 w-3.5 text-primary" />}
														{entry.label}
													</MenubarItem>
												))}
												<MenubarSeparator />
												<MenubarItem
													onSelect={() => {
														void clearRecentLoads().then(setRecentLoads);
													}}
												>
													Clear Recent
												</MenubarItem>
											</>
										);
									})()}
								</MenubarSubContent>
							</MenubarSub>
							<MenubarSeparator />
							<MenubarItem
								onSelect={() => void handleCompile()}
								className={cn(hasModifiedItems() && 'text-primary')}
								disabled={!data || (!hasModifiedItems() && !!data.datPath && !!data.sprPath && !originalSprPath)}
							>
								<HardDrive className="mr-2 h-3.5 w-3.5" />
								Compile
								<MenubarShortcut>Ctrl+S</MenubarShortcut>
							</MenubarItem>
							<MenubarItem disabled={!data} onSelect={() => setVersionHistoryOpen(true)}>
								<History className="mr-2 h-3.5 w-3.5" />
								Version History
							</MenubarItem>
							<MenubarSeparator />
							<ProjectMenu />
							<MenubarSeparator />
							<MenubarItem onSelect={() => setSettingsDialogOpen(true)}>
								<Settings className="mr-2 h-3.5 w-3.5" />
								Preferences...
							</MenubarItem>
							<MenubarSeparator />
							<MenubarItem onSelect={() => void getCurrentWindow().close()}>Exit</MenubarItem>
						</MenubarContent>
					</MenubarMenu>

					<MenubarMenu>
						<MenubarTrigger onMouseDown={stop}>Tools</MenubarTrigger>
						<MenubarContent onMouseDown={stop}>
							<MenubarItem onSelect={handleOptimize} disabled={!data || isLoading}>
								<Sparkles className="mr-2 h-3.5 w-3.5" />
								Optimize
							</MenubarItem>
							<MenubarItem onSelect={() => void handleOpenSlicer()}>
								<Scissors className="mr-2 h-3.5 w-3.5" />
								Slice Editor
							</MenubarItem>
							<MenubarItem disabled={!data} onSelect={() => setSceneEditorOpen(true)}>
								<Grid3x3 className="mr-2 h-3.5 w-3.5" />
								Scene Editor
							</MenubarItem>
							<MenubarItem disabled={!data} onSelect={() => void handleOpenFind()}>
								<Search className="mr-2 h-3.5 w-3.5" />
								Find
							</MenubarItem>
							<MenubarItem onSelect={() => openImport()}>
								<Boxes className="mr-2 h-3.5 w-3.5" />
								OBD Viewer
							</MenubarItem>
							<MenubarSeparator />
							<MenubarItem onSelect={() => setLuaDialogOpen(true)}>
								<FileCode className="mr-2 h-3.5 w-3.5" />
								Lua Scripts...
							</MenubarItem>
							<MenubarSeparator />
							<MenubarItem disabled={!data?.otbPath} onSelect={handleCreateMissing}>
								<PackagePlus className="mr-2 h-3.5 w-3.5" />
								Create Missing OTB Items
							</MenubarItem>
							<MenubarItem disabled={!data?.otbPath} onSelect={handleReloadAttributes}>
								<RotateCw className="mr-2 h-3.5 w-3.5" />
								Reload Item Attributes
							</MenubarItem>
							{formatTools.length > 0 && <MenubarSeparator />}
							{formatTools.map((tool) => (
								<MenubarItem key={tool.id} disabled={!data || isLoading} onSelect={() => void handleRunTool(tool.id, tool.label)}>
									<PackagePlus className="mr-2 h-3.5 w-3.5" />
									{tool.label}
								</MenubarItem>
							))}
						</MenubarContent>
					</MenubarMenu>

					<MenubarMenu>
						<MenubarTrigger onMouseDown={stop}>View</MenubarTrigger>
						<MenubarContent onMouseDown={stop}>
							<MenubarCheckboxItem
								checked={settings.showVisualization}
								onSelect={(e) => e.preventDefault()}
								onCheckedChange={() => togglePanel('showVisualization')}
							>
								Visualization Panel
							</MenubarCheckboxItem>
							<MenubarCheckboxItem
								checked={settings.showOpenedItems}
								onSelect={(e) => e.preventDefault()}
								onCheckedChange={() => togglePanel('showOpenedItems')}
							>
								Opened Objects
							</MenubarCheckboxItem>
							<MenubarCheckboxItem
								checked={settings.showExports}
								onSelect={(e) => e.preventDefault()}
								onCheckedChange={() => togglePanel('showExports')}
							>
								Exported Objects
							</MenubarCheckboxItem>
							<MenubarCheckboxItem
								checked={settings.showTimeline}
								onSelect={(e) => e.preventDefault()}
								onCheckedChange={() => togglePanel('showTimeline')}
							>
								Timeline
							</MenubarCheckboxItem>
							{luaPanels.filter((p) => p.menu).length > 0 && <MenubarSeparator />}
							{luaPanels
								.filter((p) => p.menu)
								.map((p) => (
									<MenubarCheckboxItem
										key={p.id}
										checked={luaVisible(p.id)}
										onSelect={(e) => e.preventDefault()}
										onCheckedChange={() => toggleLua(p.id)}
									>
										{p.title}
									</MenubarCheckboxItem>
								))}
							<MenubarSeparator />
							<MenubarItem onSelect={() => setThemeDialogOpen(true)}>
								<Palette className="mr-2 h-3.5 w-3.5" />
								Theme Settings...
							</MenubarItem>
						</MenubarContent>
					</MenubarMenu>

					<MenubarMenu>
						<MenubarTrigger onMouseDown={stop}>Help</MenubarTrigger>
						<MenubarContent onMouseDown={stop}>
							<MenubarItem onSelect={() => void handleCheckUpdates()}>
								<RefreshCw className="mr-2 h-3.5 w-3.5" />
								Check for Updates
							</MenubarItem>
							<MenubarSeparator />
							<MenubarItem onSelect={() => setAboutDialogOpen(true)}>
								<HelpCircle className="mr-2 h-3.5 w-3.5" />
								About Sprite Forge
							</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
				</Menubar>

				<div className="ml-auto text-[11px] text-muted-foreground flex-shrink-0 flex items-center gap-2">
					<UpdateIndicator updater={updater} />
					<span className="font-mono">{data ? `v${data.version.label} | ${data.itemsCount} items` : 'No files loaded'}</span>
					{data && (
						<Popover>
							<PopoverTrigger asChild>
								<Button
									size="icon"
									variant="ghost"
									title="Show file information"
									onMouseDown={(e) => e.stopPropagation()}
									className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors"
								>
									<Info className="h-3.5 w-3.5" />
								</Button>
							</PopoverTrigger>
							<PopoverContent align="end" side="bottom" className="w-auto min-w-[240px] p-2.5">
								<div className="space-y-0.5 text-xs">
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Version:</span>
										<span className="font-mono text-foreground text-right">{data.version.label}</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Sprite Dimension:</span>
										<span className="font-mono text-foreground text-right">32x32</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Dat:</span>
										<span className="font-mono text-foreground text-right">
											{data.version.datSignature.toString(16).toUpperCase()}
										</span>
									</div>
									{formatConfig.categories.map((cat) => (
										<div key={cat.id} className="flex justify-between items-center gap-4">
											<span className="text-muted-foreground whitespace-nowrap">{cat.label}s:</span>
											<span className="font-mono text-foreground text-right">{getCategoryMap(data, cat.id).size}</span>
										</div>
									))}
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Spr:</span>
										<span className="font-mono text-foreground text-right">
											{data.version.sprSignature.toString(16).toUpperCase()}
										</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Sprites:</span>
										<span className="font-mono text-foreground text-right">{data.spritesCount}</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Extended:</span>
										<span className="font-mono text-foreground text-right">{data.extended ? 'Yes' : 'No'}</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Transparency:</span>
										<span className="font-mono text-foreground text-right">{data.transparency ? 'Yes' : 'No'}</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Improv. Anim.:</span>
										<span className="font-mono text-foreground text-right">
											{data.version.supportsFrameDurations ? 'Yes' : 'No'}
										</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Frame Groups:</span>
										<span className="font-mono text-foreground text-right">
											{data.version.supportsFrameDurations ? 'Yes' : 'No'}
										</span>
									</div>
								</div>
							</PopoverContent>
						</Popover>
					)}
				</div>

				{!isMac && renderWindowControls()}
			</div>

			<FolderSelectDialog
				title="Open project"
				open={folderDialogOpen}
				onLoad={handleLoadWithOptions}
				onOpenChange={setFolderDialogOpen}
			/>
			<NewAssetDialog open={newAssetDialogOpen} onConfirm={handleNewAsset} onOpenChange={setNewAssetDialogOpen} />
			<ThemeSettingsDialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen} />
			<VersionHistoryDialog open={versionHistoryOpen} onOpenChange={setVersionHistoryOpen} />
			<AboutDialog open={aboutDialogOpen} onOpenChange={setAboutDialogOpen} />
			<LuaScriptsDialog open={luaDialogOpen} onOpenChange={setLuaDialogOpen} />
			<SettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
			<SpriteOptimizerDialog
				open={optimizerOpen}
				result={optimizerResult}
				isOptimizing={isOptimizing}
				onOptimize={runOptimization}
				progress={optimizerProgress}
				onOpenChange={(open) => {
					if (isOptimizing) return;
					setOptimizerOpen(open);
				}}
			/>
			<SceneEditorDialog
				itemToAdd={itemToAdd}
				open={sceneEditorOpen}
				onOpenChange={setSceneEditorOpen}
				onItemAdded={() => setItemToAdd(null)}
			/>
		</>
	);
};
