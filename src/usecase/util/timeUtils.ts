export const fmtTime = (s: number) => {
	if (!isFinite(s) || s < 0) return '--';
	const m = Math.floor(s / 60);
	const sec = Math.floor(s % 60);
	return `${m}m ${sec.toString().padStart(2, '0')}s`;
};
