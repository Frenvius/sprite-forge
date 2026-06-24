import { useState, useEffect } from 'react';

import { Slider } from '~/components/ui/slider';
import { Switch } from '~/components/ui/switch';
import { useGeneralSettings } from '~/usecase/context/GeneralSettingsContext';
import { Dialog, DialogTitle, DialogHeader, DialogContent, DialogDescription } from '~/components/ui/dialog';

interface SettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const MIN = 25;
const MAX = 500;
const STEP = 25;

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
	const { settings, setSettings } = useGeneralSettings();
	const [objects, setObjects] = useState(settings.listAmountObjects);
	const [sprites, setSprites] = useState(settings.listAmountSprites);

	useEffect(() => {
		if (open) {
			setObjects(settings.listAmountObjects);
			setSprites(settings.listAmountSprites);
		}
	}, [open, settings.listAmountObjects, settings.listAmountSprites]);

	const commit = (next: { objects: number; sprites: number }) => {
		setSettings({
			...settings,
			listAmountObjects: next.objects,
			listAmountSprites: next.sprites
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px] gap-0 p-0 overflow-hidden">
				<DialogHeader className="space-y-1 px-6 pt-6 pb-4 border-b-0">
					<DialogTitle className="text-lg font-semibold tracking-tight">Settings</DialogTitle>
					<DialogDescription className="text-xs">Tweak how Sprite Forge loads and lists things.</DialogDescription>
				</DialogHeader>

				<div className="border-b border-border px-6">
					<div className="inline-flex h-9 items-center border-b-2 border-primary px-1 text-sm font-medium">General</div>
				</div>

				<div className="px-6 py-5 space-y-5">
					<section className="space-y-3">
						<h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">List Amount</h3>
						<div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
							<div className="flex items-center gap-3">
								<Slider
									min={MIN}
									max={MAX}
									step={STEP}
									value={[objects]}
									className="flex-1"
									onValueChange={(v) => setObjects(v[0])}
									onValueCommit={(v) => commit({ sprites, objects: v[0] })}
								/>
								<span className="w-10 text-right text-sm font-mono text-foreground">{objects}</span>
								<span className="w-14 text-xs text-primary">Objects</span>
							</div>
							<div className="flex items-center gap-3">
								<Slider
									min={MIN}
									max={MAX}
									step={STEP}
									value={[sprites]}
									className="flex-1"
									onValueChange={(v) => setSprites(v[0])}
									onValueCommit={(v) => commit({ objects, sprites: v[0] })}
								/>
								<span className="w-10 text-right text-sm font-mono text-foreground">{sprites}</span>
								<span className="w-14 text-xs text-primary">Sprites</span>
							</div>
						</div>
						<p className="text-[10px] text-muted-foreground">
							Items per page in the object and sprite lists. Affects pagination, prefetch, and scroll behavior.
						</p>
					</section>

					<section className="space-y-3">
						<h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preview</h3>
						<label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3 cursor-pointer">
							<div className="space-y-0.5">
								<div className="text-sm text-foreground">Auto-play animation</div>
								<div className="text-[10px] text-muted-foreground">Start animating when opening an animated object.</div>
							</div>
							<Switch
								checked={settings.autoPlayAnimation}
								onCheckedChange={(checked) => setSettings({ ...settings, autoPlayAnimation: checked })}
							/>
						</label>
					</section>

					<section className="space-y-3">
						<h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Saving</h3>
						<label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3 cursor-pointer">
							<div className="space-y-0.5">
								<div className="text-sm text-foreground">Back up files on save</div>
								<div className="text-[10px] text-muted-foreground">
									Copy the existing .dat/.spr to a timestamped .bak before overwriting.
								</div>
							</div>
							<Switch
								checked={settings.backupOnSave}
								onCheckedChange={(checked) => setSettings({ ...settings, backupOnSave: checked })}
							/>
						</label>
					</section>
				</div>
			</DialogContent>
		</Dialog>
	);
};
