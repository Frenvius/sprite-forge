import type { AssetInfo } from '@/usecase/hooks/useFolderSelectDialog';

export interface TibiaAssetPanelProps {
	info: AssetInfo;
	loading: boolean;
	extended: boolean;
	frameGroups: boolean;
	transparency: boolean;
	improvedAnimations: boolean;
	onExtendedChange: (v: boolean) => void;
	onFrameGroupsChange: (v: boolean) => void;
	onTransparencyChange: (v: boolean) => void;
	serverFiles?: { otb: boolean; xml: boolean };
	onImprovedAnimationsChange: (v: boolean) => void;
}
