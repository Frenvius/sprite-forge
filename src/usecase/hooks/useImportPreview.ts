import type { Sprite, ThingType } from '~/lib/formats/tibia';

import React from 'react';

import { importExtract } from '~/lib/formats/tibia/importViewer';

interface PreviewData {
	loading: boolean;
	thing: null | ThingType;
	getSprite: (id: number) => Sprite | undefined;
}

export const useImportPreview = (recordIndex: null | number, transparency: boolean): PreviewData => {
	const [thing, setThing] = React.useState<null | ThingType>(null);
	const [loading, setLoading] = React.useState(false);
	const spritesRef = React.useRef<Map<number, Sprite>>(new Map());
	const tokenRef = React.useRef(0);
	const [, setTick] = React.useState(0);

	React.useEffect(() => {
		const token = ++tokenRef.current;
		if (recordIndex === null) {
			spritesRef.current = new Map();
			setThing(null);
			setLoading(false);
			return;
		}

		setLoading(true);
		importExtract([recordIndex], 1, transparency)
			.then((result) => {
				if (token !== tokenRef.current) return;
				const map = new Map<number, Sprite>();
				for (const sprite of result.sprites) map.set(sprite.id, sprite);
				spritesRef.current = map;
				setThing(result.things[0] ?? null);
				setLoading(false);
				setTick((x) => x + 1);
			})
			.catch(() => {
				if (token !== tokenRef.current) return;
				spritesRef.current = new Map();
				setThing(null);
				setLoading(false);
			});
	}, [recordIndex, transparency]);

	const getSprite = React.useCallback((id: number) => spritesRef.current.get(id), []);

	return { thing, loading, getSprite };
};
