import { Route, Routes, BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Index from './pages/Index';
import NotFound from './pages/NotFound';
import { Toaster } from '~/components/ui/toaster';
import { ErrorDialog } from '~/components/ErrorDialog';
import { ExportDialog } from '~/components/ExportDialog';
import { ImportDialog } from '~/components/ImportDialog';
import { TooltipProvider } from '~/components/ui/tooltip';
import { ObdViewerDialog } from '~/components/ObdViewerDialog';
import { ThemeProvider } from '~/usecase/context/ThemeContext';
import { DragDropProvider } from '~/usecase/context/DragDropContext';
import { TransferProvider } from '~/usecase/context/TransferContext';
import { AssetDataProvider } from '~/usecase/context/AssetDataContext';
import { ErrorDialogProvider } from '~/usecase/context/ErrorDialogContext';
import { PanelSettingsProvider } from '~/usecase/context/PanelSettingsContext';
import { GeneralSettingsProvider } from '~/usecase/context/GeneralSettingsContext';

const queryClient = new QueryClient();

const App = () => (
	<QueryClientProvider client={queryClient}>
		<ThemeProvider>
			<TooltipProvider>
				<ErrorDialogProvider>
					<ErrorDialog />
					<AssetDataProvider>
						<PanelSettingsProvider>
							<GeneralSettingsProvider>
								<DragDropProvider>
									<TransferProvider>
										<ExportDialog />
										<ImportDialog />
										<ObdViewerDialog />
										<Toaster />
										<BrowserRouter>
											<Routes>
												<Route path="/" element={<Index />} />
												<Route path="*" element={<NotFound />} />
											</Routes>
										</BrowserRouter>
									</TransferProvider>
								</DragDropProvider>
							</GeneralSettingsProvider>
						</PanelSettingsProvider>
					</AssetDataProvider>
				</ErrorDialogProvider>
			</TooltipProvider>
		</ThemeProvider>
	</QueryClientProvider>
);

export default App;
