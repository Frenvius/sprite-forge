import React from 'react';

import { errorToString } from '~/lib/errorMessage';
import { ErrorDialog, type ErrorInfo } from '~/components/ErrorDialog';

interface ErrorDialogContextValue {
	showError: (title: string, error: unknown) => void;
}

const ErrorDialogContext = React.createContext<null | ErrorDialogContextValue>(null);

export const ErrorDialogProvider = ({ children }: { children: React.ReactNode }) => {
	const [info, setInfo] = React.useState<null | ErrorInfo>(null);

	const showError = React.useCallback((title: string, error: unknown) => {
		setInfo({ title, message: errorToString(error) });
	}, []);

	return (
		<ErrorDialogContext.Provider value={{ showError }}>
			{children}
			<ErrorDialog info={info} onClose={() => setInfo(null)} />
		</ErrorDialogContext.Provider>
	);
};

export const useErrorDialog = (): ErrorDialogContextValue => {
	const ctx = React.useContext(ErrorDialogContext);
	if (!ctx) throw new Error('useErrorDialog must be used within an ErrorDialogProvider');
	return ctx;
};
