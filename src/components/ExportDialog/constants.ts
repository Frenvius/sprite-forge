import type { LucideIcon } from 'lucide-react';
import type { ExportFormat } from '~/lib/formats/tibia';

import { Box, Image, Package } from 'lucide-react';

export const FORMAT_OPTIONS = [
	{ value: 'png', label: 'PNG', hint: 'sheet' },
	{ value: 'bmp', label: 'BMP', hint: 'sheet' },
	{ value: 'jpg', label: 'JPG', hint: 'sheet' },
	{ value: 'obd', label: 'OBD', hint: 'single' },
	{ value: 'sfp', label: 'SFP', hint: 'pack' }
] as const;

export const FORMAT_ICONS: Record<ExportFormat, LucideIcon> = {
	obd: Box,
	png: Image,
	bmp: Image,
	jpg: Image,
	sfp: Package
};

export const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';
