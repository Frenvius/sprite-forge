import type { ThingCategory } from '~/lib/formats/tibia';

import { FileQuestion } from 'lucide-react';

import { categoryNoun } from '../constants';
import { useAssetData } from '~/usecase/context/AssetDataContext';

interface EmptyStateProps {
	category: ThingCategory;
}

export const EmptyState = ({ category }: EmptyStateProps) => {
	const { formatConfig } = useAssetData();
	const noun = categoryNoun(formatConfig, category);
	return (
		<div className="w-full h-full bg-card rounded-lg shadow-island-lg flex flex-col overflow-hidden">
			<div className="h-8 px-4 flex items-center border-b border-border/50 bg-secondary/80">
				<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Object Properties</h2>
			</div>
			<div className="flex-1 flex items-center justify-center p-4">
				<div className="text-center text-muted-foreground">
					<FileQuestion className="h-16 w-16 mx-auto mb-3 opacity-50" />
					<p className="text-sm font-medium">No {noun} selected</p>
					<p className="text-xs mt-1">Select a {noun} from the list to view properties</p>
				</div>
			</div>
		</div>
	);
};
