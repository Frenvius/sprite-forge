import type { LucideIcon } from 'lucide-react';
import type { RemovedReason } from '~/lib/formats/registry';

import { Ban, Copy, EyeOff } from 'lucide-react';

export const REASONS: RemovedReason[] = ['duplicate', 'unused', 'empty'];

export const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';

interface ReasonMeta {
	dot: string;
	tile: string;
	label: string;
	icon: LucideIcon;
	description: string;
}

export const REASON_META: Record<RemovedReason, ReasonMeta> = {
	empty: {
		icon: Ban,
		label: 'Blank',
		dot: 'bg-zinc-400',
		tile: 'border-zinc-500/50',
		description: 'Sprite had no pixels. References pointing at it were cleared.'
	},
	unused: {
		icon: EyeOff,
		label: 'Unused',
		dot: 'bg-amber-400',
		tile: 'border-amber-500/50',
		description: 'No object referenced this sprite, so it was dropped from the file.'
	},
	duplicate: {
		icon: Copy,
		dot: 'bg-sky-400',
		label: 'Duplicate',
		tile: 'border-sky-500/50',
		description: 'Pixel-identical to a sprite that was kept. References now point at the kept copy.'
	}
};
