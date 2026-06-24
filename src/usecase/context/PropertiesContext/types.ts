import type { ThingType } from '~/lib/formats/tibia';

export interface OutfitData {
	head: number;
	body: number;
	legs: number;
	feet: number;
	addons: boolean[];
}

export interface Visibility {
	isItem: boolean;
	isOutfit: boolean;
	isMissile: boolean;
	showHooks: boolean;
	showMarket: boolean;
	showUsable: boolean;
	showMinimap: boolean;
	showWriting: boolean;
	showPatternZ: boolean;
	showHangable: boolean;
	showDontHide: boolean;
	showLensHelp: boolean;
	showEquipment: boolean;
	showWrappable: boolean;
	showTopEffect: boolean;
	showIgnoreLook: boolean;
	showHasCharges: boolean;
	showFloorChange: boolean;
	showTranslucent: boolean;
	showInteraction: boolean;
	showGroundBorder: boolean;
	showDisplacement: boolean;
	showPhysicsGround: boolean;
	showLayerPosition: boolean;
	showAnimateAlways: boolean;
	showDefaultActions: boolean;
	supportsFrameGroups: boolean;
	showNoMoveAnimation: boolean;
	showAnimationProperties: boolean;
	showDisplacementElevation: boolean;
}

export interface PropertiesContextValue extends Visibility {
	item: ThingType;
	draftItem: ThingType;
	outfitData: OutfitData;
	handleResetSprites: () => void;
	handleRandomizeColors: () => void;
	handleUndoProperty: (property: string) => void;
	hasPropertyChanged: (property: string) => boolean;
	handlePropertyChange: (property: string, value: any) => void;
	setOutfitData: React.Dispatch<React.SetStateAction<OutfitData>>;
}
