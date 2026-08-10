export const toCamelKey = (k: string): string => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export const toSnakeKey = (k: string): string => k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
