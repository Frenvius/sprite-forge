import { ThingCategory } from '@/lib/formats/tibia';

export const CATEGORY_FILTERS = [
	{ value: 'all', label: 'All' },
	{ label: 'Items', value: ThingCategory.ITEM },
	{ label: 'Outfits', value: ThingCategory.OUTFIT },
	{ label: 'Effects', value: ThingCategory.EFFECT },
	{ label: 'Missiles', value: ThingCategory.MISSILE }
] as const;
