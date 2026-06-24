export interface ErrorInfo {
	title: string;
	message: string;
}

export interface ErrorDialogProps {
	onClose: () => void;
	info: null | ErrorInfo;
}
