import type { ObdRow, ObdThumb } from '~/lib/formats/tibia/obdViewer';

export interface ObdCardProps {
	row: ObdRow;
	fill?: boolean;
	focused?: boolean;
	selected: boolean;
	thumb: null | ObdThumb;
	onFocus: (row: ObdRow) => void;
	onToggle: (recordIndex: number) => void;
}
