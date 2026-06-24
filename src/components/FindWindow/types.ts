import type { ThingCategory } from '~/lib/formats/tibia';

export type SimilarityRef = { id: number; category: ThingCategory };

export type ViewMode = 'list' | 'grid' | 'large' | 'compact';
