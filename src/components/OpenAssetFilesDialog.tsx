import { useState, useEffect } from 'react';
import { join } from '@tauri-apps/api/path';
import { X, Info, Image, Loader2, Package, Settings, FileText, FolderOpen, AlertCircle, CheckCircle2 } from 'lucide-react';

import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Dialog, DialogTitle, DialogContent, DialogDescription } from './ui/dialog';
import {
	readOtfiFile,
	readDatHeader,
	readSprHeader,
	ClientVersion,
	type OtfiData,
	type DatHeader,
	type SprHeader
} from '~/lib/formats/tibia';

export interface LoadOptions {
	extended: boolean;
	folderPath: string;
	frameGroups: boolean;
	transparency: boolean;
	improvedAnimations: boolean;
}

interface OpenAssetFilesDialogProps {
	open: boolean;
	initialPath: string;
	onBrowse: () => void;
	onOpenChange: (open: boolean) => void;
	onLoad: (options: LoadOptions) => void;
}

interface FileInfo {
	error: null | string;
	otfi: null | OtfiData;
	datHeader: null | DatHeader;
	sprHeader: null | SprHeader;
	version: null | ClientVersion;
}

export const OpenAssetFilesDialog = ({ open, onLoad, onBrowse, initialPath, onOpenChange }: OpenAssetFilesDialogProps) => {
	const [loading, setLoading] = useState(false);
	const [fileInfo, setFileInfo] = useState<FileInfo>({
		otfi: null,
		error: null,
		version: null,
		datHeader: null,
		sprHeader: null
	});

	// Options state (initialized from detected version)
	const [extended, setExtended] = useState(false);
	const [transparency, setTransparency] = useState(false);
	const [improvedAnimations, setImprovedAnimations] = useState(false);
	const [frameGroups, setFrameGroups] = useState(false);

	// Detect file info when path changes
	useEffect(() => {
		if (open && initialPath) {
			detectFileInfo(initialPath);
		}
	}, [open, initialPath]);

	const detectFileInfo = async (folderPath: string) => {
		setLoading(true);
		setFileInfo({ otfi: null, error: null, version: null, datHeader: null, sprHeader: null });

		try {
			const datPath = await join(folderPath, 'Tibia.dat');
			const sprPath = await join(folderPath, 'Tibia.spr');

			// Read all files in parallel
			const [datHeader, sprHeaderResult, otfi] = await Promise.all([
				readDatHeader(datPath),
				readSprHeader(sprPath),
				readOtfiFile(folderPath) // Searches for Tibia.otfi or Tibia.dat.otfi
			]);

			const sprHeader: SprHeader = {
				extended: sprHeaderResult.extended,
				signature: sprHeaderResult.signature,
				spriteCount: sprHeaderResult.spriteCount ?? (sprHeaderResult as any).sprite_count
			};

			const version = datHeader.version;

			setFileInfo({
				otfi,
				version,
				datHeader,
				sprHeader,
				error: null
			});

			// Initialize options - prefer OTFI values, fall back to version detection
			if (otfi) {
				// Use OTFI values (from .otfi file)
				setExtended(otfi.extended);
				setTransparency(otfi.transparency);
				setImprovedAnimations(otfi.frameDurations);
				setFrameGroups(otfi.frameGroups);
			} else if (version) {
				// Fall back to version-based detection
				setExtended(version.supportsExtended);
				setTransparency(version.supportsAlphaChannel);
				setImprovedAnimations(version.supportsFrameDurations);
				setFrameGroups(version.supportsFrameDurations);
			}
		} catch (err) {
			setFileInfo({
				otfi: null,
				version: null,
				datHeader: null,
				sprHeader: null,
				error: err instanceof Error ? err.message : 'Failed to read file headers'
			});
		} finally {
			setLoading(false);
		}
	};

	const handleLoad = () => {
		onLoad({
			extended,
			frameGroups,
			transparency,
			improvedAnimations,
			folderPath: initialPath
		});
	};

	const formatSignature = (sig: number) => {
		return sig.toString(16).toUpperCase();
	};

	const canLoad = fileInfo.datHeader && fileInfo.sprHeader && !loading;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[614px] p-0 gap-0 flex flex-col [&>button]:hidden overflow-hidden">
				<DialogTitle className="sr-only">Open Asset Files</DialogTitle>
				<DialogDescription className="sr-only">Configure options for loading Tibia asset files</DialogDescription>

				{/* Header */}
				<div className="border-b border-border px-4 py-2.5 flex items-center justify-between bg-card/50">
					<div className="flex items-center gap-2.5">
						<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
							<FolderOpen className="h-4 w-4 text-primary" />
						</div>
						<h2 className="text-base font-semibold">Open Asset Files</h2>
					</div>
					<button
						onClick={() => onOpenChange(false)}
						className="w-7 h-7 flex items-center justify-center hover:bg-accent rounded-md transition-colors"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				</div>

				{/* Content */}
				<div className="p-4 space-y-3 overflow-y-auto">
					{/* Client Folder */}
					<div className="space-y-1.5">
						<Label className="text-xs font-medium flex items-center gap-1.5">
							<FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
							Client Folder
						</Label>
						<div className="flex gap-2">
							<Input readOnly value={initialPath} className="flex-1 h-8 !text-[12px] font-mono bg-muted/30 border-border/50" />
							<Button size="sm" variant="outline" onClick={onBrowse} className="h-8 px-3 text-xs">
								Browse
							</Button>
						</div>
					</div>

					{/* Version & Info */}
					<div className="grid grid-cols-2 gap-3 items-start">
						<div className="space-y-1.5">
							<Label className="text-xs font-medium flex items-center gap-1.5 h-[18px]">
								<Info className="h-3.5 w-3.5 text-muted-foreground" />
								Version
							</Label>
							<div className="px-2.5 py-1.5 rounded-md bg-muted/30 border border-border/50 h-[30px] flex items-center">
								{loading ? (
									<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
										<Loader2 className="h-3 w-3 animate-spin" />
										<span>Detecting...</span>
									</div>
								) : fileInfo.version ? (
									<div className="flex items-center gap-1.5">
										<CheckCircle2 className="h-3.5 w-3.5 text-primary" />
										<span className="text-xs font-medium">{fileInfo.version.label}</span>
									</div>
								) : (
									<span className="text-xs text-muted-foreground">Unknown</span>
								)}
							</div>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-medium h-[18px] flex items-center">Sprite Dimension</Label>
							<div className="px-2.5 py-1.5 rounded-md bg-muted/30 border border-border/50 h-[30px] flex items-center">
								<span className="text-xs font-medium">32×32</span>
							</div>
						</div>
					</div>

					{/* Options */}
					<div className="space-y-2">
						<Label className="text-xs font-medium flex items-center gap-1.5">
							<Settings className="h-3.5 w-3.5 text-muted-foreground" />
							Options
							{!loading && fileInfo.otfi && (
								<span className="ml-auto flex items-center gap-1 text-[10px] font-normal text-primary">
									<FileText className="h-3 w-3" />
									from OTFI
								</span>
							)}
						</Label>
						<div className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-2.5 rounded-lg bg-muted/20 border border-border/50">
							<div className="flex items-center justify-between">
								<Label htmlFor="extended" className="text-xs font-normal cursor-pointer">
									Extended
								</Label>
								<Switch id="extended" checked={extended} disabled={loading} className="scale-75" onCheckedChange={setExtended} />
							</div>
							<div className="flex items-center justify-between">
								<Label htmlFor="transparency" className="text-xs font-normal cursor-pointer">
									Transparency
								</Label>
								<Switch
									id="transparency"
									disabled={loading}
									className="scale-75"
									checked={transparency}
									onCheckedChange={setTransparency}
								/>
							</div>
							<div className="flex items-center justify-between">
								<Label htmlFor="improvedAnimations" className="text-xs font-normal cursor-pointer">
									Improved animations
								</Label>
								<Switch
									disabled={loading}
									className="scale-75"
									id="improvedAnimations"
									checked={improvedAnimations}
									onCheckedChange={setImprovedAnimations}
								/>
							</div>
							<div className="flex items-center justify-between">
								<Label htmlFor="frameGroups" className="text-xs font-normal cursor-pointer">
									Frame Groups
								</Label>
								<Switch
									id="frameGroups"
									disabled={loading}
									className="scale-75"
									checked={frameGroups}
									onCheckedChange={setFrameGroups}
								/>
							</div>
						</div>
					</div>

					{/* File Info Cards */}
					<div className="grid grid-cols-2 gap-3">
						{/* DAT Info */}
						<div className="space-y-1.5 flex flex-col">
							<Label className="text-xs font-medium flex items-center justify-between">
								<div className="flex items-center gap-1.5">
									<Package className="h-3.5 w-3.5 text-muted-foreground" />
									DAT File
								</div>
								{!loading && fileInfo.datHeader && (
									<div className="flex items-center gap-1.5">
										<CheckCircle2 className="h-3 w-3 text-primary" />
										<span className="text-xs font-medium text-primary">Valid</span>
									</div>
								)}
							</Label>
							<div className="p-2.5 rounded-lg bg-muted/20 border border-border/50 flex-1 flex flex-col">
								{loading ? (
									<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
										<span>Reading...</span>
									</div>
								) : fileInfo.datHeader ? (
									<div className="space-y-1 text-xs flex-1">
										<div className="flex justify-between">
											<span className="text-muted-foreground">Signature:</span>
											<span className="font-mono text-primary font-medium">{formatSignature(fileInfo.datHeader.signature)}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Items:</span>
											<span className="font-mono text-foreground font-medium">
												{fileInfo.datHeader.itemsCount.toLocaleString()}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Outfits:</span>
											<span className="font-mono text-foreground font-medium">
												{fileInfo.datHeader.outfitsCount.toLocaleString()}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Effects:</span>
											<span className="font-mono text-foreground font-medium">
												{fileInfo.datHeader.effectsCount.toLocaleString()}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Missiles:</span>
											<span className="font-mono text-foreground font-medium">
												{fileInfo.datHeader.missilesCount.toLocaleString()}
											</span>
										</div>
									</div>
								) : (
									<div className="flex items-center gap-1.5 text-xs text-destructive">
										<AlertCircle className="h-3.5 w-3.5" />
										<span>{fileInfo.error || 'Not found'}</span>
									</div>
								)}
							</div>
						</div>

						{/* SPR Info */}
						<div className="space-y-1.5 flex flex-col">
							<Label className="text-xs font-medium flex items-center justify-between">
								<div className="flex items-center gap-1.5">
									<Image className="h-3.5 w-3.5 text-muted-foreground" />
									SPR File
								</div>
								{!loading && fileInfo.sprHeader && (
									<div className="flex items-center gap-1.5">
										<CheckCircle2 className="h-3 w-3 text-primary" />
										<span className="text-xs font-medium text-primary">Valid</span>
									</div>
								)}
							</Label>
							<div className="p-2.5 rounded-lg bg-muted/20 border border-border/50 flex-1 flex flex-col">
								{loading ? (
									<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
										<span>Reading...</span>
									</div>
								) : fileInfo.sprHeader ? (
									<div className="space-y-1 text-xs flex-1">
										<div className="flex justify-between">
											<span className="text-muted-foreground">Signature:</span>
											<span className="font-mono text-primary font-medium">{formatSignature(fileInfo.sprHeader.signature)}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Sprites:</span>
											<span className="font-mono text-foreground font-medium">
												{fileInfo.sprHeader.spriteCount.toLocaleString()}
											</span>
										</div>
									</div>
								) : (
									<div className="flex items-center gap-1.5 text-xs text-destructive">
										<AlertCircle className="h-3.5 w-3.5" />
										<span>{fileInfo.error || 'Not found'}</span>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="border-t border-border px-4 py-2.5 flex items-center justify-end gap-2 bg-card/50">
					<Button size="sm" variant="outline" className="!h-8 px-3 text-xs" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button size="sm" disabled={!canLoad} onClick={handleLoad} className="!h-8 px-3 text-xs min-w-[80px]">
						{loading ? (
							<>
								<Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
								Reading...
							</>
						) : (
							'Load'
						)}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
