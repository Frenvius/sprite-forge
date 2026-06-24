import type { ListPaginationProps } from './types';

import { SkipBack, ChevronLeft, SkipForward, ChevronRight } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Input } from '~/components/ui/input';

export const ListPagination = ({
	totalPages,
	inputValue,
	currentPage,
	onPageChange,
	onInputChange,
	onInputKeyDown
}: ListPaginationProps) => {
	return (
		<div className="absolute bottom-0 left-0 right-0 p-2 bg-card/95 backdrop-blur-sm border-t border-border/50">
			<div className="flex items-center justify-center gap-1">
				<button
					disabled={currentPage === 1}
					onClick={() => onPageChange(1)}
					className={cn(
						'w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors',
						currentPage === 1 && 'opacity-50 cursor-not-allowed'
					)}
				>
					<SkipBack className="w-3.5 h-3.5 text-foreground" />
				</button>
				<button
					disabled={currentPage === 1}
					onClick={() => onPageChange(currentPage - 1)}
					className={cn(
						'w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors',
						currentPage === 1 && 'opacity-50 cursor-not-allowed'
					)}
				>
					<ChevronLeft className="w-3.5 h-3.5 text-foreground" />
				</button>
				<Input
					type="text"
					placeholder="-"
					value={inputValue}
					onKeyDown={onInputKeyDown}
					onChange={(e) => onInputChange(e.target.value)}
					className="w-16 h-7 text-xs font-mono text-center bg-secondary/50 border-0 mx-1 px-1"
				/>
				<button
					disabled={currentPage === totalPages}
					onClick={() => onPageChange(currentPage + 1)}
					className={cn(
						'w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors',
						currentPage === totalPages && 'opacity-50 cursor-not-allowed'
					)}
				>
					<ChevronRight className="w-3.5 h-3.5 text-foreground" />
				</button>
				<button
					disabled={currentPage === totalPages}
					onClick={() => onPageChange(totalPages)}
					className={cn(
						'w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors',
						currentPage === totalPages && 'opacity-50 cursor-not-allowed'
					)}
				>
					<SkipForward className="w-3.5 h-3.5 text-foreground" />
				</button>
			</div>
		</div>
	);
};
