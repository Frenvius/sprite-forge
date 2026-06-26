import { useState } from 'react';
import { Plus, Server } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Switch } from '~/components/ui/switch';
import { type ServerSectionProps } from './types';
import { ServerItemEditor } from './ServerItemEditor';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { getServerProfile, getServerProfiles } from '~/lib/formats/tibia';
import { Select, SelectItem, SelectValue, SelectTrigger, SelectContent } from '~/components/ui/select';

export const ServerSection = ({ clientId }: ServerSectionProps) => {
	const {
		data,
		updateCounter,
		autoSyncServer,
		ensureServerItem,
		updateServerItem,
		setServerProfile,
		setAutoSyncServer,
		getServerItemsForClient
	} = useAssetData();
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
					{serverItems.length === 0 && (
						<Button size="sm" variant="outline" className="h-6 px-2 text-[11px] gap-1" onClick={() => ensureServerItem(clientId)}>
							<Plus className="h-3 w-3" />
							Create
						</Button>
					)}
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
							No server item linked to client id {clientId}. Use <span className="font-medium text-foreground">Create</span> to
							add one now (server id auto-assigned, flags synced from this item), or it will be created automatically on Compile.
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
