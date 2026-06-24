import type { Visibility } from '~/usecase/context/PropertiesContext/types';

import { Shuffle } from 'lucide-react';

import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Button } from '~/components/ui/button';
import { SchemaSection } from './SchemaRenderer';
import { TibiaColorPicker } from '~/components/TibiaColorPicker';
import { usePropertiesContext } from '~/usecase/context/PropertiesContext';
import { TIBIA_PROPERTY_SCHEMA } from '~/lib/formats/tibia/propertySchema';

export const PropertyColumns = () => {
	const {
		item,
		isItem,
		isOutfit,
		draftItem,
		isMissile,
		showHooks,
		outfitData,
		showMarket,
		showUsable,
		showWriting,
		showMinimap,
		showLensHelp,
		showHangable,
		showDontHide,
		showPatternZ,
		setOutfitData,
		showEquipment,
		showTopEffect,
		showWrappable,
		showIgnoreLook,
		showHasCharges,
		showInteraction,
		showFloorChange,
		showTranslucent,
		showGroundBorder,
		showDisplacement,
		showAnimateAlways,
		showLayerPosition,
		showPhysicsGround,
		showDefaultActions,
		showNoMoveAnimation,
		supportsFrameGroups,
		handlePropertyChange,
		handleRandomizeColors,
		showAnimationProperties,
		showDisplacementElevation
	} = usePropertiesContext();

	const visibility: Visibility & Record<string, boolean> = {
		isItem,
		isOutfit,
		isMissile,
		showHooks,
		showMarket,
		showUsable,
		showMinimap,
		showWriting,
		showLensHelp,
		showHangable,
		showDontHide,
		showPatternZ,
		showEquipment,
		showTopEffect,
		showWrappable,
		showIgnoreLook,
		showHasCharges,
		showInteraction,
		showFloorChange,
		showTranslucent,
		showGroundBorder,
		showDisplacement,
		showAnimateAlways,
		showLayerPosition,
		showPhysicsGround,
		showDefaultActions,
		showNoMoveAnimation,
		supportsFrameGroups,
		showAnimationProperties,
		showDisplacementElevation
	};

	const col1 = TIBIA_PROPERTY_SCHEMA.filter((s) => s.column === 1);
	const col2 = TIBIA_PROPERTY_SCHEMA.filter((s) => s.column === 2);
	const col3 = TIBIA_PROPERTY_SCHEMA.filter((s) => s.column === 3);

	const renderEntry = (entry: (typeof TIBIA_PROPERTY_SCHEMA)[number]) => {
		if (entry.kind === 'custom') {
			const customVisible =
				entry.show === true
					? true
					: Array.isArray(entry.show)
						? entry.show.every((k) => (k.startsWith('!') ? !visibility[k.slice(1)] : !!visibility[k]))
						: !!visibility[entry.show];
			if (!customVisible) return null;

			switch (entry.id) {
				case 'outfit-addons':
					return renderOutfitAddons();
				case 'outfit-colors':
					return renderOutfitColors();
				default:
					return null;
			}
		}

		return (
			<SchemaSection
				section={entry}
				draftItem={draftItem}
				visibility={visibility}
				onChange={handlePropertyChange}
				key={entry.title + entry.column}
			/>
		);
	};

	const renderOutfitAddons = () => {
		if (!item || item.patternY <= 1) return null;
		return (
			<div key="outfit-addons">
				<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
					<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Addons</h4>
				</div>
				<div className="space-y-2 pl-1">
					{Array.from({ length: item.patternY - 1 }, (_, i) => i + 1).map((addonLevel) => (
						<div key={addonLevel} className="flex items-center justify-between">
							<Label className="text-xs text-muted-foreground">Addon {addonLevel}</Label>
							<Switch
								checked={outfitData.addons[addonLevel - 1] || false}
								onCheckedChange={(checked) => {
									const newAddons = [...outfitData.addons];
									newAddons[addonLevel - 1] = checked;
									setOutfitData({ ...outfitData, addons: newAddons });
								}}
							/>
						</div>
					))}
				</div>
			</div>
		);
	};

	const renderOutfitColors = () => {
		if (!draftItem || draftItem.layers <= 1) return null;
		const colorFields = [
			{ key: 'head', label: 'Head' },
			{ key: 'body', label: 'Body' },
			{ key: 'legs', label: 'Legs' },
			{ key: 'feet', label: 'Feet' }
		] as const;

		return (
			<div key="outfit-colors">
				<div className="flex items-center justify-between gap-2 pb-1 mb-3 border-b border-border/30">
					<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Outfit Colors</h4>
					<Button
						size="icon"
						variant="ghost"
						title="Randomize colors"
						onClick={handleRandomizeColors}
						className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors"
					>
						<Shuffle className="h-3.5 w-3.5" />
					</Button>
				</div>
				<div className="space-y-2 pl-1">
					<div className="grid grid-cols-2 gap-2">
						{colorFields.map(({ key, label }) => (
							<div key={key} className="flex flex-col gap-1">
								<Label className="text-[10px] text-muted-foreground">{label}</Label>
								<TibiaColorPicker
									className="w-full"
									value={outfitData[key]}
									onChange={(val) => {
										const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
										setOutfitData({ ...outfitData, [key]: clampedVal });
									}}
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="bg-secondary/20 rounded-md border border-border/40 overflow-hidden mt-4">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
				<div className="space-y-6">{col1.map(renderEntry)}</div>
				<div className="space-y-6">{col2.map(renderEntry)}</div>
				<div className="space-y-6">{col3.map(renderEntry)}</div>
			</div>
		</div>
	);
};
