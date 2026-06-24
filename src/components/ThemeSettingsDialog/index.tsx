import type { Theme } from '~/lib/themes/types';

import { Sun, Moon, Check, Upload, Sparkles, Download } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { useToast } from '~/usecase/hooks/useToast';
import { useTheme } from '~/usecase/context/ThemeContext';
import { Dialog, DialogTitle, DialogHeader, DialogContent, DialogDescription } from '~/components/ui/dialog';

interface ThemeSettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const swatchKeys = ['primary', 'accent', 'background', 'foreground'] as const;

const ThemeCard = ({
	theme,
	isDark,
	selected,
	onSelect
}: {
	theme: Theme;
	isDark: boolean;
	selected: boolean;
	onSelect: () => void;
}) => {
	const palette = theme.colors[isDark ? 'dark' : 'light'];
	const bg = `hsl(${palette.background})`;

	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={selected}
			title={theme.displayName}
			className={cn(
				'group relative flex flex-col gap-1.5 rounded-md border p-1.5 text-left outline-none transition-all',
				'hover:border-primary/60 focus:outline-none focus-visible:border-primary',
				selected ? 'border-primary' : 'border-border'
			)}
		>
			<div style={{ background: bg }} className="relative h-8 w-full overflow-hidden rounded-sm border border-border/60">
				<div style={{ background: `hsl(${palette.primary})` }} className="absolute inset-x-1.5 bottom-1.5 h-1.5 rounded-[2px]" />
				<div
					style={{ background: `hsl(${palette.accent})` }}
					className="absolute right-1.5 bottom-1.5 h-1.5 w-1.5 rounded-[2px]"
				/>
				{selected && (
					<span className="absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-primary-foreground">
						<Check strokeWidth={3} className="h-2 w-2" />
					</span>
				)}
			</div>
			<div className="flex items-center gap-1.5 px-0.5">
				<div className="flex -space-x-0.5 shrink-0">
					{swatchKeys.map((k) => (
						<span
							key={k}
							style={{ background: `hsl(${palette[k]})` }}
							className="h-2 w-2 rounded-full border border-border/60 ring-1 ring-card"
						/>
					))}
				</div>
				<span className="truncate text-[11px] font-medium">{theme.displayName}</span>
			</div>
		</button>
	);
};

export const ThemeSettingsDialog = ({ open, onOpenChange }: ThemeSettingsDialogProps) => {
	const {
		themes,
		isDark,
		acrylic,
		isWindows,
		setAcrylic,
		currentTheme,
		setThemeByName,
		toggleDarkMode,
		exportCurrentTheme,
		importThemeFromJson
	} = useTheme();
	const { toast } = useToast();

	const handleExportTheme = () => {
		try {
			const themeJson = exportCurrentTheme();
			const blob = new Blob([themeJson], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${currentTheme.name}-theme.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			toast({
				title: 'Theme exported',
				description: `Theme "${currentTheme.displayName}" has been exported successfully.`
			});
		} catch {
			toast({
				variant: 'destructive',
				title: 'Export failed',
				description: 'Failed to export theme.'
			});
		}
	};

	const handleImportTheme = () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;

			try {
				const text = await file.text();
				importThemeFromJson(text);
				toast({
					title: 'Theme imported',
					description: 'Theme has been imported and applied successfully.'
				});
			} catch (error) {
				toast({
					variant: 'destructive',
					title: 'Import failed',
					description: error instanceof Error ? error.message : 'Invalid theme file format.'
				});
			}
		};
		input.click();
	};

	const setMode = (target: 'dark' | 'light') => {
		if ((target === 'dark') !== isDark) toggleDarkMode();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[520px] gap-0 p-0 overflow-hidden">
				<DialogHeader className="space-y-1 px-6 pt-6 pb-4 border-b-0">
					<DialogTitle className="text-lg font-semibold tracking-tight">Theme Settings</DialogTitle>
					<DialogDescription className="text-xs">Pick a palette, choose your mode, and share custom themes.</DialogDescription>
				</DialogHeader>

				<div className="px-6 pb-2 space-y-5">
					<section className="space-y-2.5">
						<div className="flex items-center justify-between">
							<h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Palette</h3>
							<span className="text-[11px] text-muted-foreground">{themes.length} available</span>
						</div>
						<div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1 -mr-1">
							{themes.map((theme) => (
								<ThemeCard
									theme={theme}
									isDark={isDark}
									key={theme.name}
									selected={currentTheme.name === theme.name}
									onSelect={() => setThemeByName(theme.name)}
								/>
							))}
						</div>
					</section>

					<section className="space-y-2.5">
						<h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Appearance</h3>
						<div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
							<button
								type="button"
								onClick={() => setMode('light')}
								className={cn(
									'flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all',
									!isDark ? 'bg-card text-foreground shadow-island' : 'text-muted-foreground hover:text-foreground'
								)}
							>
								<Sun className="h-4 w-4" />
								Light
							</button>
							<button
								type="button"
								onClick={() => setMode('dark')}
								className={cn(
									'flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all',
									isDark ? 'bg-card text-foreground shadow-island' : 'text-muted-foreground hover:text-foreground'
								)}
							>
								<Moon className="h-4 w-4" />
								Dark
							</button>
						</div>
						{isWindows && (
							<button
								type="button"
								aria-pressed={acrylic}
								onClick={() => setAcrylic(!acrylic)}
								className={cn(
									'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-all',
									acrylic ? 'border-primary bg-primary/10' : 'border-border bg-muted/40 hover:bg-muted/60'
								)}
							>
								<span className="flex items-center gap-2">
									<Sparkles className={cn('h-4 w-4', acrylic ? 'text-primary' : 'text-muted-foreground')} />
									<span className="flex flex-col leading-tight">
										<span className="text-sm font-medium">Acrylic background</span>
										<span className="text-[11px] text-muted-foreground">Translucent blur behind the window (Windows only)</span>
									</span>
								</span>
								<span
									className={cn(
										'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors',
										acrylic ? 'bg-primary' : 'bg-muted-foreground/30'
									)}
								>
									<span
										className={cn(
											'inline-block h-3 w-3 transform rounded-full bg-card shadow-island transition-transform',
											acrylic ? 'translate-x-3.5' : 'translate-x-0.5'
										)}
									/>
								</span>
							</button>
						)}
					</section>
				</div>

				<div className="flex items-center gap-2 border-t border-border bg-muted/30 px-6 py-3">
					<span className="text-[11px] text-muted-foreground mr-auto">Manage themes</span>
					<Button size="sm" variant="ghost" onClick={handleImportTheme} className="h-8 gap-1.5 text-xs">
						<Upload className="h-3.5 w-3.5" />
						Import
					</Button>
					<Button size="sm" variant="ghost" onClick={handleExportTheme} className="h-8 gap-1.5 text-xs">
						<Download className="h-3.5 w-3.5" />
						Export
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
