import type { TibiaAssetPanelProps } from './types';

import { useState } from 'react';
import {
	Info,
	Image,
	Package,
	Loader2,
	XCircle,
	Settings,
	FileText,
	FolderOpen,
	AlertCircle,
	ChevronDown,
	CheckCircle2
} from 'lucide-react';

import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { formatSignature } from '~/usecase/util/fileBrowserUtils';

export const TibiaAssetPanel = ({
	info,
	loading,
	extended,
	serverOtb,
	onBrowseOtb,
	frameGroups,
	transparency,
	includeServer,
	onExtendedChange,
	improvedAnimations,
	onFrameGroupsChange,
	onTransparencyChange,
	onIncludeServerChange,
	onImprovedAnimationsChange
}: TibiaAssetPanelProps) => {
	const [datOpen, setDatOpen] = useState(false);
	const [sprOpen, setSprOpen] = useState(false);

	return (
		<div className="fb-asset-panel">
			<div className="fb-asset-header">
				<Package size={15} className="fb-asset-header-icon" />
				<h3 className="fb-asset-header-title">Asset Information</h3>
			</div>
			<div className="fb-asset-scroll">
				<div className="fb-asset-row fb-asset-row-split">
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
						<button
							type="button"
							onClick={() => setDatOpen((o) => !o)}
							className="fb-asset-label fb-asset-card-label fb-asset-card-toggle"
						>
							<span className="fb-asset-card-title">
								<ChevronDown size={13} className={'fb-asset-card-chevron' + (datOpen ? '' : ' fb-collapsed')} />
								<Package size={13} className="fb-asset-label-icon" />
								DAT File
							</span>
							{!loading && info.datHeader && (
								<span className="fb-asset-value-ok">
									<CheckCircle2 size={12} />
									Valid
								</span>
							)}
						</button>
						{datOpen && (
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
						)}
					</div>
					<div className="fb-asset-card">
						<button
							type="button"
							onClick={() => setSprOpen((o) => !o)}
							className="fb-asset-label fb-asset-card-label fb-asset-card-toggle"
						>
							<span className="fb-asset-card-title">
								<ChevronDown size={13} className={'fb-asset-card-chevron' + (sprOpen ? '' : ' fb-collapsed')} />
								<Image size={13} className="fb-asset-label-icon" />
								SPR File
							</span>
							{!loading && info.sprHeader && (
								<span className="fb-asset-value-ok">
									<CheckCircle2 size={12} />
									Valid
								</span>
							)}
						</button>
						{sprOpen && (
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
						)}
					</div>
				</div>

				<div className="fb-asset-field">
					<Label className="fb-asset-label">
						<Package size={13} className="fb-asset-label-icon" />
						Server Items
						<span className="fb-asset-otfi-badge">optional</span>
					</Label>
					<div className="fb-server-box">
						{serverOtb ? (
							<>
								<label title={serverOtb.label} className="fb-asset-toggle">
									<span>Include items.otb</span>
									<Switch className="scale-75" checked={includeServer} onCheckedChange={onIncludeServerChange} />
								</label>
								<div className="fb-server-files">
									<div className="fb-asset-toggle">
										<span>items.otb</span>
										<span className="fb-asset-value-ok">
											<CheckCircle2 size={14} />
										</span>
									</div>
									<div className="fb-asset-toggle">
										<span>items.xml</span>
										<span className={serverOtb.xmlFound ? 'fb-asset-value-ok' : 'fb-asset-value-muted'}>
											{serverOtb.xmlFound ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
										</span>
									</div>
								</div>
								<button type="button" onClick={onBrowseOtb} className="fb-asset-otb-browse">
									<FolderOpen size={13} />
									Choose a different file…
								</button>
							</>
						) : (
							<>
								<span className="fb-server-empty">No items.otb linked.</span>
								<button type="button" onClick={onBrowseOtb} className="fb-asset-otb-browse">
									<FolderOpen size={13} />
									Browse for items.otb…
								</button>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
