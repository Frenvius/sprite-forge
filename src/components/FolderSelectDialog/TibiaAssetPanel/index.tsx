import type { TibiaAssetPanelProps } from './types';

import { formatSignature } from '@/usecase/util/fileBrowserUtils';
import { Info, Image, Package, Loader2, Settings, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';

export const TibiaAssetPanel = ({
	info,
	loading,
	extended,
	serverFiles,
	frameGroups,
	transparency,
	onExtendedChange,
	improvedAnimations,
	onFrameGroupsChange,
	onTransparencyChange,
	onImprovedAnimationsChange
}: TibiaAssetPanelProps) => {
	return (
		<div className="fb-asset-panel">
			<div className="fb-asset-header">
				<Package size={15} className="fb-asset-header-icon" />
				<h3 className="fb-asset-header-title">Asset Information</h3>
			</div>
			<div className="fb-asset-row">
				<div className="fb-asset-field">
					<Label className="fb-asset-label">
						<Info size={13} className="fb-asset-label-icon" />
						Version
					</Label>
					<div className="fb-asset-value">
						{loading ? (
							<span className="fb-asset-value-muted">
								<Loader2 size={12} className="fb-spin" />
								Detecting…
							</span>
						) : info.version ? (
							<span className="fb-asset-value-ok">
								<CheckCircle2 size={13} />
								{info.version.label}
							</span>
						) : (
							<span className="fb-asset-value-muted">Unknown</span>
						)}
					</div>
				</div>
				<div className="fb-asset-field">
					<Label className="fb-asset-label">Sprite Dimension</Label>
					<div className="fb-asset-value">
						<span>32×32</span>
					</div>
				</div>
			</div>

			<div className="fb-asset-field">
				<Label className="fb-asset-label">
					<Settings size={13} className="fb-asset-label-icon" />
					Options
					{!loading && info.otfi && (
						<span className="fb-asset-otfi-badge">
							<FileText size={11} />
							from OTFI
						</span>
					)}
				</Label>
				<div className="fb-asset-options">
					<label className="fb-asset-toggle">
						<span>Extended</span>
						<Switch checked={extended} disabled={loading} className="scale-75" onCheckedChange={onExtendedChange} />
					</label>
					<label className="fb-asset-toggle">
						<span>Transparency</span>
						<Switch disabled={loading} className="scale-75" checked={transparency} onCheckedChange={onTransparencyChange} />
					</label>
					<label className="fb-asset-toggle">
						<span>Improved animations</span>
						<Switch
							disabled={loading}
							className="scale-75"
							checked={improvedAnimations}
							onCheckedChange={onImprovedAnimationsChange}
						/>
					</label>
					<label className="fb-asset-toggle">
						<span>Frame Groups</span>
						<Switch disabled={loading} className="scale-75" checked={frameGroups} onCheckedChange={onFrameGroupsChange} />
					</label>
				</div>
			</div>

			<div className="fb-asset-row">
				<div className="fb-asset-card">
					<Label className="fb-asset-label fb-asset-card-label">
						<span className="fb-asset-card-title">
							<Package size={13} className="fb-asset-label-icon" />
							DAT File
						</span>
						{!loading && info.datHeader && (
							<span className="fb-asset-value-ok">
								<CheckCircle2 size={12} />
								Valid
							</span>
						)}
					</Label>
					<div className="fb-asset-card-body">
						{loading ? (
							<span className="fb-asset-value-muted">
								<Loader2 size={13} className="fb-spin" />
								Reading…
							</span>
						) : info.datHeader ? (
							<dl className="fb-asset-stats">
								<dt>Signature:</dt>
								<dd className="fb-asset-stat-primary font-mono">{formatSignature(info.datHeader.signature)}</dd>
								<dt>Items:</dt>
								<dd className="font-mono">{info.datHeader.itemsCount.toLocaleString()}</dd>
								<dt>Outfits:</dt>
								<dd className="font-mono">{info.datHeader.outfitsCount.toLocaleString()}</dd>
								<dt>Effects:</dt>
								<dd className="font-mono">{info.datHeader.effectsCount.toLocaleString()}</dd>
								<dt>Missiles:</dt>
								<dd className="font-mono">{info.datHeader.missilesCount.toLocaleString()}</dd>
							</dl>
						) : (
							<span className="fb-asset-value-error">
								<AlertCircle size={13} />
								{info.error || 'Not found'}
							</span>
						)}
					</div>
				</div>
				<div className="fb-asset-card">
					<Label className="fb-asset-label fb-asset-card-label">
						<span className="fb-asset-card-title">
							<Image size={13} className="fb-asset-label-icon" />
							SPR File
						</span>
						{!loading && info.sprHeader && (
							<span className="fb-asset-value-ok">
								<CheckCircle2 size={12} />
								Valid
							</span>
						)}
					</Label>
					<div className="fb-asset-card-body">
						{loading ? (
							<span className="fb-asset-value-muted">
								<Loader2 size={13} className="fb-spin" />
								Reading…
							</span>
						) : info.sprHeader ? (
							<dl className="fb-asset-stats">
								<dt>Signature:</dt>
								<dd className="fb-asset-stat-primary font-mono">{formatSignature(info.sprHeader.signature)}</dd>
								<dt>Sprites:</dt>
								<dd className="font-mono">{info.sprHeader.spriteCount.toLocaleString()}</dd>
							</dl>
						) : (
							<span className="fb-asset-value-error">
								<AlertCircle size={13} />
								{info.error || 'Not found'}
							</span>
						)}
					</div>
				</div>
			</div>

			{serverFiles && (serverFiles.otb || serverFiles.xml) && (
				<div className="fb-asset-field">
					<Label className="fb-asset-label">
						<Package size={13} className="fb-asset-label-icon" />
						Server Items
					</Label>
					<div className="fb-asset-options">
						<label className="fb-asset-toggle">
							<span>items.otb</span>
							<span className={serverFiles.otb ? 'fb-asset-value-ok' : 'fb-asset-value-muted'}>
								{serverFiles.otb ? <CheckCircle2 size={13} /> : '-'}
								{serverFiles.otb ? 'Found' : 'Not found'}
							</span>
						</label>
						<label className="fb-asset-toggle">
							<span>items.xml</span>
							<span className={serverFiles.xml ? 'fb-asset-value-ok' : 'fb-asset-value-muted'}>
								{serverFiles.xml ? <CheckCircle2 size={13} /> : '-'}
								{serverFiles.xml ? 'Found' : 'Not found'}
							</span>
						</label>
					</div>
				</div>
			)}
		</div>
	);
};
