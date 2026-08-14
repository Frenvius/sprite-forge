import type { SearchCriteria } from './searchProtocol';

import { ThingType, AssetData, ThingCategory } from './types';

export async function searchThingTypes(
	data: AssetData,
	criteria: SearchCriteria,
	limit: number = 0
): Promise<Array<{ id: number; category: ThingCategory }>> {
	return performSearch(data, criteria, limit);
}

function performSearch(data: AssetData, criteria: SearchCriteria, limit: number): Array<{ id: number; category: ThingCategory }> {
	const results: Array<{ id: number; category: ThingCategory }> = [];

	const collections: Array<{ category: ThingCategory; map: Map<number, ThingType> }> = [];

	if (!criteria.category) {
		collections.push({ map: data.items, category: ThingCategory.ITEM });
		collections.push({ map: data.outfits, category: ThingCategory.OUTFIT });
		collections.push({ map: data.effects, category: ThingCategory.EFFECT });
		collections.push({ map: data.missiles, category: ThingCategory.MISSILE });
	} else {
		switch (criteria.category) {
			case ThingCategory.ITEM:
				collections.push({ map: data.items, category: ThingCategory.ITEM });
				break;
			case ThingCategory.OUTFIT:
				collections.push({ map: data.outfits, category: ThingCategory.OUTFIT });
				break;
			case ThingCategory.EFFECT:
				collections.push({ map: data.effects, category: ThingCategory.EFFECT });
				break;
			case ThingCategory.MISSILE:
				collections.push({ map: data.missiles, category: ThingCategory.MISSILE });
				break;
		}
	}

	for (const { map, category } of collections) {
		for (const thing of map.values()) {
			if (matchesCriteria(thing, criteria)) {
				results.push({ category, id: thing.id });
				if (limit > 0 && results.length >= limit) {
					return results;
				}
			}
		}
	}

	return results;
}

function matchesCriteria(thing: ThingType, criteria: SearchCriteria): boolean {
	if (criteria.category && thing.category !== criteria.category) {
		return false;
	}

	if (criteria.name && criteria.name.trim()) {
		const searchName = criteria.name.toLowerCase().trim();
		const thingName = (thing.marketName || '').toLowerCase();
		if (!thingName.includes(searchName)) {
			return false;
		}
	}

	const propertyKeys = Object.keys(criteria.properties);
	if (propertyKeys.length > 0) {
		for (const [propName, required] of Object.entries(criteria.properties)) {
			if (required === true) {
				const thingValue = (thing as any)[propName];
				if (thingValue !== true) {
					return false;
				}
			}
		}
	}

	return true;
}
