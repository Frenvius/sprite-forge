import React from 'react';

import { errorToString } from '~/lib/errorMessage';
import { type ErrorInfo, type ErrorDialogContextValue } from './types';

const ErrorDialogContext = React.createContext<null | ErrorDialogContextValue>(null);

export const ErrorDialogProvider = ({ children }: { children: React.ReactNode }) => {
	const [info, setInfo] = React.useState<null | ErrorInfo>(null);

	const showError = React.useCallback((title: string, error: unknown) => {
		setInfo({ title, message: errorToString(error) });
	}, []);

	const closeError = React.useCallback(() => setInfo(null), []);

	const value = React.useMemo<ErrorDialogContextValue>(() => ({ info, showError, closeError }), [info, showError, closeError]);

	return <ErrorDialogContext.Provider value={value}>{children}</ErrorDialogContext.Provider>;
};

export const useErrorDialog = (): ErrorDialogContextValue => {
	const ctx = React.useContext(ErrorDialogContext);
	if (!ctx) throw new Error('useErrorDialog must be used within an ErrorDialogProvider');
	return ctx;
};
