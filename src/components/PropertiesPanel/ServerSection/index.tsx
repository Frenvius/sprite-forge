import type { XmlAttr, ServerItem } from '~/lib/formats/tibia';

import { useState } from 'react';
import { Trash2, Server } from 'lucide-react';

import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { AddAttributesPopover } from './AddAttributesPopover';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { defaultValueFor, getServerProfile, getServerProfiles } from '~/lib/formats/tibia';
import { type AttrRowProps, type ServerSectionProps, type ServerItemEditorProps } from './types';
import { NO_ARTICLE, TYPE_OPTIONS, SYNCED_FLAGS, STACK_OPTIONS, SYNCED_NUMBERS } from './constants';
import { Select, SelectItem, SelectValue, SelectTrigger, SelectContent } from '~/components/ui/select';

const labelCls = 'text-[11px] text-muted-foreground';
const inputCls = 'h-7 text-xs';

const isTrue = (v: string) => v === '1' || v.toLowerCase() === 'true';

const AttrRow = ({ def, attr, onChange, onRemove }: AttrRowProps) => {
	const nested = !!attr.children && attr.children.length > 0;
	const type = def?.type ?? 'string';

	let control;
	if (nested) {
		control = <Input disabled value="(nested)" className="h-7 text-xs flex-1" />;
	} else if (def?.values && def.values.length > 0) {
		control = (
			<Select value={attr.value} onValueChange={onChange}>
				<SelectTrigger className="h-7 text-xs flex-1">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{def.values.map((v) => (
						<SelectItem key={v} value={v} className="text-xs">
							{v}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	} else if (type === 'boolean') {
		control = (
			<div className="flex-1 flex items-center">
				<Switch className="scale-75" checked={isTrue(attr.value)} onCheckedChange={(c) => onChange(c ? '1' : '0')} />
			</div>
		);
	} else {
		control = (
			<Input
				value={attr.value}
				className="h-7 text-xs flex-1"
				onChange={(e) => onChange(e.target.value)}
				type={type === 'number' ? 'number' : 'text'}
			/>
		);
	}

	return (
		<div className="flex items-center gap-1.5">
			<span title={attr.key} className="text-[11px] text-foreground w-28 flex-shrink-0 truncate">
				{attr.key}
			</span>
			{control}
			<Button
				size="icon"
				variant="ghost"
				onClick={onRemove}
				className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
			>
				<Trash2 className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
};

const ServerItemEditor = ({ item, profile, autoSync, onChange }: ServerItemEditorProps) => {
	const set = (updates: Partial<ServerItem>) => onChange(item.serverId, updates);
	const num = (v: string) => {
		const n = parseInt(v, 10);
		return Number.isNaN(n) ? 0 : n;
	};

	const attrs = item.xmlAttributes ?? [];
	const usedKeys = new Set(attrs.map((a) => a.key));

	const descIndex = attrs.findIndex((a) => a.key === 'description');
	const description = descIndex >= 0 ? attrs[descIndex].value : '';
	const setDescription = (value: string) => {
		if (descIndex >= 0) {
			if (value === '') {
				const next = attrs.filter((_, i) => i !== descIndex);
				set({ xmlAttributes: next.length > 0 ? next : undefined });
			} else {
				set({ xmlAttributes: attrs.map((a, i) => (i === descIndex ? { ...a, value } : a)) });
			}
		} else if (value !== '') {
			set({ xmlAttributes: [...attrs, { value, key: 'description' }] });
		}
	};

	const updateAttr = (index: number, value: string) => {
		set({ xmlAttributes: attrs.map((a, i) => (i === index ? { ...a, value } : a)) });
	};
	const removeAttr = (index: number) => {
		const next = attrs.filter((_, i) => i !== index);
		set({ xmlAttributes: next.length > 0 ? next : undefined });
	};
	const addAttrs = (keys: string[]) => {
		const entries = keys.map((key) => {
			const def = profile.byKey.get(key);
			const entry: XmlAttr = { key, value: def ? defaultValueFor(def) : '' };
			if (def?.tag) entry.tag = true;
			return entry;
		});
		set({ xmlAttributes: [...attrs, ...entries] });
	};

	return (
		<div className="rounded-md border border-border/50 p-3 space-y-3 bg-secondary/20">
			<div className="flex items-end gap-2">
				<div className="space-y-1 flex-shrink-0">
					<Label className={labelCls}>Server</Label>
					<div className="h-7 w-16 px-2 flex items-center text-xs font-mono rounded-md bg-muted/50 border border-border/40 text-muted-foreground">
						{item.serverId}
					</div>
				</div>
				<div className="space-y-1 flex-shrink-0">
					<Label className={labelCls}>Client</Label>
					<Input
						type="number"
						value={item.clientId}
						className="h-7 text-xs w-16"
						onChange={(e) => set({ clientId: num(e.target.value) })}
					/>
				</div>
				<div className="space-y-1 flex-shrink-0">
					<Label className={labelCls}>Article</Label>
					<Select
						onValueChange={(v) => set({ article: v === NO_ARTICLE ? undefined : v })}
						value={item.article && item.article.length > 0 ? item.article : NO_ARTICLE}
					>
						<SelectTrigger className="h-7 text-xs w-16">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NO_ARTICLE} className="text-xs">
								(none)
							</SelectItem>
							<SelectItem value="a" className="text-xs">
								a
							</SelectItem>
							<SelectItem value="an" className="text-xs">
								an
							</SelectItem>
							{item.article && item.article !== 'a' && item.article !== 'an' && (
								<SelectItem className="text-xs" value={item.article}>
									{item.article}
								</SelectItem>
							)}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1 flex-1 min-w-0">
					<Label className={labelCls}>Name</Label>
					<Input className={inputCls} value={item.nameXml ?? ''} onChange={(e) => set({ nameXml: e.target.value })} />
				</div>
				<div className="space-y-1 flex-1 min-w-0">
					<Label className={labelCls}>Plural</Label>
					<Input className={inputCls} value={item.plural ?? ''} onChange={(e) => set({ plural: e.target.value })} />
				</div>
			</div>

			<div className="space-y-1">
				<Label className={labelCls}>Description</Label>
				<Textarea
					rows={3}
					value={description}
					className="text-xs resize-y min-h-[64px]"
					onChange={(e) => setDescription(e.target.value)}
				/>
			</div>

			<div className="sf-cq">
				<Label className={labelCls}>Item Attributes</Label>
				<div className="mt-1">
					<AddAttributesPopover onAdd={addAttrs} profile={profile} usedKeys={usedKeys} />
				</div>
				<div className="mt-2 sf-attr-grid gap-x-3 gap-y-1">
					{attrs.map((a, i) =>
						a.key === 'description' ? null : (
							<AttrRow
								attr={a}
								key={`${a.key}-${i}`}
								def={profile.byKey.get(a.key)}
								onRemove={() => removeAttr(i)}
								onChange={(v) => updateAttr(i, v)}
							/>
						)
					)}
				</div>
				{attrs.filter((a) => a.key !== 'description').length === 0 && (
					<div className="text-[11px] text-muted-foreground italic mt-2">No attributes yet.</div>
				)}
			</div>

			{!autoSync && (
				<div className="space-y-3 border-t border-border/40 pt-3">
					<div className="grid grid-cols-5 gap-x-2 gap-y-1.5">
						<div className="space-y-1">
							<Label className={labelCls}>Type</Label>
							<Select value={String(item.type)} onValueChange={(v) => set({ type: num(v) })}>
								<SelectTrigger className={inputCls}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{TYPE_OPTIONS.map((o) => (
										<SelectItem key={o.value} className="text-xs" value={String(o.value)}>
											{o.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1">
							<Label className={labelCls}>Stack Order</Label>
							<Select value={String(item.stackOrder)} onValueChange={(v) => set({ stackOrder: num(v) })}>
								<SelectTrigger className={inputCls}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{STACK_OPTIONS.map((o) => (
										<SelectItem key={o.value} className="text-xs" value={String(o.value)}>
											{o.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1">
							<Label className={labelCls}>OTB Name</Label>
							<Input className={inputCls} value={item.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
						</div>
						{SYNCED_NUMBERS.map((f) => (
							<div key={String(f.key)} className="space-y-1">
								<Label className={labelCls}>{f.label}</Label>
								<Input
									type="number"
									className={inputCls}
									value={item[f.key] as number}
									onChange={(e) => set({ [f.key]: num(e.target.value) } as Partial<ServerItem>)}
								/>
							</div>
						))}
					</div>

					<div>
						<Label className={labelCls}>Flags</Label>
						<div className="mt-1 grid grid-cols-2 min-[1100px]:grid-cols-3 gap-x-3 gap-y-1">
							{SYNCED_FLAGS.map((f) => (
								<label key={String(f.key)} className="flex items-center justify-between gap-2 text-xs">
									<span className="truncate">{f.label}</span>
									<Switch
										className="scale-75"
										checked={!!item[f.key]}
										onCheckedChange={(c) => set({ [f.key]: c } as Partial<ServerItem>)}
									/>
								</label>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export const ServerSection = ({ clientId }: ServerSectionProps) => {
	const { data, updateCounter, autoSyncServer, updateServerItem, setServerProfile, setAutoSyncServer, getServerItemsForClient } =
		useAssetData();
	const [collapsed, setCollapsed] = useState(false);

	if (!data?.otbPath || !data.serverItems) return null;

	void updateCounter;
	const serverItems = getServerItemsForClient(clientId);
	const profile = getServerProfile(data.serverItems.profileId);

	return (
		<div className="mt-4">
			<div className="flex items-center justify-between border-b border-border/50 pb-1.5 mb-2 gap-2">
				<button
					type="button"
					onClick={() => setCollapsed((v) => !v)}
					className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground hover:text-primary"
				>
					<Server className="h-3.5 w-3.5" />
					Server Item (OTB)
				</button>
				<div className="flex items-center gap-3">
					<Select value={profile.id} onValueChange={setServerProfile}>
						<SelectTrigger className="h-6 text-[11px] w-28">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{getServerProfiles().map((p) => (
								<SelectItem key={p.id} value={p.id} className="text-xs">
									{p.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<label className="flex items-center gap-2 text-[11px] text-muted-foreground">
						<span>Auto-sync</span>
						<Switch className="scale-75" checked={autoSyncServer} onCheckedChange={setAutoSyncServer} />
					</label>
				</div>
			</div>

			{!collapsed && (
				<div className="space-y-2">
					{serverItems.length === 0 ? (
						<div className="text-xs text-muted-foreground rounded-md border border-dashed border-border/60 p-3">
							No server item linked to client id {clientId}. One will be created automatically on Compile (server id
							auto-assigned, flags synced from this item).
						</div>
					) : (
						serverItems.map((item) => (
							<ServerItemEditor
								item={item}
								profile={profile}
								key={item.serverId}
								autoSync={autoSyncServer}
								onChange={updateServerItem}
							/>
						))
					)}
				</div>
			)}
		</div>
	);
};
