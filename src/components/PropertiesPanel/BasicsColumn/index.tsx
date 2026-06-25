import type { useObjectProperties } from '~/usecase/hooks/useObjectProperties';

import { X, Plus } from 'lucide-react';

import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Button } from '~/components/ui/button';
import { PropertyWithUndo } from '../PropertyWithUndo';
import { NumberInput } from '~/components/ui/number-input';
import { TibiaColorPicker } from '~/components/TibiaColorPicker';
import { EightBitColorPicker } from '~/components/EightBitColorPicker';
import { usePropertiesContext } from '~/usecase/context/PropertiesContext';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from '~/components/ui/select';

interface BasicsColumnProps {
	preview: ReturnType<typeof useObjectProperties>['preview'];
	frameGroups: ReturnType<typeof useObjectProperties>['frameGroups'];
}

export const BasicsColumn = ({ preview, frameGroups }: BasicsColumnProps) => {
	const {
		item,
		isOutfit,
		draftItem,
		outfitData,
		showMinimap,
		showPatternZ,
		setOutfitData,
		showDisplacement,
		showAnimateAlways,
		supportsFrameGroups,
		handlePropertyChange,
		showDisplacementElevation
	} = usePropertiesContext();
	const { showGrid, showExactSize } = preview;
	const { selectedFrameGroup, onSelectFrameGroup, onCreateFrameGroup, onDeleteFrameGroup } = frameGroups;

	return (
		<>
			<div className="flex flex-col gap-4 @[820px]:col-span-1">
				<div className="bg-secondary/20 rounded-md border border-border/40 overflow-hidden">
					<div className="flex items-center justify-between gap-1.5 px-3 py-2 bg-secondary/40 border-b border-border/30">
						<div className="flex items-center gap-1.5">
							<div className="w-0.5 h-3 bg-primary rounded-full" />
							<h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Dimensions</h3>
						</div>
						{isOutfit && draftItem && supportsFrameGroups && (
							<div className="flex items-center gap-2">
								<Label className="text-[10px] text-muted-foreground whitespace-nowrap">Frame Group</Label>
								<Select value={selectedFrameGroup.toString()} onValueChange={(val) => onSelectFrameGroup(parseInt(val))}>
									<SelectTrigger className="h-6 w-[100px] text-[10px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{(draftItem.frameGroupsData || []).map((group, idx) => (
											<SelectItem key={idx} value={idx.toString()} className="text-[10px]">
												{group.type === 0 ? 'Idle' : 'Walking'}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{(draftItem.frameGroupsData || []).length < 2 && (
									<Button
										size="sm"
										variant="ghost"
										onClick={onCreateFrameGroup}
										title="Create new frame group"
										className="h-6 w-6 p-0 hover:bg-secondary/50"
									>
										<Plus className="h-3 w-3" />
									</Button>
								)}
								{(draftItem.frameGroupsData || []).length > 1 && (
									<Button
										size="sm"
										variant="ghost"
										onClick={onDeleteFrameGroup}
										title="Delete current frame group"
										className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
									>
										<X className="h-3 w-3" />
									</Button>
								)}
							</div>
						)}
					</div>
					<div className="p-3 grid grid-cols-2 gap-3">
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="width" className="text-xs whitespace-nowrap text-muted-foreground">
								Width
							</Label>
							<PropertyWithUndo property="width">
								<NumberInput
									min={1}
									max={128}
									id="width"
									value={draftItem.width}
									className="h-7 w-16 text-right"
									onChange={(val) => handlePropertyChange('width', val)}
								/>
							</PropertyWithUndo>
						</div>
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="height" className="text-xs whitespace-nowrap text-muted-foreground">
								Height
							</Label>
							<PropertyWithUndo property="height">
								<NumberInput
									min={1}
									max={128}
									id="height"
									value={draftItem.height}
									className="h-7 w-16 text-right"
									onChange={(val) => handlePropertyChange('height', val)}
								/>
							</PropertyWithUndo>
						</div>
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="crop-size" className="text-xs whitespace-nowrap text-muted-foreground">
								Exact Size
							</Label>
							<PropertyWithUndo property="exactSize">
								<NumberInput
									min={1}
									max={128}
									id="crop-size"
									value={draftItem.exactSize}
									className="h-7 w-16 text-right"
									onChange={(val) => handlePropertyChange('exactSize', val)}
								/>
							</PropertyWithUndo>
						</div>
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="frames" className="text-xs whitespace-nowrap text-muted-foreground">
								Frames
							</Label>
							<PropertyWithUndo property="frames">
								<NumberInput
									id="frames"
									value={draftItem.frames}
									className="h-7 w-16 text-right"
									onChange={(val) => handlePropertyChange('frames', val)}
								/>
							</PropertyWithUndo>
						</div>
					</div>
				</div>

				<div className="bg-secondary/20 rounded-md border border-border/40 overflow-hidden">
					<div className="flex items-center gap-1.5 px-3 py-2 bg-secondary/40 border-b border-border/30">
						<div className="w-0.5 h-3 bg-primary rounded-full" />
						<h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Pattern & Layers</h3>
					</div>
					<div className="p-3 grid grid-cols-2 gap-3">
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="pattern-x" className="text-xs whitespace-nowrap text-muted-foreground">
								Pattern X
							</Label>
							<PropertyWithUndo property="patternX">
								<NumberInput
									id="pattern-x"
									value={draftItem.patternX}
									className="h-7 w-16 text-right"
									onChange={(val) => handlePropertyChange('patternX', val)}
								/>
							</PropertyWithUndo>
						</div>
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="pattern-y" className="text-xs whitespace-nowrap text-muted-foreground">
								Pattern Y
							</Label>
							<PropertyWithUndo property="patternY">
								<NumberInput
									id="pattern-y"
									value={draftItem.patternY}
									className="h-7 w-16 text-right"
									onChange={(val) => handlePropertyChange('patternY', val)}
								/>
							</PropertyWithUndo>
						</div>
						{showPatternZ && (
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="pattern-z" className="text-xs whitespace-nowrap text-muted-foreground">
									Pattern Z
								</Label>
								<PropertyWithUndo property="patternZ">
									<NumberInput
										id="pattern-z"
										value={draftItem.patternZ}
										className="h-7 w-16 text-right"
										onChange={(val) => handlePropertyChange('patternZ', val)}
									/>
								</PropertyWithUndo>
							</div>
						)}
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="layers" className="text-xs whitespace-nowrap text-muted-foreground">
								Layers
							</Label>
							<PropertyWithUndo property="layers">
								<NumberInput
									min={1}
									max={128}
									id="layers"
									value={draftItem.layers}
									className="h-7 w-16 text-right"
									onChange={(val) => handlePropertyChange('layers', val)}
								/>
							</PropertyWithUndo>
						</div>
					</div>
				</div>

				<div className="bg-secondary/20 rounded-md border border-border/40 overflow-hidden">
					<div className="flex items-center gap-1.5 px-3 py-2 bg-secondary/40 border-b border-border/30">
						<div className="w-0.5 h-3 bg-primary rounded-full" />
						<h3 className="text-xs font-bold text-foreground uppercase tracking-wider">View Options</h3>
					</div>
					<div className="p-3 grid grid-cols-2 gap-3">
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="show-exact-size" className="text-xs whitespace-nowrap text-muted-foreground">
								Show Exact Size
							</Label>
							<Switch id="show-exact-size" checked={showExactSize} onCheckedChange={preview.setShowExactSize} />
						</div>
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="show-grid" className="text-xs whitespace-nowrap text-muted-foreground">
								Show Grid
							</Label>
							<Switch id="show-grid" checked={showGrid} onCheckedChange={preview.setShowGrid} />
						</div>
					</div>
				</div>
			</div>

			{!isOutfit && (
				<div className="@[820px]:col-span-2 @[1100px]:col-span-1">
					<div className="bg-secondary/20 rounded-md border border-border/40 overflow-hidden flex flex-col">
						<div className="flex items-center gap-1.5 px-3 py-2 bg-secondary/40 border-b border-border/30 flex-shrink-0">
							<div className="w-0.5 h-3 bg-primary rounded-full" />
							<h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Visuals</h3>
						</div>
						<div className="p-3 space-y-4 flex-1">
							<div>
								<div className="pb-1 mb-3 border-b border-border/30"></div>
								<div className="space-y-2 pl-1">
									<div className="flex items-center justify-between">
										<Label className="text-xs text-muted-foreground">Has Light</Label>
										<Switch
											checked={draftItem.hasLight}
											onCheckedChange={(checked) => handlePropertyChange('hasLight', checked)}
										/>
									</div>
									<div className="grid grid-cols-2 gap-2 pl-2 border-l-2 border-border/30">
										<div className="flex flex-col gap-1">
											<Label className="text-[10px] text-muted-foreground">Color</Label>
											<EightBitColorPicker
												className="w-full"
												disabled={!draftItem.hasLight}
												value={draftItem.lightColor || 0}
												onChange={(val) => handlePropertyChange('lightColor', val)}
											/>
										</div>
										<div className="flex flex-col gap-1">
											<Label className="text-[10px] text-muted-foreground">Intensity</Label>
											<PropertyWithUndo property="lightLevel">
												<NumberInput
													disabled={!draftItem.hasLight}
													value={draftItem.lightLevel || 0}
													className="h-7 w-full text-right"
													onChange={(val) => handlePropertyChange('lightLevel', val)}
												/>
											</PropertyWithUndo>
										</div>
									</div>
								</div>
							</div>

							{showDisplacement && (
								<div>
									<div className="pb-1 mb-3 border-b border-border/30"></div>
									<div className="space-y-2 pl-1">
										<div className="flex items-center justify-between">
											<Label className="text-xs text-muted-foreground">Has Offset</Label>
											<PropertyWithUndo property="hasOffset">
												<Switch
													checked={draftItem.hasOffset}
													onCheckedChange={(checked) => handlePropertyChange('hasOffset', checked)}
												/>
											</PropertyWithUndo>
										</div>
										<div className="grid grid-cols-2 gap-2 pl-2 border-l-2 border-border/30">
											<div className="flex items-center gap-1">
												<Label className="text-[10px] text-muted-foreground">X:</Label>
												<PropertyWithUndo property="offsetX">
													<NumberInput
														value={draftItem.offsetX || 0}
														disabled={!draftItem.hasOffset}
														className="h-7 w-full text-right"
														onChange={(val) => handlePropertyChange('offsetX', val)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center gap-1">
												<Label className="text-[10px] text-muted-foreground">Y:</Label>
												<PropertyWithUndo property="offsetY">
													<NumberInput
														value={draftItem.offsetY || 0}
														disabled={!draftItem.hasOffset}
														className="h-7 w-full text-right"
														onChange={(val) => handlePropertyChange('offsetY', val)}
													/>
												</PropertyWithUndo>
											</div>
										</div>
										{showDisplacementElevation && (
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Elevation</Label>
												<div className="flex items-center gap-2">
													<PropertyWithUndo property="elevation">
														<NumberInput
															className="h-7 w-16 text-right"
															value={draftItem.elevation || 0}
															disabled={!draftItem.hasElevation}
															onChange={(val) => handlePropertyChange('elevation', val)}
														/>
													</PropertyWithUndo>
													<PropertyWithUndo property="hasElevation">
														<Switch
															checked={draftItem.hasElevation}
															onCheckedChange={(checked) => handlePropertyChange('hasElevation', checked)}
														/>
													</PropertyWithUndo>
												</div>
											</div>
										)}
									</div>
								</div>
							)}

							{showMinimap && (
								<div>
									<div className="pb-1 mb-3 border-b border-border/30"></div>
									<div className="space-y-2 pl-1">
										<div className="flex items-center justify-between">
											<Label className="text-xs text-muted-foreground">Show on Minimap</Label>
											<PropertyWithUndo property="miniMap">
												<Switch
													checked={draftItem.miniMap}
													onCheckedChange={(checked) => handlePropertyChange('miniMap', checked)}
												/>
											</PropertyWithUndo>
										</div>
										<div className="flex items-center justify-between pl-2 border-l-2 border-border/30">
											<Label className="text-[10px] text-muted-foreground">Color</Label>
											<EightBitColorPicker
												disabled={!draftItem.miniMap}
												value={draftItem.miniMapColor || 0}
												onChange={(val) => handlePropertyChange('miniMapColor', val)}
											/>
										</div>
									</div>
								</div>
							)}

							{showAnimateAlways && (
								<div>
									<div className="pb-1 mb-3 border-b border-border/30"></div>
									<div className="space-y-2 pl-1">
										<div className="flex items-center justify-between">
											<Label className="text-xs text-muted-foreground">Animate Always</Label>
											<Switch
												checked={draftItem.animateAlways}
												onCheckedChange={(checked) => handlePropertyChange('animateAlways', checked)}
											/>
										</div>
									</div>
								</div>
							)}

							{isOutfit && draftItem && draftItem.layers > 1 && (
								<div>
									<div className="pb-1 mb-3 border-b border-border/30"></div>
									<div className="space-y-2 pl-1">
										<div className="grid grid-cols-2 gap-2">
											<div className="flex flex-col gap-1">
												<Label className="text-[10px] text-muted-foreground">Head</Label>
												<TibiaColorPicker
													className="w-full"
													value={outfitData.head}
													onChange={(val) => {
														const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
														setOutfitData({ ...outfitData, head: clampedVal });
													}}
												/>
											</div>
											<div className="flex flex-col gap-1">
												<Label className="text-[10px] text-muted-foreground">Body</Label>
												<TibiaColorPicker
													className="w-full"
													value={outfitData.body}
													onChange={(val) => {
														const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
														setOutfitData({ ...outfitData, body: clampedVal });
													}}
												/>
											</div>
											<div className="flex flex-col gap-1">
												<Label className="text-[10px] text-muted-foreground">Legs</Label>
												<TibiaColorPicker
													className="w-full"
													value={outfitData.legs}
													onChange={(val) => {
														const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
														setOutfitData({ ...outfitData, legs: clampedVal });
													}}
												/>
											</div>
											<div className="flex flex-col gap-1">
												<Label className="text-[10px] text-muted-foreground">Feet</Label>
												<TibiaColorPicker
													className="w-full"
													value={outfitData.feet}
													onChange={(val) => {
														const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
														setOutfitData({ ...outfitData, feet: clampedVal });
													}}
												/>
											</div>
										</div>
									</div>
								</div>
							)}

							{isOutfit && item && item.patternY > 1 && (
								<div>
									<div className="pb-1 mb-3 border-b border-border/30"></div>
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
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
};
