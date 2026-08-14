import type { Sprite, ThingType } from '~/lib/formats/tibia';

export interface EmbedDraftApi {
	draft: ThingType;
	setProperty: (property: string, value: unknown) => void;
}

export interface PropertiesPanelEmbed {
	title: string;
	clientVersion: number;
	item: null | ThingType;
	headerExtra?: React.ReactNode;
	getSprite: (id: number) => Sprite | undefined;
	footer?: (api: EmbedDraftApi) => React.ReactNode;
}

export interface PropertiesPanelProps {
	embed?: PropertiesPanelEmbed;
}
