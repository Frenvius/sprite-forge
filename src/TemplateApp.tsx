import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Toaster } from '~/components/ui/toaster';
import { TooltipProvider } from '~/components/ui/tooltip';
import { ThemeProvider } from '~/usecase/context/ThemeContext';
import { ConfirmProvider } from '~/usecase/context/ConfirmContext';
import { DragDropProvider } from '~/usecase/context/DragDropContext';
import { AssetDataProvider } from '~/usecase/context/AssetDataContext';
import { AnimationProvider } from '~/usecase/context/AnimationContext';
import { TemplateEditorWindow } from '~/components/TemplateEditorWindow';
import { GeneralSettingsProvider } from '~/usecase/context/GeneralSettingsContext';

const queryClient = new QueryClient();

const TemplateApp = () => (
	<QueryClientProvider client={queryClient}>
		<ThemeProvider>
			<TooltipProvider>
				<ConfirmProvider>
					<AssetDataProvider>
						<AnimationProvider>
							<GeneralSettingsProvider>
								<DragDropProvider>
									<TemplateEditorWindow />
									<Toaster />
								</DragDropProvider>
							</GeneralSettingsProvider>
						</AnimationProvider>
					</AssetDataProvider>
				</ConfirmProvider>
			</TooltipProvider>
		</ThemeProvider>
	</QueryClientProvider>
);

export default TemplateApp;
