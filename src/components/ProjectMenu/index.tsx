import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Package, FolderGit2 } from 'lucide-react';

import { errorToString } from '~/lib/errorMessage';
import { useToast } from '~/usecase/hooks/useToast';
import { MenubarSub, MenubarItem, MenubarSeparator, MenubarSubContent, MenubarSubTrigger } from '~/components/ui/menubar';
import {
	openProject,
	closeProject,
	type ProjectInfo,
	getActiveProject,
	getRecentProjects,
	type RecentProject,
	clearRecentProjects
} from '~/usecase/util/projects';

export function ProjectMenu() {
	const { toast } = useToast();
	const [active, setActive] = useState<null | ProjectInfo>(null);
	const [recents, setRecents] = useState<RecentProject[]>([]);

	useEffect(() => {
		void getActiveProject().then(setActive);
		void getRecentProjects().then(setRecents);
	}, []);

	const load = async (path: string) => {
		try {
			await openProject(path);
			window.location.reload();
		} catch (e) {
			toast({ variant: 'destructive', description: errorToString(e), title: 'Could not open project' });
			setRecents(await getRecentProjects());
		}
	};

	const close = async () => {
		try {
			await closeProject();
			window.location.reload();
		} catch (e) {
			toast({ variant: 'destructive', description: errorToString(e), title: 'Could not close project' });
		}
	};

	const browse = async () => {
		const picked = await open({ multiple: false, filters: [{ extensions: ['frg'], name: 'Forge Project' }] });
		if (typeof picked === 'string') await load(picked);
	};

	return (
		<MenubarSub>
			<MenubarSubTrigger>
				<Package className="mr-2 h-3.5 w-3.5" />
				Project
			</MenubarSubTrigger>
			<MenubarSubContent>
				{active && (
					<>
						<MenubarItem disabled className="opacity-100">
							<FolderGit2 className="mr-2 h-3.5 w-3.5 text-primary" />
							{active.name}
						</MenubarItem>
						<MenubarSeparator />
					</>
				)}
				<MenubarItem onSelect={() => void browse()}>Open Project...</MenubarItem>
				<MenubarItem disabled={!active} onSelect={() => void close()}>
					Close Project
				</MenubarItem>
				{recents.length > 0 && (
					<>
						<MenubarSeparator />
						{recents.map((entry) => (
							<MenubarItem key={entry.path} title={entry.path} disabled={!entry.available} onSelect={() => void load(entry.path)}>
								{entry.name ?? entry.path}
							</MenubarItem>
						))}
						<MenubarSeparator />
						<MenubarItem
							onSelect={() => {
								void clearRecentProjects().then(setRecents);
							}}
						>
							Clear Recent Projects
						</MenubarItem>
					</>
				)}
			</MenubarSubContent>
		</MenubarSub>
	);
}
