import type { AssetInfo } from '@/usecase/hooks/useFolderSelectDialog';

export interface TibiaAssetPanelProps {
	info: AssetInfo;
	loading: boolean;
	extended: boolean;
	frameGroups: boolean;
	transparency: boolean;
	includeServer: boolean;
	onBrowseOtb: () => void;
	improvedAnimations: boolean;
	onExtendedChange: (v: boolean) => void;
	onFrameGroupsChange: (v: boolean) => void;
	onTransparencyChange: (v: boolean) => void;
	onIncludeServerChange: (v: boolean) => void;
	onImprovedAnimationsChange: (v: boolean) => void;
	serverOtb: null | { label: string; custom: boolean; xmlFound: boolean };
}
