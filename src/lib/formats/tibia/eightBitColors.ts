export function from8Bit(color: number): [number, number, number] {
	if (color >= 216) return [0, 0, 0];
	const R = (Math.floor(color / 36) % 6) * 51;
	const G = (Math.floor(color / 6) % 6) * 51;
	const B = (color % 6) * 51;
	return [R, G, B];
}

export function generate8BitColorPalette(): string[] {
	const colors: string[] = [];
	for (let i = 0; i < 216; i++) {
		const [r, g, b] = from8Bit(i);
		colors.push(`rgb(${r}, ${g}, ${b})`);
	}
	return colors;
}

export function get8BitColorHex(color: number): string {
	const [r, g, b] = from8Bit(color);
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function hexTo8BitIndex(hex: string): null | number {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);

	for (let i = 0; i < 216; i++) {
		const [r2, g2, b2] = from8Bit(i);
		if (r === r2 && g === g2 && b === b2) {
			return i;
		}
	}
	return null;
}

export function verifyColorGrid(rows: string[][]): {
	missing: number[];
	totalCount: number;
	uniqueCount: number;
	invalid: Array<{ hex: string; position: string }>;
	duplicates: Array<{ hex: string; index: number; positions: string[] }>;
} {
	const foundIndices = new Set<number>();
	const hexToIndex = new Map<string, number>();
	const indexToHex = new Map<number, string>();
	const duplicates: Array<{ hex: string; index: number; positions: string[] }> = [];
	const invalid: Array<{ hex: string; position: string }> = [];

	for (let row = 0; row < rows.length; row++) {
		for (let col = 0; col < rows[row].length; col++) {
			const hex = rows[row][col];
			if (!hex) continue;
			const position = `row ${row}, col ${col}`;
			const index = hexTo8BitIndex(hex);

			if (index === null) {
				invalid.push({ hex, position });
				continue;
			}

			if (foundIndices.has(index)) {
				const existingHex = indexToHex.get(index)!;
				const existingPositions = hexToIndex.has(hex) ? [position] : [position];
				if (!duplicates.find((d) => d.index === index)) {
					duplicates.push({
						index,
						hex: existingHex,
						positions: existingPositions
					});
				} else {
					const dup = duplicates.find((d) => d.index === index)!;
					dup.positions.push(position);
				}
			} else {
				foundIndices.add(index);
				hexToIndex.set(hex, index);
				indexToHex.set(index, hex);
			}
		}
	}

	const missing: number[] = [];
	for (let i = 0; i < 216; i++) {
		if (!foundIndices.has(i)) {
			missing.push(i);
		}
	}

	return {
		missing,
		invalid,
		duplicates,
		uniqueCount: foundIndices.size,
		totalCount: rows.reduce((sum, row) => sum + row.length, 0)
	};
}

export function generate8BitColorGridFlat(): (null | number)[] {
	const values = [0x00, 0x33, 0x66, 0x99, 0xcc, 0xff];
	const cols = 18;
	const rows = 12;
	const flat: (null | number)[] = [];

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			let r: number, g: number, b: number;

			if (col < 6) {
				g = values[5 - col];
			} else if (col < 12) {
				g = values[col - 6];
			} else {
				g = values[5 - (col - 12)];
			}

			if (row < 6) {
				if (col < 6) r = 0xcc;
				else if (col < 12) r = 0x66;
				else r = 0x00;
			} else {
				if (col < 6) r = 0xff;
				else if (col < 12) r = 0x99;
				else r = 0x33;
			}

			if (row < 6) {
				b = values[row];
			} else {
				b = values[11 - row];
			}

			const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
			const index = hexTo8BitIndex(hex);
			flat.push(index);
		}
	}

	return flat;
}
