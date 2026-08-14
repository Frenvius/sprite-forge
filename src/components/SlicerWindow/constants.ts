import { DockLayout, registerExtraPanels } from '~/usecase/util/dock';

registerExtraPanels([
	{ title: 'Grid', id: 'slicerGrid' },
	{ title: 'Sprites', id: 'slicerSprites' },
	{ title: 'Layers', id: 'slicerLayers' }
]);

export const SLICER_PANEL_IDS = ['slicerGrid', 'slicerSprites', 'slicerLayers'];

export const SLICER_DOCK_STORAGE_KEY = 'sprite-forge-slicer-dock';

export const SLICER_DOCK_DEFAULT: DockLayout = {
	top: [],
	left: [],
	float: {},
	bottom: [],
	width: { slicerGrid: 240 },
	height: { slicerGrid: 70, slicerSprites: 280 },
	right: [['slicerGrid', 'slicerSprites', 'slicerLayers']]
};
