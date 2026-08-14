import type { ThingType, ThingCategory } from '~/lib/formats/tibia';
import type { EmbedDraftApi } from '~/components/PropertiesPanel/types';

import React from 'react';
import { listen } from '@tauri-apps/api/event';
import { Save, Plus, Copy, RotateCcw, PlayCircle } from 'lucide-react';

import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import Resizer from '~/components/Dock/Resizer';
import { PropertiesPanel } from '~/components/PropertiesPanel';
import { ThingCategory as Categories } from '~/lib/formats/tibia';
import { WindowControls } from '~/components/commons/WindowControls';
import { useTemplateEditor } from '~/usecase/hooks/useTemplateEditor';
import { useTemplateLayout } from '~/usecase/hooks/useTemplateLayout';
import { SheetPanel } from '~/components/TemplateEditorWindow/SheetPanel';
import { ItemsStrip } from '~/components/TemplateEditorWindow/ItemsStrip';
import { TemplateList } from '~/components/TemplateEditorWindow/TemplateList';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from '~/components/ui/select';

const CATEGORY_OPTIONS: ThingCategory[] = [Categories.ITEM, Categories.OUTFIT, Categories.EFFECT, Categories.MISSILE];

const FALLBACK_CLIENT_VERSION = 1056;

export const TemplateEditorWindow = () => {
	const editor = useTemplateEditor();
	const { layout, resize } = useTemplateLayout();

	const clientVersion = editor.context.version || FALLBACK_CLIENT_VERSION;

	const [selectedTile, setSelectedTile] = React.useState<null | number>(null);
	const [label, setLabel] = React.useState('');
	const [copyId, setCopyId] = React.useState('');

	React.useEffect(() => {
		const handlePaste = async (event: ClipboardEvent) => {
			const file = Array.from(event.clipboardData?.items ?? [])
				.find((entry) => entry.type.startsWith('image/'))
				?.getAsFile();
			if (!file) return;
			event.preventDefault();
			await editor.loadSheetFromBytes(new Uint8Array(await file.arrayBuffer()));
		};

		window.addEventListener('paste', handlePaste);
		return () => window.removeEventListener('paste', handlePaste);
	}, [editor]);

	React.useEffect(() => {
		const unlisten = listen<ThingType>('template:seed', (event) => editor.seedFromThing(event.payload));
		return () => {
			void unlisten.then((fn) => fn());
		};
	}, [editor]);

	const copyProps = async ({ draft, setProperty }: EmbedDraftApi) => {
		const id = Number(copyId);
		if (!Number.isFinite(id) || id <= 0) return;
		const props = await editor.copyPropsFromProject(id, draft.category as ThingCategory);
		if (!props) return;

		if (editor.selected.size) {
			editor.applyPropsToSelection(props);
			return;
		}
		for (const [key, value] of Object.entries(props)) setProperty(key, value);
	};

	const footer = (api: EmbedDraftApi) => (
		<div className="flex w-full items-center gap-2">
			<Input
				value={copyId}
				placeholder="From #"
				className="h-7 w-24 text-xs"
				onChange={(event) => setCopyId(event.target.value)}
				title="Copy properties from an item in the open project"
			/>
			<Button size="sm" variant="outline" disabled={!copyId} className="h-7 px-2 text-xs" onClick={() => void copyProps(api)}>
				<Copy className="mr-1 h-3 w-3" />
				{editor.selected.size ? `Copy to ${editor.selected.size} selected` : 'Copy here'}
			</Button>
			<Button
				size="sm"
				variant="outline"
				className="ml-auto h-7 px-2 text-xs"
				title="Clear sprites and properties"
				onClick={() => {
					editor.startNewItem();
					setLabel('');
				}}
			>
				<RotateCcw className="mr-1 h-3 w-3" />
				Reset
			</Button>

			<Input
				value={label}
				placeholder="Item label"
				className="h-7 w-44 text-xs"
				onChange={(event) => setLabel(event.target.value)}
			/>
			<Button
				size="sm"
				className="h-7 px-3 text-xs"
				onClick={() => {
					editor.commitDraft(api.draft, label);
					setLabel('');
				}}
			>
				<Plus className="mr-1 h-3 w-3" />
				{editor.editingIndex === null ? 'Add item' : 'Update item'}
			</Button>
		</div>
	);

	const headerExtra = (
		<Select
			value={editor.category}
			disabled={editor.editingIndex !== null}
			onValueChange={(value) => editor.startNewItem(value as ThingCategory)}
		>
			<SelectTrigger className="h-6 w-24 text-[10px]">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{CATEGORY_OPTIONS.map((option) => (
					<SelectItem key={option} value={option} className="text-[10px]">
						{option}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);

	return (
		<div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
			<div data-tauri-drag-region className="flex h-8 items-center gap-2 border-b border-border/50 bg-toolbar-bg pl-3 pr-3">
				<span className="text-xs font-semibold uppercase tracking-wide">Template Editor</span>
				<WindowControls className="ml-auto" />
			</div>

			<div className="flex min-h-0 flex-1 gap-1.5 p-1.5">
				<div className="relative flex-shrink-0" style={{ width: layout.listWidth }}>
					<TemplateList
						onLoad={editor.load}
						templates={editor.templates}
						activeName={editor.templateName}
						onDelete={(name) => void editor.remove(name)}
						onDuplicate={(template) => void editor.duplicate(template)}
						onNew={() => {
							editor.setTemplateName('');
							editor.startNewItem();
						}}
					/>
					<Resizer gap dir="x" side="right" onResize={({ dx }) => resize('listWidth', dx)} />
				</div>

				<div style={{ width: layout.sheetWidth }} className="relative flex min-h-0 flex-shrink-0 flex-col gap-1.5">
					<div className="min-h-0 flex-1">
						<SheetPanel
							sheet={editor.sheet}
							selectedTile={selectedTile}
							sheetName={editor.sheetName}
							usedTiles={editor.usedTiles}
							onSelectTile={setSelectedTile}
							onPickSheet={() => void editor.pickSheet()}
						/>
					</div>
					<div className="relative flex-shrink-0" style={{ height: layout.itemsHeight }}>
						<ItemsStrip
							items={editor.items}
							sheet={editor.sheet}
							onEdit={editor.editItem}
							selected={editor.selected}
							onSelect={editor.setSelected}
							editingIndex={editor.editingIndex}
							onRemove={() => editor.removeItems(editor.selected)}
						/>
						<Resizer gap dir="y" side="top" onResize={({ dy }) => resize('itemsHeight', -dy)} />
					</div>
					<Resizer gap dir="x" side="right" onResize={({ dx }) => resize('sheetWidth', dx)} />
				</div>

				<div className="min-w-0 flex-1">
					<PropertiesPanel
						embed={{
							footer,
							headerExtra,
							clientVersion,
							item: editor.baseThing,
							getSprite: editor.getSprite,
							title: editor.editingIndex === null ? 'New object' : `Editing item ${editor.editingIndex + 1}`
						}}
					/>
				</div>
			</div>

			<div className="flex h-11 items-center gap-2 border-t border-border/50 bg-secondary/30 px-3">
				<Input
					value={editor.templateName}
					placeholder="Template name"
					className="h-7 w-56 text-xs"
					onChange={(event) => editor.setTemplateName(event.target.value)}
				/>

				<div className="ml-auto flex items-center gap-2">
					<Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => void editor.save()}>
						<Save className="mr-1 h-3 w-3" />
						Save template
					</Button>
					<Button size="sm" disabled={editor.busy} className="h-7 px-3 text-xs" onClick={() => void editor.apply()}>
						<PlayCircle className="mr-1 h-3 w-3" />
						Apply to project
					</Button>
				</div>
			</div>
		</div>
	);
};
