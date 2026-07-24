import type { RemovedReason, RemovedSprite } from '~/lib/formats/registry';

import React from 'react';

import { cn } from '~/lib/utils';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { RemovedSpriteTile } from '~/components/SpriteOptimizerDialog/RemovedSpriteTile';
import { REASONS, REASON_META, SECTION_LABEL } from '~/components/SpriteOptimizerDialog/constants';
import { REMOVED_PREVIEW_LIMIT, useRemovedSpritePreview } from '~/usecase/hooks/useRemovedSpritePreview';

interface RemovedSpritesGridProps {
	previewPath?: string;
	removed: RemovedSprite[];
	counts?: Record<RemovedReason, number>;
}

export function RemovedSpritesGrid({ counts, removed, previewPath }: RemovedSpritesGridProps) {
	const { data, spriteSize } = useAssetData();
	const [filter, setFilter] = React.useState<null | RemovedReason>(null);

	const filtered = React.useMemo(() => (filter ? removed.filter((r) => r.reason === filter) : removed), [removed, filter]);
	const shown = React.useMemo(() => filtered.slice(0, REMOVED_PREVIEW_LIMIT), [filtered]);
	const previewIds = React.useMemo(() => shown.filter((r) => r.reason !== 'empty').map((r) => r.id), [shown]);

	const sprites = useRemovedSpritePreview(previewPath, previewIds, !!data?.extended, !!data?.transparency);

	if (removed.length === 0) return null;

	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between">
				<span className={SECTION_LABEL}>Removed sprites</span>
				<span className="text-[11px] tabular-nums text-muted-foreground">
					{filtered.length === shown.length ? `${filtered.length} shown` : `${shown.length} of ${filtered.length} shown`}
				</span>
			</div>

			<div className="flex gap-1 rounded-lg bg-secondary/40 p-1">
				{REASONS.map((reason) => {
					const meta = REASON_META[reason];
					const count = counts?.[reason] ?? removed.filter((r) => r.reason === reason).length;
					const active = filter === reason;
					return (
						<button
							key={reason}
							type="button"
							disabled={count === 0}
							title={meta.description}
							onClick={() => setFilter(active ? null : reason)}
							className={cn(
								'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
								active
									? 'bg-card text-foreground shadow-sm ring-1 ring-inset ring-border'
									: 'text-muted-foreground hover:text-foreground',
								count === 0 && 'cursor-default opacity-40 hover:text-muted-foreground'
							)}
						>
							<span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
							{meta.label}
							<span className="tabular-nums text-muted-foreground">{count}</span>
						</button>
					);
				})}
			</div>

			<p className="min-h-[28px] text-[11px] leading-snug text-muted-foreground">
				{filter ? REASON_META[filter].description : 'Pick a category to filter the list. Hover a sprite for details.'}
			</p>

			<div className="max-h-[152px] overflow-y-auto rounded-lg border border-border/60 bg-background/40 p-2">
				<div className="flex flex-wrap gap-1.5">
					{shown.map((entry) => (
						<RemovedSpriteTile entry={entry} key={entry.id} size={spriteSize} sprite={sprites.get(entry.id)} />
					))}
				</div>
			</div>
		</div>
	);
}
