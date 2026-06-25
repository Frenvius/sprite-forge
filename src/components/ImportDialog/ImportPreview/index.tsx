import type { ObdRow } from '~/lib/formats/tibia/obdViewer';
import type { PropertiesContextValue } from '~/usecase/context/PropertiesContext/types';

import { Loader2, PackageOpen } from 'lucide-react';

import { CATEGORY_NAME } from '~/lib/formats/tibia/obdViewer';
import { useImportPreview } from '~/usecase/hooks/useImportPreview';
import { PropertiesContext } from '~/usecase/context/PropertiesContext';
import { PreviewPanel } from '~/components/PropertiesPanel/PreviewPanel';
import { useObjectProperties } from '~/usecase/hooks/useObjectProperties';

interface ImportPreviewProps {
	row: null | ObdRow;
	transparency: boolean;
}

export const ImportPreview = ({ row, transparency }: ImportPreviewProps) => {
	const { thing, loading, getSprite } = useImportPreview(row?.recordIndex ?? null, transparency);
	const op = useObjectProperties({ getSprite, item: thing });

	if (!row) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
				<PackageOpen className="h-10 w-10 opacity-50" />
				<p className="text-xs">Click an object to preview it</p>
			</div>
		);
	}

	const ready = !loading && !!thing && !!op.item && !!op.draftItem;
	const cat = CATEGORY_NAME[row.category] ?? 'item';

	const contextValue: null | PropertiesContextValue = ready
		? {
				item: op.item!,
				draftItem: op.draftItem!,
				...op.visibility,
				outfitData: op.outfitData,
				setOutfitData: op.setOutfitData,
				hasPropertyChanged: op.hasPropertyChanged,
				handleUndoProperty: op.handleUndoProperty,
				handleResetSprites: op.handleResetSprites,
				handlePropertyChange: op.handlePropertyChange,
				handleRandomizeColors: op.handleRandomizeColors
			}
		: null;

	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-border/50 px-3 py-2">
				<div className="truncate text-sm font-medium text-foreground">{row.name || `${cat} ${row.sourceId}`}</div>
				<div className="text-[10px] uppercase tracking-wide text-muted-foreground">
					{cat} · #{row.sourceId} · {row.spriteCount} sprites{row.isDup ? ' · duplicate' : ''}
				</div>
			</div>

			<div className="min-h-0 flex-1 p-2">
				{contextValue ? (
					<PropertiesContext.Provider value={contextValue}>
						<PreviewPanel preview={op.preview} />
					</PropertiesContext.Provider>
				) : (
					<div className="flex h-full items-center justify-center">
						<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
					</div>
				)}
			</div>

			{ready && op.visibility.isOutfit && op.draftItem!.patternY > 1 && (
				<div className="flex flex-wrap items-center gap-2 border-t border-border/50 px-3 py-2">
					<span className="text-[10px] uppercase tracking-wide text-muted-foreground">Addons</span>
					{Array.from({ length: op.draftItem!.patternY - 1 }, (_, i) => (
						<label key={i} className="flex cursor-pointer items-center gap-1 text-[11px] text-foreground">
							<input
								type="checkbox"
								checked={op.outfitData.addons[i] ?? false}
								onChange={(e) =>
									op.setOutfitData((p) => ({ ...p, addons: p.addons.map((v, idx) => (idx === i ? e.target.checked : v)) }))
								}
							/>
							{i + 1}
						</label>
					))}
				</div>
			)}
		</div>
	);
};
