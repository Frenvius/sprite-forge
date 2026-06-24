import { ThingCategory } from '~/lib/formats/tibia';

export const categoryNoun = (category: ThingCategory): string =>
	category === ThingCategory.ITEM
		? 'item'
		: category === ThingCategory.OUTFIT
			? 'outfit'
			: category === ThingCategory.EFFECT
				? 'effect'
				: 'missile';

export const categoryTitle = (category: ThingCategory): string =>
	category === ThingCategory.ITEM
		? 'Object'
		: category === ThingCategory.OUTFIT
			? 'Outfit'
			: category === ThingCategory.EFFECT
				? 'Effect'
				: 'Missile';
