import type { PropertiesContextValue } from '@/usecase/context/PropertiesContext/types';

import { Button } from '@/components/ui/button';
import { X, Save, RotateCcw } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PropertiesContext } from '@/usecase/context/PropertiesContext';
import { useObjectProperties } from '@/usecase/hooks/useObjectProperties';
import {
	AlertDialog,
	AlertDialogTitle,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogContent,
	AlertDialogDescription
} from '@/components/ui/alert-dialog';

import { EmptyState } from './EmptyState';
import { categoryTitle } from './constants';
import { PreviewPanel } from './PreviewPanel';
import { BasicsColumn } from './BasicsColumn';
import { ServerSection } from './ServerSection';
import { PropertyColumns } from './PropertyColumns';

export const PropertiesPanel = () => {
	const c = useObjectProperties();

	if (!c.data || !c.item) {
		return <EmptyState category={c.itemCategory} />;
	}

	if (!c.draftItem) {
		return <EmptyState category={c.itemCategory} />;
	}

	const { item, isOutfit, draftItem } = { item: c.item, draftItem: c.draftItem, isOutfit: c.visibility.isOutfit };

	const contextValue: PropertiesContextValue = {
		item,
		draftItem,
		...c.visibility,
		outfitData: c.outfitData,
		setOutfitData: c.setOutfitData,
		hasPropertyChanged: c.hasPropertyChanged,
		handleUndoProperty: c.handleUndoProperty,
		handleResetSprites: c.handleResetSprites,
		handlePropertyChange: c.handlePropertyChange,
		handleRandomizeColors: c.handleRandomizeColors
	};

	return (
		<PropertiesContext.Provider value={contextValue}>
			<div className="w-full h-full bg-card rounded-lg shadow-island-lg flex flex-col overflow-hidden">
				<div className="h-8 px-4 flex items-center border-b border-border/50 bg-secondary/80">
					<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">
						{categoryTitle(c.itemCategory)} Properties - ID {draftItem.id}
						{draftItem.isMarketItem && draftItem.marketName && ` - ${draftItem.marketName}`}
					</h2>
				</div>

				<ScrollArea className="flex-1">
					<div className="p-4">
						<div
							className={`grid gap-4 mb-4 grid-cols-1 min-[820px]:grid-cols-[361px_1fr] ${isOutfit ? '' : 'min-[1400px]:grid-cols-[361px_1fr_1fr]'}`}
						>
							<PreviewPanel preview={c.preview} />
							<BasicsColumn preview={c.preview} frameGroups={c.frameGroups} />
						</div>

						<Separator />

						<PropertyColumns />

						{c.visibility.isItem && c.data?.otbPath && <ServerSection clientId={draftItem.id} />}
					</div>
				</ScrollArea>

				<div className="border-t border-border/50 bg-secondary/30 p-2 flex items-center gap-2 justify-between h-[45px]">
					<Button size="sm" className="h-7" variant="outline" disabled={!c.hasChanges} onClick={c.handleDiscardChanges}>
						<RotateCcw className="h-3.5 w-3.5 mr-1" />
						Discard Changes
					</Button>
					<div className="flex items-center gap-2">
						<Button size="sm" className="h-7" variant="outline" onClick={c.handleClose}>
							<X className="h-3.5 w-3.5 mr-1" />
							Close
						</Button>
						<Button size="sm" className="h-7" onClick={c.handleSave} disabled={!c.hasChanges}>
							<Save className="h-3.5 w-3.5 mr-1" />
							Save Changes
						</Button>
					</div>
				</div>

				<AlertDialog open={c.showCloseConfirm} onOpenChange={c.setShowCloseConfirm}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
							<AlertDialogDescription>
								You have unsaved changes. Are you sure you want to close? All unsaved changes and state will be lost.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={c.performClose}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								Close
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</PropertiesContext.Provider>
	);
};
