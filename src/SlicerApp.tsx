import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Toaster } from '~/components/ui/toaster';
import { SlicerWindow } from '~/components/SlicerWindow';
import { TooltipProvider } from '~/components/ui/tooltip';
import { ThemeProvider } from '~/usecase/context/ThemeContext';
import { ConfirmProvider } from '~/usecase/context/ConfirmContext';
import { AssetDataProvider } from '~/usecase/context/AssetDataContext';

const queryClient = new QueryClient();

const SlicerApp = () => (
	<QueryClientProvider client={queryClient}>
		<ThemeProvider>
			<TooltipProvider>
				<ConfirmProvider>
					<AssetDataProvider>
						<SlicerWindow />
						<Toaster />
					</AssetDataProvider>
				</ConfirmProvider>
			</TooltipProvider>
		</ThemeProvider>
	</QueryClientProvider>
);

export default SlicerApp;
