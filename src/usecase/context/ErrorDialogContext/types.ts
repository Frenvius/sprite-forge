export interface ErrorInfo {
	title: string;
	message: string;
}

export interface ErrorDialogContextValue {
	info: null | ErrorInfo;
	closeError: () => void;
	showError: (title: string, error: unknown) => void;
}
