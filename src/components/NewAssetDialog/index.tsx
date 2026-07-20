import React from 'react';
import { Sparkles } from 'lucide-react';

import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Button } from '~/components/ui/button';
import { allFormats, type FormatHandler } from '~/lib/formats/registry';
import { CLIENT_VERSIONS, type ClientVersion } from '~/lib/formats/tibia/types';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from '~/components/ui/select';
import { Dialog, DialogTitle, DialogFooter, DialogHeader, DialogContent, DialogDescription } from '~/components/ui/dialog';

export interface NewAssetOptions {
	formatId: string;
	extended: boolean;
	frameGroups: boolean;
	transparency: boolean;
	version: ClientVersion;
	improvedAnimations: boolean;
}

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (opts: NewAssetOptions) => void;
}

const DEFAULT_VERSION = CLIENT_VERSIONS[CLIENT_VERSIONS.length - 1];

export const NewAssetDialog = ({ open, onConfirm, onOpenChange }: Props) => {
	const formats = React.useMemo<FormatHandler[]>(() => allFormats(), [open]);
	const [formatId, setFormatId] = React.useState<string>(formats[0]?.id ?? 'tibia');
	const [version, setVersion] = React.useState<ClientVersion>(DEFAULT_VERSION);
	const [extended, setExtended] = React.useState(false);
	const [transparency, setTransparency] = React.useState(false);
	const [frameGroups, setFrameGroups] = React.useState(false);
	const [improvedAnimations, setImprovedAnimations] = React.useState(false);

	const isTibia = formatId === 'tibia';
	const selectedFormat = formats.find((f) => f.id === formatId);

	React.useEffect(() => {
		if (!open) return;
		const first = formats[0]?.id ?? 'tibia';
		setFormatId(first);
		setVersion(DEFAULT_VERSION);
		setExtended(DEFAULT_VERSION.supportsExtended);
		setFrameGroups(false);
		setTransparency(DEFAULT_VERSION.supportsAlphaChannel);
		setImprovedAnimations(DEFAULT_VERSION.supportsFrameDurations);
	}, [open, formats]);

	const handleVersionChange = (value: string) => {
		const v = CLIENT_VERSIONS.find((cv) => String(cv.value) === value);
		if (!v) return;
		setVersion(v);
		if (!v.supportsExtended) setExtended(false);
		if (!v.supportsAlphaChannel) setTransparency(false);
		if (!v.supportsFrameDurations) setImprovedAnimations(false);
	};

	const submit = () => {
		onConfirm({ version, formatId, extended, frameGroups, transparency, improvedAnimations });
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[420px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-primary" />
						Create Asset Files
					</DialogTitle>
					<DialogDescription>Configure a new empty project. You will choose where to save when you compile.</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{formats.length > 1 && (
						<div className="space-y-1.5">
							<Label className="text-xs">Format</Label>
							<Select value={formatId} onValueChange={setFormatId}>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{formats.map((f) => (
										<SelectItem key={f.id} value={f.id}>
											{f.config.name} (.{f.exts[0]})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{isTibia && (
						<div className="space-y-1.5">
							<Label className="text-xs">Version</Label>
							<Select value={String(version.value)} onValueChange={handleVersionChange}>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="max-h-72">
									{CLIENT_VERSIONS.map((cv) => (
										<SelectItem key={cv.value} value={String(cv.value)}>
											{cv.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					<div className="space-y-1.5">
						<Label className="text-xs">Sprite Dimension</Label>
						<Select disabled value={String(selectedFormat?.config.spriteSize ?? 32)}>
							<SelectTrigger className="h-8 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={String(selectedFormat?.config.spriteSize ?? 32)}>
									{selectedFormat?.config.spriteSize ?? 32}x{selectedFormat?.config.spriteSize ?? 32}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="grid grid-cols-2 gap-3 rounded-md border border-border/50 bg-secondary/30 p-3">
						{isTibia ? (
							<>
								<Toggle label="Extended" checked={extended} onChange={setExtended} disabled={!version.supportsExtended} />
								<Toggle
									label="Transparency"
									checked={transparency}
									onChange={setTransparency}
									disabled={!version.supportsAlphaChannel}
								/>
								<Toggle
									label="Improved animations"
									checked={improvedAnimations}
									onChange={setImprovedAnimations}
									disabled={!version.supportsFrameDurations}
								/>
								<Toggle label="Frame Groups" checked={frameGroups} onChange={setFrameGroups} />
							</>
						) : (
							!selectedFormat?.alphaChannel && <Toggle label="Transparency" checked={transparency} onChange={setTransparency} />
						)}
					</div>
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={submit}>Confirm</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

const Toggle = ({
	label,
	checked,
	onChange,
	disabled
}: {
	label: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (v: boolean) => void;
}) => (
	<label className="flex items-center gap-2 text-xs">
		<Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
		<span className={disabled ? 'text-muted-foreground' : ''}>{label}</span>
	</label>
);
