import type { Sprite, ThingType, ThingCategory, SpriteTemplate } from '~/lib/formats/tibia';

import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';

import { nextSpriteBase } from '~/usecase/util/spriteIds';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { decodeSheet, createSheetTiles } from '~/usecase/util/templateSheet';
import {
	getCategoryMap,
	setCategoryCount,
	getCategoryStartId,
	templateItemToThing,
	ThingCategory as Categories
} from '~/lib/formats/tibia';

interface ThingRequest {
	id: number;
	category: ThingCategory;
}

interface ApplyRequest {
	sheetPath: string;
	template: SpriteTemplate;
}

export const useTemplateBridge = () => {
	const { data, getThing, updateThing, formatConfig, markAsNewItem, ensureServerItem, notifyDataChanged, notifySpritesLoaded } =
		useAssetData();

	const dataRef = React.useRef(data);
	dataRef.current = data;

	const formatRef = React.useRef({ config: formatConfig, name: formatConfig.name });
	formatRef.current = { config: formatConfig, name: formatConfig.name };

	const context = React.useMemo(
		() => ({ hasProject: !!data, formatName: formatConfig.name, version: data?.version.value ?? 0 }),
		[data, formatConfig.name]
	);

	React.useEffect(() => {
		void emit('template:context', context);
	}, [context]);

	const pendingSeedRef = React.useRef<null | ThingType>(null);

	React.useEffect(() => {
		const handleOpenRequest = (event: Event) => {
			const detail = (event as CustomEvent<{ seed?: ThingType }>).detail;
			pendingSeedRef.current = detail?.seed ?? null;
		};

		window.addEventListener('open-template-editor', handleOpenRequest);
		return () => window.removeEventListener('open-template-editor', handleOpenRequest);
	}, []);

	React.useEffect(() => {
		const unlistenSeed = listen('template:query-seed', () => {
			if (!pendingSeedRef.current) return;
			void emit('template:seed', pendingSeedRef.current);
			pendingSeedRef.current = null;
		});

		const unlistenContext = listen('template:query-context', () => {
			const current = dataRef.current;
			void emit('template:context', {
				hasProject: !!current,
				formatName: formatRef.current.name,
				version: current?.version.value ?? 0
			});
		});

		const unlistenThing = listen<ThingRequest>('template:request-thing', (event) => {
			const { id, category } = event.payload;
			const thing = dataRef.current ? getThing(id, category) : null;
			void emit('template:thing', thing ?? null);
		});

		return () => {
			void unlistenSeed.then((fn) => fn());
			void unlistenContext.then((fn) => fn());
			void unlistenThing.then((fn) => fn());
		};
	}, [getThing]);

	const applyTemplate = React.useCallback(
		async ({ template, sheetPath }: ApplyRequest): Promise<number> => {
			const current = dataRef.current;
			if (!current) throw new Error('No project open in the main window');

			const bytes = await invoke<Uint8Array>('read_file', { path: sheetPath });
			const sheet = createSheetTiles(await decodeSheet(new Uint8Array(bytes)), template.tile || 32);

			const usedTiles = new Set<number>();
			for (const item of template.items) {
				for (const cell of item.cells) {
					if (cell >= 0 && !sheet.isBlank(cell)) usedTiles.add(cell);
				}
			}

			const spriteIdByTile = new Map<number, number>();
			const createdSpriteIds: number[] = [];
			let nextId = nextSpriteBase(current.sprites, current.spritesCount);

			for (const tile of Array.from(usedTiles).sort((a, b) => a - b)) {
				const source = sheet.getTile(tile);
				if (!source) continue;

				const compressBuf = new Uint8Array(source.rgbaPixels.length + 1);
				compressBuf[0] = current.transparency ? 1 : 0;
				compressBuf.set(source.rgbaPixels, 1);
				const compressed = await invoke<ArrayBuffer>('compress_sprite_rgba', compressBuf);

				const sprite: Sprite = {
					id: nextId,
					isEmpty: false,
					imageData: undefined,
					rgbaPixels: source.rgbaPixels,
					transparent: current.transparency,
					compressedPixels: compressed instanceof Uint8Array ? compressed : new Uint8Array(compressed)
				};

				current.sprites.set(nextId, sprite);
				spriteIdByTile.set(tile, nextId);
				createdSpriteIds.push(nextId);
				nextId++;
			}

			current.spritesCount = Math.max(current.spritesCount, nextId - 1);

			let created = 0;
			for (const item of template.items) {
				const category = item.category as ThingCategory;
				const map = getCategoryMap(current, category);
				const spriteIndex = item.cells.map((cell) => (cell >= 0 ? (spriteIdByTile.get(cell) ?? 0) : 0));

				let thingId = getCategoryStartId(formatRef.current.config, category);
				while (map.has(thingId)) thingId++;

				const thing: ThingType = templateItemToThing(item, thingId, spriteIndex, formatRef.current.config);
				map.set(thingId, thing);
				setCategoryCount(current, category, map.size);
				updateThing(thingId, category, thing);
				markAsNewItem(thingId, category);
				if (category === Categories.ITEM) ensureServerItem(thingId);
				created++;
			}

			notifyDataChanged(createdSpriteIds);
			notifySpritesLoaded();
			return created;
		},
		[updateThing, markAsNewItem, ensureServerItem, notifyDataChanged, notifySpritesLoaded]
	);

	React.useEffect(() => {
		const unlisten = listen<ApplyRequest>('template:apply', (event) => {
			void applyTemplate(event.payload)
				.then((created) => emit('template:applied', { created }))
				.catch((err) =>
					emit('template:applied', {
						created: 0,
						error: err instanceof Error ? err.message : String(err)
					})
				);
		});

		return () => {
			void unlisten.then((fn) => fn());
		};
	}, [applyTemplate]);
};
