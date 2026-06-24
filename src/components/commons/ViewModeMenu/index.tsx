import type { ViewModeMenuProps } from './types';

import { List, Square, Grid3x3, Columns2, LayoutGrid, LayoutDashboard } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';

export const ViewModeMenu = ({ viewMode, onViewModeChange }: ViewModeMenuProps) => {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="icon" variant="ghost" className="h-6 w-6 p-0 hover:bg-secondary">
					{viewMode === 'list' && <List className="h-3.5 w-3.5 text-muted-foreground" />}
					{viewMode === 'grid' && <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />}
					{viewMode === 'grid-3' && <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground" />}
					{viewMode === 'grid-4' && <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />}
					{viewMode === 'large' && <Square className="h-3.5 w-3.5 text-muted-foreground" />}
					{viewMode === 'large-2' && <Columns2 className="h-3.5 w-3.5 text-muted-foreground" />}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => onViewModeChange('list')}>
					<List className="mr-2 h-4 w-4" />
					<span>List</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onViewModeChange('grid')}>
					<LayoutGrid className="mr-2 h-4 w-4" />
					<span>Grid (2 cols)</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onViewModeChange('grid-3')}>
					<Grid3x3 className="mr-2 h-4 w-4" />
					<span>Grid (3 cols)</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onViewModeChange('grid-4')}>
					<LayoutDashboard className="mr-2 h-4 w-4" />
					<span>Grid (4 cols)</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onViewModeChange('large')}>
					<Square className="mr-2 h-4 w-4" />
					<span>Large</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onViewModeChange('large-2')}>
					<Columns2 className="mr-2 h-4 w-4" />
					<span>Large (2 cols)</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
