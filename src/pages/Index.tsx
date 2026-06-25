import { PanelId } from '~/usecase/util/dock';
import { Toolbar } from '~/components/Toolbar';
import { useDock } from '~/usecase/hooks/useDock';
import { Workspace } from '~/components/Workspace';
import { DragHandleProps } from '~/usecase/util/dock';
import { ItemList } from '~/components/Panels/ItemList';
import { useTheme } from '~/usecase/context/ThemeContext';
import { SpriteList } from '~/components/Panels/SpriteList';
import { PropertiesPanel } from '~/components/PropertiesPanel';
import { OpenedItemsPanel } from '~/components/OpenedItemsPanel';
import { VisualizationPanel } from '~/components/VisualizationPanel';
import { usePanelSettings } from '~/usecase/context/PanelSettingsContext';

const Index = () => {
	const { settings } = usePanelSettings();
	const { acrylic, isWindows } = useTheme();

	const isMac = navigator.userAgent.includes('Mac');
	const transparentRoot = (isWindows && acrylic) || isMac;

	const isContentReady = (id: PanelId) => {
		if (id === 'visualization') return settings.showVisualization;
		if (id === 'openedItems') return settings.showOpenedItems;
		return true;
	};

	const dock = useDock(isContentReady);

	const renderPanel = (id: PanelId, handle?: DragHandleProps) => {
		if (id === 'visualization') return <VisualizationPanel dragHandle={handle} />;
		if (id === 'openedItems') return <OpenedItemsPanel dragHandle={handle} />;
		if (id === 'itemList') return <ItemList dragHandle={handle} />;
		if (id === 'spriteList') return <SpriteList dragHandle={handle} />;
		return null;
	};

	return (
		<div
			className={`h-screen flex flex-col ${transparentRoot ? 'bg-transparent' : 'bg-background'} ${isMac ? 'rounded-xl overflow-hidden border border-white/10 shadow-2xl' : ''}`}
		>
			<Toolbar />

			<Workspace dock={dock} renderPanel={renderPanel}>
				<PropertiesPanel />
			</Workspace>
		</div>
	);
};

export default Index;
