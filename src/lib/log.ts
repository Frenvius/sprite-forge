import { invoke } from '@tauri-apps/api/core';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function send(level: LogLevel, message: string): void {
	void invoke('log_message', { level, message }).catch(() => {});
}

function format(message: string, error?: unknown): string {
	if (error === undefined) return message;
	return `${message}: ${error instanceof Error ? error.message : String(error)}`;
}

export const log = {
	info(message: string): void {
		send('INFO', message);
	},
	warn(message: string, error?: unknown): void {
		const full = format(message, error);
		console.warn(full);
		send('WARN', full);
	},
	error(message: string, error?: unknown): void {
		const full = format(message, error);
		console.error(full);
		send('ERROR', full);
	}
};

export async function getLogPath(): Promise<string> {
	return invoke<string>('get_log_path');
}

export async function readLog(): Promise<string> {
	return invoke<string>('read_log');
}

export async function clearLog(): Promise<void> {
	await invoke('clear_log');
}
