import type { Sprite } from '~/lib/formats/tibia';

import React from 'react';
import { invoke } from '@tauri-apps/api/core';

import { loadSpriteIds } from '~/lib/formats/tibia';

export const REMOVED_PREVIEW_LIMIT = 240;

export const useRemovedSpritePreview = (path: string | undefined, ids: number[], extended: boolean, transparency: boolean) => {
	const [sprites, setSprites] = React.useState<Map<number, Sprite>>(new Map());
	const key = ids.join(',');

	React.useEffect(() => {
		if (!path || ids.length === 0) {
			setSprites(new Map());
			return;
		}

		let active = true;
		const cache = new Map<number, Sprite>();

		const load = async () => {
			try {
				await invoke('open_spr_file', { path, extended });
				await loadSpriteIds(path, ids, transparency, cache);
			} catch {
				return;
			}
			if (active) setSprites(new Map(cache));
		};

		void load();

		return () => {
			active = false;
		};
	}, [path, key, extended, transparency]);

	return sprites;
};
