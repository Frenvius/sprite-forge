import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { usePanelSettings } from '~/usecase/context/PanelSettingsContext';
import { Dialog, DialogTitle, DialogHeader, DialogContent } from '~/components/ui/dialog';

interface PanelSettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const PanelSettingsDialog = ({ open, onOpenChange }: PanelSettingsDialogProps) => {
	const { settings, togglePanel } = usePanelSettings();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Panel Settings</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="flex items-center justify-between">
						<Label className="text-sm" htmlFor="visualization">
							Show Visualization Panel
						</Label>
						<Switch
							id="visualization"
							checked={settings.showVisualization}
							onCheckedChange={() => togglePanel('showVisualization')}
						/>
					</div>
					<div className="flex items-center justify-between">
						<Label className="text-sm" htmlFor="opened-items">
							Show Opened Items Panel
						</Label>
						<Switch id="opened-items" checked={settings.showOpenedItems} onCheckedChange={() => togglePanel('showOpenedItems')} />
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
