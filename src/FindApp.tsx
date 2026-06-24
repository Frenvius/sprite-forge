import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Toaster } from '~/components/ui/toaster';
import { FindWindow } from '~/components/FindWindow';
import { TooltipProvider } from '~/components/ui/tooltip';
import { ThemeProvider } from '~/usecase/context/ThemeContext';
import { DragDropProvider } from '~/usecase/context/DragDropContext';
import { AssetDataProvider } from '~/usecase/context/AssetDataContext';

const queryClient = new QueryClient();

const FindApp = () => (
	<QueryClientProvider client={queryClient}>
		<ThemeProvider>
			<TooltipProvider>
				<AssetDataProvider>
					<DragDropProvider>
						<FindWindow />
						<Toaster />
					</DragDropProvider>
				</AssetDataProvider>
			</TooltipProvider>
		</ThemeProvider>
	</QueryClientProvider>
);

export default FindApp;
