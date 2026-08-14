import type { FormatConfig } from '~/lib/formats/tibia';
import type { SheetTiles } from '~/usecase/util/templateSheet';
import type { Sprite, ThingType, TemplateItem, ThingCategory, SpriteTemplate } from '~/lib/formats/tibia';

import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { emit, listen } from '@tauri-apps/api/event';

import { useToast } from './useToast';
import { formatByConfigName } from '~/lib/formats/registry';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { decodeSheet, createSheetTiles } from '~/usecase/util/templateSheet';
import {
	saveTemplate,
	listTemplates,
	GEOMETRY_KEYS,
	deleteTemplate,
	templatePropsOf,
	createThingType,
	TEMPLATE_VERSION,
	templateFromThing,
	templateCellCount,
	templateGeometryOf,
	ThingCategory as Categories
} from '~/lib/formats/tibia';

export interface TemplateContext {
	version: number;
	hasProject: boolean;
	formatName?: string;
}

const REQUEST_TIMEOUT = 4000;

const emptyDraft = (category: ThingCategory, config: FormatConfig): ThingType => {
	const thing = createThingType(0, category, config);
	thing.spriteIndex = new Array(templateCellCount(templateGeometryOf(thing))).fill(0);
	return thing;
};

const askMainWindow = async <T>(request: string, response: string, payload?: unknown): Promise<T | null> =>
	new Promise((resolve) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			void unlisten.then((fn) => fn());
			resolve(null);
		}, REQUEST_TIMEOUT);

		const unlisten = listen<T>(response, (event) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			void unlisten.then((fn) => fn());
			resolve(event.payload);
		});

		void unlisten.then(() => emit(request, payload ?? {}));
	});

