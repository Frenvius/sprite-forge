import type React from 'react';

export interface ListPaginationProps {
	totalPages: number;
	inputValue: string;
	currentPage: number;
	onLast?: () => void;
	onPageChange: (page: number) => void;
	onInputChange: (value: string) => void;
	onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}
