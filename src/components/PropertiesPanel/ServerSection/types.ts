import type { AttrDef, XmlAttr, ServerItem, ServerProfile } from '~/lib/formats/tibia';

export interface AttrRowProps {
	attr: XmlAttr;
	def?: AttrDef;
	onRemove: () => void;
	onChange: (value: string) => void;
}

export interface ServerItemEditorProps {
	item: ServerItem;
	autoSync: boolean;
	profile: ServerProfile;
	onChange: (serverId: number, updates: Partial<ServerItem>) => void;
}

export interface ServerSectionProps {
	clientId: number;
}
