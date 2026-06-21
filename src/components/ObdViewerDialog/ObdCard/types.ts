import type { ObdRow, ObdThumb } from '@/lib/formats/tibia/obdViewer';

export interface ObdCardProps {
	row: ObdRow;
	fill?: boolean;
	selected: boolean;
	thumb: null | ObdThumb;
	onToggle: (recordIndex: number) => void;
}
