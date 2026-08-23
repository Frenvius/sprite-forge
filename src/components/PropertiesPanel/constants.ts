import type { FormatConfig, ThingCategory } from '~/lib/formats/tibia';

export const categoryLabel = (config: FormatConfig, category: ThingCategory): string =>
	config.categories.find((c) => c.id === category)?.label ?? String(category);

export const categoryNoun = (config: FormatConfig, category: ThingCategory): string =>
	categoryLabel(config, category).toLowerCase();

export const categoryTitle = categoryLabel;
