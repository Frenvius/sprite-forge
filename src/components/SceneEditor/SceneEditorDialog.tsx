import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Save, Star, Plus, Trash2, Search, Eraser, Pencil, Pipette, Maximize2, Minimize2 } from 'lucide-react';

import { SceneCanvas } from './SceneCanvas';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { type ThingType } from '~/lib/formats/tibia';
import { ItemPickerDialog } from './ItemPickerDialog';
import { CheckerBoard } from '~/components/CheckerBoard';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { SpriteCanvas } from '~/components/commons/SpriteCanvas';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from '~/components/ui/select';

interface SceneItem {
	id: number;
	count?: number;
}

interface SceneTile {
	items: SceneItem[];
}

interface SceneEditorDialogProps {
	open: boolean;
	onItemAdded?: () => void;
	itemToAdd?: null | ThingType;
	onOpenChange: (open: boolean) => void;
}

const DEFAULT_WIDTH = 11;
const DEFAULT_HEIGHT = 11;

export const SceneEditorDialog = ({ open, itemToAdd, onItemAdded, onOpenChange }: SceneEditorDialogProps) => {
	const { data, spriteSize } = useAssetData();
	const [width] = useState(DEFAULT_WIDTH);
	const [height] = useState(DEFAULT_HEIGHT);
	const [tiles, setTiles] = useState<SceneTile[][]>([]);
	const [selectedItemId, setSelectedItemId] = useState<number>(100);
	const [scale, setScale] = useState(1);
	const [itemPickerOpen, setItemPickerOpen] = useState(false);
	const [toolMode, setToolMode] = useState<'draw' | 'pick' | 'erase'>('draw');

	const [scenes, setScenes] = useState<string[]>([]);
	const [currentSceneName, setCurrentSceneName] = useState<null | string>(null);
	const [defaultSceneName, setDefaultSceneName] = useState<null | string>(null);
	const [loadingDefaultScene, setLoadingDefaultScene] = useState(false);

	useEffect(() => {
		if (open) {
			refreshScenes();
			loadDefaultSceneConfig();
		}
	}, [open]);

	useEffect(() => {
		if (open && tiles.length === 0 && !loadingDefaultScene) {
			if (defaultSceneName) {
				handleLoadScene(defaultSceneName);
			} else {
				loadPublicDefaultScene().catch((e) => {
					console.error('Failed to load public default scene:', e);
					initializeScene(width, height);
				});
			}
		}
	}, [open, defaultSceneName]);

	useEffect(() => {
		if (open && itemToAdd) {
			setSelectedItemId(itemToAdd.id);
			if (onItemAdded) {
				onItemAdded();
			}
		}
	}, [open, itemToAdd, onItemAdded]);

	const refreshScenes = async (): Promise<string[]> => {
		try {
			const sceneList = await invoke<string[]>('list_scenes');
			setScenes(sceneList);
			return sceneList;
		} catch (e) {
			console.error('Failed to list scenes:', e);
			return [];
		}
	};

	const loadDefaultSceneConfig = async () => {
		try {
			const config = await invoke<{ default_scene?: string }>('get_config');
			if (config.default_scene) {
				setDefaultSceneName(config.default_scene);
			}
		} catch (e) {
			console.error('Failed to get config:', e);
		}
	};

	const loadPublicDefaultScene = async () => {
		try {
			setLoadingDefaultScene(true);
			const response = await fetch('/default-scene.json');
			if (!response.ok) {
				throw new Error('Failed to fetch default scene');
			}
			const json = await response.json();
			if (json.tiles && json.width && json.height) {
				setTiles(json.tiles);
			}
		} catch (e) {
			console.error('Failed to load public default scene:', e);
		} finally {
			setLoadingDefaultScene(false);
		}
	};

	const initializeScene = (w: number, h: number) => {
		const newTiles: SceneTile[][] = [];
		for (let y = 0; y < h; y++) {
			const row: SceneTile[] = [];
			for (let x = 0; x < w; x++) {
				row.push({ items: [] });
			}
			newTiles.push(row);
		}
		setTiles(newTiles);
		setCurrentSceneName(null);
	};

	const handleTileClick = (x: number, y: number) => {
		if (!data) return;

		if (toolMode === 'pick') {
			if (y >= 0 && y < tiles.length && tiles[y] && x >= 0 && x < tiles[y].length) {
				const tile = tiles[y][x];
				if (tile.items.length > 0) {
					const topItem = tile.items[tile.items.length - 1];
					setSelectedItemId(topItem.id);
				}
			}
			setToolMode('draw');
			return;
		}

		if (toolMode === 'draw') {
			const item = data.items.get(selectedItemId);
			if (!item) return;
		}

		setTiles((prev) => {
			const newTiles = prev.map((row) => [...row]);

			while (newTiles.length <= y) {
				const newRow: SceneTile[] = [];
				for (let i = 0; i < width; i++) {
					newRow.push({ items: [] });
				}
				newTiles.push(newRow);
			}

			for (const row of newTiles) {
				while (row.length <= x) {
					row.push({ items: [] });
				}
			}

			if (y < 0 || x < 0 || !newTiles[y]) {
				return prev;
			}

			const tile = { ...newTiles[y][x] };

			if (toolMode === 'erase') {
				if (tile.items.length > 0) {
					tile.items = tile.items.slice(0, -1);
				}
			} else {
				tile.items = [...tile.items, { id: selectedItemId }];
			}

			newTiles[y][x] = tile;
			return newTiles;
		});
	};

	const selectedItem = data?.items.get(selectedItemId);

	const handleLoadScene = async (name: string) => {
		try {
			const content = await invoke<string>('load_scene', { name });
			const json = JSON.parse(content);
			if (json.tiles) {
				setTiles(json.tiles);
				setCurrentSceneName(name);
			}
		} catch (e) {
			console.error('Failed to load scene:', e);
			alert(`Failed to load scene: ${e}`);
		}
	};

	const handleSaveScene = async () => {
		const sceneData = {
			width,
			tiles,
			height
		};
		const content = JSON.stringify(sceneData, null, 2);

		let name = currentSceneName;
		if (!name) {
			name = prompt('Enter scene name:', `scene_${Date.now()}`);
			if (!name) return;
		}

		try {
			await invoke('save_scene', { name, content });
			setCurrentSceneName(name);
			await refreshScenes();
			alert('Scene saved successfully!');
		} catch (e) {
			console.error('Failed to save scene:', e);
			alert(`Failed to save scene: ${e}`);
		}
	};

	const handleSaveAsScene = async () => {
		const sceneData = {
			width,
			tiles,
			height
		};
		const content = JSON.stringify(sceneData, null, 2);

		const name = prompt('Enter scene name:', `scene_${Date.now()}`);
		if (!name) return;

		try {
			await invoke('save_scene', { name, content });
			setCurrentSceneName(name);
			await refreshScenes();
			alert('Scene saved successfully!');
		} catch (e) {
			console.error('Failed to save scene:', e);
			alert(`Failed to save scene: ${e}`);
		}
	};

	const handleDeleteScene = async () => {
		if (!currentSceneName) return;
		if (!confirm(`Are you sure you want to delete scene "${currentSceneName}"?`)) return;

		try {
			await invoke('delete_scene', { name: currentSceneName });
			const updatedScenes = await refreshScenes();

			const wasDefaultScene = currentSceneName === defaultSceneName;
			if (wasDefaultScene) {
				setDefaultSceneName(null);
				const config = await invoke<any | { default_scene?: string }>('get_config');
				config.default_scene = null;
				await invoke('save_config', { config });
			}

			setCurrentSceneName(null);

			const remainingDefaultScene = wasDefaultScene ? null : defaultSceneName;
			if (remainingDefaultScene && updatedScenes.includes(remainingDefaultScene)) {
				await handleLoadScene(remainingDefaultScene);
			} else {
				await loadPublicDefaultScene().catch((e) => {
					console.error('Failed to load public default scene:', e);
					initializeScene(width, height);
				});
			}
		} catch (e) {
			console.error('Failed to delete scene:', e);
			alert(`Failed to delete scene: ${e}`);
		}
	};

	const handleSetDefaultScene = async () => {
		if (!currentSceneName) return;

		try {
			const config = await invoke<any | { default_scene?: string }>('get_config');
			config.default_scene = currentSceneName;
			await invoke('save_config', { config });
			setDefaultSceneName(currentSceneName);
			alert(`Set "${currentSceneName}" as default scene.`);
		} catch (e) {
			console.error('Failed to set default scene:', e);
			alert(`Failed to set default scene: ${e}`);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[1000px] max-h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden overflow-hidden">
				<div className="border-b border-border px-4 py-2.5 flex items-center justify-between bg-card/50">
					<h2 className="text-base font-semibold">Scene Editor</h2>
					<button
						onClick={() => onOpenChange(false)}
						className="w-7 h-7 flex items-center justify-center hover:bg-accent rounded-md transition-colors"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				</div>

				<div className="border-b border-border px-4 py-2 flex items-center gap-2 bg-muted/20">
					<Button
						size="sm"
						variant="outline"
						title="New Scene"
						className="h-8 px-3 text-xs"
						onClick={() => initializeScene(width, height)}
					>
						<Plus className="h-3.5 w-3.5 mr-1.5" />
						New
					</Button>
					<Button size="sm" variant="outline" onClick={handleSaveScene} className="h-8 px-3 text-xs">
						<Save className="mr-1.5 h-3.5 w-3.5" />
						Save
					</Button>
					<Button size="sm" variant="outline" title="Save As..." onClick={handleSaveAsScene} className="h-8 px-3 text-xs">
						<Plus className="mr-1.5 h-3.5 w-3.5" />
						Save As
					</Button>
					<div className="ml-auto">
						<Select value={currentSceneName || ''} onValueChange={(value) => handleLoadScene(value)}>
							<SelectTrigger className="w-[240px] h-8 text-xs">
								<SelectValue placeholder="Select a scene..." />
							</SelectTrigger>
							<SelectContent>
								{scenes.map((scene) => (
									<SelectItem key={scene} value={scene}>
										{scene} {scene === defaultSceneName && '(Default)'}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="flex-1 flex overflow-hidden">
					<div className="w-64 border-r border-border p-4 flex flex-col gap-4 bg-secondary/20 overflow-y-auto">
						<div className="space-y-2">
							<Label>Selected Item</Label>
							<Button
								variant="outline"
								onClick={() => setItemPickerOpen(true)}
								className="w-full h-auto p-2 flex flex-col gap-2 items-center"
							>
								<CheckerBoard className="w-16 h-16 rounded border border-border/50 overflow-hidden bg-background">
									{selectedItem ? (
										<SpriteCanvas
											renderMode="list"
											thing={selectedItem}
											width={selectedItem.width}
											height={selectedItem.height}
											scale={64 / (Math.max(selectedItem.width, selectedItem.height) * spriteSize)}
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">?</div>
									)}
								</CheckerBoard>
								<div className="flex items-center gap-2 text-xs">
									<Search className="w-3 h-3" />
									<span>ID: {selectedItemId}</span>
								</div>
							</Button>
						</div>

						<div className="space-y-2">
							<Label>Tool</Label>
							<div className="flex gap-1">
								<Button
									size="icon"
									title="Draw"
									className="flex-1"
									onClick={() => setToolMode('draw')}
									variant={toolMode === 'draw' ? 'default' : 'outline'}
								>
									<Pencil className="h-4 w-4" />
								</Button>
								<Button
									size="icon"
									title="Erase"
									className="flex-1"
									onClick={() => setToolMode('erase')}
									variant={toolMode === 'erase' ? 'default' : 'outline'}
								>
									<Eraser className="h-4 w-4" />
								</Button>
								<Button
									size="icon"
									title="Pick Item"
									className="flex-1"
									onClick={() => setToolMode('pick')}
									variant={toolMode === 'pick' ? 'default' : 'outline'}
								>
									<Pipette className="h-4 w-4" />
								</Button>
							</div>
						</div>

						<div className="space-y-2">
							<Label>Zoom</Label>
							<div className="flex gap-2">
								<Button size="icon" variant="outline" onClick={() => setScale((s) => Math.max(0.5, s - 0.5))}>
									<Minimize2 className="h-4 w-4" />
								</Button>
								<div className="flex items-center justify-center flex-1 font-mono text-sm">{scale}x</div>
								<Button size="icon" variant="outline" onClick={() => setScale((s) => Math.min(4, s + 0.5))}>
									<Maximize2 className="h-4 w-4" />
								</Button>
							</div>
						</div>

						<div className="mt-auto space-y-2 pt-4 border-t border-border/50">
							{currentSceneName && (
								<div className="flex gap-2">
									<Button
										size="sm"
										className="flex-1"
										onClick={handleSetDefaultScene}
										disabled={currentSceneName === defaultSceneName}
										variant={currentSceneName === defaultSceneName ? 'default' : 'outline'}
									>
										<Star className={`mr-2 h-3.5 w-3.5 ${currentSceneName === defaultSceneName ? 'fill-current' : ''}`} />
										{currentSceneName === defaultSceneName ? 'Default' : 'Set Default'}
									</Button>
									<Button size="sm" className="px-3" variant="destructive" onClick={handleDeleteScene}>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</div>
							)}

							<Button size="sm" variant="outline" className="w-full" onClick={() => initializeScene(width, height)}>
								<Trash2 className="mr-2 h-3.5 w-3.5" />
								Clear Scene
							</Button>
						</div>
					</div>

					<div className="flex-1 bg-neutral-900 overflow-auto flex items-center justify-center p-8 min-w-0">
						<SceneCanvas width={width} tiles={tiles} scale={scale} height={height} onTileClick={handleTileClick} />
					</div>
				</div>
			</DialogContent>

			<ItemPickerDialog open={itemPickerOpen} onOpenChange={setItemPickerOpen} onItemSelect={setSelectedItemId} />
		</Dialog>
	);
};
