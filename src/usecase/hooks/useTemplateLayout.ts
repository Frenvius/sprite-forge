import React from 'react';

export interface TemplateLayout {
	listWidth: number;
	sheetWidth: number;
	itemsHeight: number;
}

const STORAGE_KEY = 'template-editor:layout';

const DEFAULTS: TemplateLayout = { listWidth: 208, sheetWidth: 420, itemsHeight: 224 };

const LIMITS: Record<keyof TemplateLayout, { min: number; max: number }> = {
	listWidth: { min: 140, max: 480 },
	itemsHeight: { min: 96, max: 720 },
	sheetWidth: { min: 240, max: 1200 }
};

const read = (): TemplateLayout => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<TemplateLayout>) };
	} catch {
		return DEFAULTS;
	}
};

export const useTemplateLayout = () => {
	const [layout, setLayout] = React.useState<TemplateLayout>(read);

	React.useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
		} catch {
			void 0;
		}
	}, [layout]);

	const resize = React.useCallback((key: keyof TemplateLayout, delta: number) => {
		setLayout((current) => {
			const { min, max } = LIMITS[key];
			return { ...current, [key]: Math.min(max, Math.max(min, current[key] + delta)) };
		});
	}, []);

	return { layout, resize };
};
