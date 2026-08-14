import type { SheetTiles } from '~/usecase/util/templateSheet';
import type { TemplateItem, SpriteTemplate } from '~/lib/formats/tibia';

export interface SheetPanelProps {
	sheetName: string;
	onPickSheet: () => void;
	sheet: null | SheetTiles;
	selectedTile: null | number;
	usedTiles: Map<number, string>;
	onSelectTile: (tile: null | number) => void;
}

export interface ItemsStripProps {
	onRemove: () => void;
	items: TemplateItem[];
	selected: Set<number>;
	sheet: null | SheetTiles;
	editingIndex: null | number;
	onEdit: (index: number) => void;
	onSelect: (selected: Set<number>) => void;
}

export interface TemplateListProps {
	onNew: () => void;
	activeName: string;
	templates: SpriteTemplate[];
	onDelete: (name: string) => void;
	onLoad: (template: SpriteTemplate) => void;
	onDuplicate: (template: SpriteTemplate) => void;
}