export const useTemplateEditor = () => {
	const { toast } = useToast();
	const { formatConfig, setFormatConfig } = useAssetData();

	const [sheet, setSheet] = React.useState<null | SheetTiles>(null);
	const [sheetPath, setSheetPath] = React.useState<null | string>(null);
	const [sheetName, setSheetName] = React.useState('');

	const [templates, setTemplates] = React.useState<SpriteTemplate[]>([]);
	const [templateName, setTemplateName] = React.useState('');
	const [items, setItems] = React.useState<TemplateItem[]>([]);
	const [selected, setSelected] = React.useState<Set<number>>(new Set());
	const [editingIndex, setEditingIndex] = React.useState<null | number>(null);
	const [category, setCategory] = React.useState<ThingCategory>(Categories.ITEM);
	const [baseThing, setBaseThing] = React.useState<ThingType>(() => emptyDraft(Categories.ITEM, formatConfig));
	const [context, setContext] = React.useState<TemplateContext>({ version: 0, hasProject: false });
	const [busy, setBusy] = React.useState(false);

	React.useEffect(() => {
		const name = context.formatName;
		if (!name || name === formatConfig.name) return;
		const handler = formatByConfigName(name);
		if (handler) setFormatConfig(handler.config);
	}, [context.formatName, formatConfig.name, setFormatConfig]);

	const refreshTemplates = React.useCallback(async () => {
		try {
			setTemplates(await listTemplates());
		} catch (err) {
			console.error('Failed to list templates', err);
		}
	}, []);

	React.useEffect(() => {
		void refreshTemplates();
	}, [refreshTemplates]);

	React.useEffect(() => {
		let cancelled = false;
		void askMainWindow<TemplateContext>('template:query-context', 'template:context').then((value) => {
			if (!cancelled && value) setContext(value);
		});
		const unlisten = listen<TemplateContext>('template:context', (event) => setContext(event.payload));
		void emit('template:query-seed');
		return () => {
			cancelled = true;
			void unlisten.then((fn) => fn());
		};
	}, []);

	const applySheetCanvas = React.useCallback((canvas: HTMLCanvasElement, path: null | string, name: string) => {
		setSheet(createSheetTiles(canvas));
		setSheetPath(path);
		setSheetName(name);
	}, []);

	const loadSheetFromPath = React.useCallback(
		async (path: string) => {
			try {
				const bytes = await invoke<Uint8Array>('read_file', { path });
				const canvas = await decodeSheet(new Uint8Array(bytes));
				applySheetCanvas(canvas, path, path.split(/[\\/]/).pop() ?? 'sheet');
			} catch (err) {
				toast({ variant: 'destructive', description: `Failed to load sheet: ${err}` });
			}
		},
		[applySheetCanvas, toast]
	);

	const loadSheetFromBytes = React.useCallback(
		async (bytes: Uint8Array, name = 'pasted sheet') => {
			try {
				const canvas = await decodeSheet(bytes);
				const path = await invoke<string>('cache_template_sheet', bytes);
				applySheetCanvas(canvas, path, name);
			} catch (err) {
				toast({ variant: 'destructive', description: `Failed to read pasted image: ${err}` });
			}
		},
		[applySheetCanvas, toast]
	);

	const pickSheet = React.useCallback(async () => {
		const selection = await open({
			multiple: false,
			filters: [{ name: 'Image', extensions: ['png', 'bmp', 'jpg', 'jpeg'] }]
		});
		if (typeof selection === 'string') await loadSheetFromPath(selection);
	}, [loadSheetFromPath]);

	const getSprite = React.useCallback((id: number): Sprite | undefined => (id > 0 ? sheet?.getTile(id - 1) : undefined), [sheet]);

	const usedTiles = React.useMemo(() => {
		const used = new Map<number, string>();
		for (const item of items) {
			for (const cell of item.cells) {
				if (cell >= 0) used.set(cell, item.label);
			}
		}
		return used;
	}, [items]);

	const startNewItem = React.useCallback(
		(nextCategory?: ThingCategory) => {
			const cat = nextCategory ?? category;
			setCategory(cat);
			setEditingIndex(null);
			setBaseThing(emptyDraft(cat, formatConfig));
		},
		[category, formatConfig]
	);

	const seedFromThing = React.useCallback((thing: ThingType) => {
		setCategory(thing.category as ThingCategory);
		setEditingIndex(null);
		setBaseThing({ ...thing, id: 0, spriteIndex: new Array(thing.spriteIndex?.length ?? 1).fill(0) });
	}, []);

	const editItem = React.useCallback((index: number) => {
		setItems((current) => {
			const item = current[index];
			if (!item) return current;
			setCategory(item.category);
			setEditingIndex(index);
			setBaseThing({
				...(item.props as ThingType),
				...item.geometry,
				id: 0,
				category: item.category,
				spriteIndex: item.cells.map((cell) => (cell >= 0 ? cell + 1 : 0))
			});
			return current;
		});
	}, []);

	const commitDraft = React.useCallback(
		(draft: ThingType, label: string) => {
			const cells = (draft.spriteIndex ?? []).map((id) => (id > 0 ? id - 1 : -1));
			const entry = templateFromThing(draft, cells, label.trim() || `item ${items.length + 1}`);

			setItems((current) => {
				if (editingIndex === null) return [...current, entry];
				const next = [...current];
				next[editingIndex] = entry;
				return next;
			});
			setEditingIndex(null);
			setBaseThing({ ...draft, id: 0, spriteIndex: new Array(draft.spriteIndex?.length ?? 1).fill(0) });
		},
		[editingIndex, items.length]
	);

	const removeItems = React.useCallback((indices: Set<number>) => {
		setItems((current) => current.filter((_, index) => !indices.has(index)));
		setSelected(new Set());
		setEditingIndex(null);
	}, []);

	const applyPropsToSelection = React.useCallback(
		(props: Partial<ThingType>) => {
			setItems((current) =>
				current.map((item, index) => {
					if (!selected.has(index)) return item;

					const geometry = { ...item.geometry };
					for (const key of GEOMETRY_KEYS) {
						const value = props[key];
						if (typeof value === 'number') geometry[key] = value;
					}

					const size = templateCellCount(geometry);
					const cells = Array.from({ length: size }, (_, cell) => item.cells[cell] ?? -1);

					return { ...item, cells, geometry, props: { ...item.props, ...templatePropsOf(props as ThingType) } };
				})
			);
		},
		[selected]
	);

	const copyPropsFromProject = React.useCallback(
		async (id: number, cat: ThingCategory): Promise<null | Partial<ThingType>> => {
			const thing = await askMainWindow<null | ThingType>('template:request-thing', 'template:thing', { id, category: cat });
			if (!thing) {
				toast({ variant: 'destructive', description: `Item #${id} not found in the open project` });
				return null;
			}
			return { ...templatePropsOf(thing), ...templateGeometryOf(thing) };
		},
		[toast]
	);

	const buildTemplate = React.useCallback(
		(): SpriteTemplate => ({
			items,
			tile: sheet?.tile ?? 32,
			name: templateName.trim(),
			version: TEMPLATE_VERSION,
			createdAt: new Date().toISOString(),
			sheet: { cols: sheet?.cols ?? 0, rows: sheet?.rows ?? 0 }
		}),
		[items, templateName, sheet]
	);

	const save = React.useCallback(async () => {
		if (!templateName.trim()) {
			toast({ variant: 'destructive', description: 'Name the template before saving' });
			return;
		}
		if (!items.length) {
			toast({ variant: 'destructive', description: 'Add at least one item to the template' });
			return;
		}
		try {
			await saveTemplate(buildTemplate());
			await refreshTemplates();
			toast({ description: `Template "${templateName.trim()}" saved` });
		} catch (err) {
			toast({ variant: 'destructive', description: `Failed to save template: ${err}` });
		}
	}, [templateName, items.length, buildTemplate, refreshTemplates, toast]);

	const load = React.useCallback(
		(template: SpriteTemplate) => {
			setTemplateName(template.name);
			setItems(template.items);
			setSelected(new Set());
			setEditingIndex(null);
			setBaseThing(emptyDraft((template.items[0]?.category ?? Categories.ITEM) as ThingCategory, formatConfig));
		},
		[formatConfig]
	);

	const duplicate = React.useCallback(
		async (template: SpriteTemplate) => {
			const taken = new Set(templates.map((entry) => entry.name));
			let name = `${template.name} copy`;
			for (let index = 2; taken.has(name); index++) name = `${template.name} copy ${index}`;

			try {
				await saveTemplate({ ...template, name, createdAt: new Date().toISOString() });
				await refreshTemplates();
			} catch (err) {
				toast({ variant: 'destructive', description: `Failed to duplicate template: ${err}` });
			}
		},
		[templates, refreshTemplates, toast]
	);

	const remove = React.useCallback(
		async (name: string) => {
			try {
				await deleteTemplate(name);
				await refreshTemplates();
			} catch (err) {
				toast({ variant: 'destructive', description: `Failed to delete template: ${err}` });
			}
		},
		[refreshTemplates, toast]
	);

	const apply = React.useCallback(async () => {
		if (!context.hasProject) {
			toast({ variant: 'destructive', description: 'Open a project in the main window first' });
			return;
		}
		if (!sheetPath) {
			toast({ variant: 'destructive', description: 'Load the sheet from a file before applying' });
			return;
		}
		if (!items.length) {
			toast({ variant: 'destructive', description: 'Nothing to apply' });
			return;
		}

		setBusy(true);
		const result = await askMainWindow<{ error?: string; created: number }>('template:apply', 'template:applied', {
			sheetPath,
			template: buildTemplate()
		});
		setBusy(false);

		if (!result) {
			toast({ variant: 'destructive', description: 'Main window did not answer' });
			return;
		}
		if (result.error) {
			toast({ variant: 'destructive', description: result.error });
			return;
		}
		toast({ description: `Created ${result.created} object${result.created === 1 ? '' : 's'}` });
	}, [context.hasProject, sheetPath, items.length, buildTemplate, toast]);

	return {
		save,
		load,
		busy,
		apply,
		items,
		sheet,
		remove,
		context,
		category,
		selected,
		editItem,
		duplicate,
		pickSheet,
		baseThing,
		usedTiles,
		getSprite,
		sheetName,
		templates,
		setSelected,
		commitDraft,
		removeItems,
		startNewItem,
		editingIndex,
		templateName,
		seedFromThing,
		setTemplateName,
		loadSheetFromPath,
		loadSheetFromBytes,
		copyPropsFromProject,
		applyPropsToSelection
	};
};
