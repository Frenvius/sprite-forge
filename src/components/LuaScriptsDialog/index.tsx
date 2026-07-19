import React from 'react';
import { invoke } from '@tauri-apps/api/core';

import { Switch } from '~/components/ui/switch';
import { Button } from '~/components/ui/button';
import { highlightLua } from '~/usecase/util/luaHighlight';
import { isLuaEnabled, setLuaEnabled } from '~/usecase/util/luaSettings';
import { Dialog, DialogTitle, DialogFooter, DialogHeader, DialogContent } from '~/components/ui/dialog';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const LuaScriptsDialog = ({ open, onOpenChange }: Props) => {
	const initial = React.useRef(isLuaEnabled());
	const [enabled, setEnabled] = React.useState(initial.current);
	const [names, setNames] = React.useState<string[]>([]);
	const [active, setActive] = React.useState<null | string>(null);
	const [content, setContent] = React.useState('');
	const [dirty, setDirty] = React.useState(false);
	const [status, setStatus] = React.useState('');
	const [saving, setSaving] = React.useState(false);

	const textareaRef = React.useRef<null | HTMLTextAreaElement>(null);
	const preRef = React.useRef<null | HTMLPreElement>(null);

	React.useEffect(() => {
		if (!open) return;
		initial.current = isLuaEnabled();
		setEnabled(initial.current);
		setStatus('');
		void invoke<string[]>('list_scripts')
			.then((list) => {
				setNames(list);
				setActive((cur) => cur ?? list[0] ?? null);
			})
			.catch(() => setNames([]));
	}, [open]);

	React.useEffect(() => {
		if (!open || !active) return;
		setStatus('');
		void invoke<string>('read_script', { name: active })
			.then((text) => {
				setContent(text);
				setDirty(false);
			})
			.catch((e) => setStatus(`error: ${String(e)}`));
	}, [open, active]);

	const toggleDirty = enabled !== initial.current;

	const syncScroll = () => {
		const ta = textareaRef.current;
		const pre = preRef.current;
		if (!ta || !pre) return;
		pre.scrollTop = ta.scrollTop;
		pre.scrollLeft = ta.scrollLeft;
	};

	const save = () => {
		if (toggleDirty) setLuaEnabled(enabled);
		if (!active || !dirty) {
			if (toggleDirty) window.location.reload();
			return;
		}
		setSaving(true);
		setStatus('Saving...');
		void invoke<number>('write_script', { content, name: active })
			.then((n) => {
				setDirty(false);
				setStatus(`Saved. ${n} script${n === 1 ? '' : 's'} reloaded.`);
				if (toggleDirty) window.location.reload();
			})
			.catch((e) => setStatus(`error: ${String(e)}`))
			.finally(() => setSaving(false));
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Tab') {
			e.preventDefault();
			const ta = e.currentTarget;
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			const next = content.slice(0, start) + '\t' + content.slice(end);
			setContent(next);
			setDirty(true);
			requestAnimationFrame(() => {
				ta.selectionStart = ta.selectionEnd = start + 1;
			});
		}
	};

	const reloadFromDisk = () => {
		setStatus('');
		void invoke<string[]>('list_scripts')
			.then((list) => {
				setNames(list);
				const keep = active && list.includes(active) ? active : (list[0] ?? null);
				setActive(keep);
				if (dirty) {
					setStatus('Reloaded file list. Unsaved changes kept.');
					return;
				}
				if (!keep) {
					setContent('');
					setStatus('Reloaded from disk.');
					return;
				}
				void invoke<string>('read_script', { name: keep })
					.then((text) => {
						setContent(text);
						setDirty(false);
						setStatus('Reloaded from disk.');
					})
					.catch((e) => setStatus(`error: ${String(e)}`));
			})
			.catch((e) => setStatus(`error: ${String(e)}`));
	};

	const highlighted = React.useMemo(() => highlightLua(content), [content]);
	const saveDisabled = saving || (!dirty && !toggleDirty);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl gap-0 p-0 overflow-hidden flex flex-col max-h-[85vh]">
				<DialogHeader className="flex h-12 flex-row items-center justify-between gap-3 space-y-0 border-b border-border px-4 pr-10 py-0">
					<DialogTitle className="text-sm font-semibold leading-none">Lua Scripts</DialogTitle>
					<label className="flex items-center gap-2 text-xs text-muted-foreground">
						<span>{enabled ? 'Enabled' : 'Disabled'}</span>
						<Switch checked={enabled} onCheckedChange={setEnabled} />
					</label>
				</DialogHeader>
				<div className="flex h-[60vh] gap-3 p-4">
					<div className="w-44 flex-shrink-0 overflow-y-auto rounded-md border border-border bg-input">
						{names.map((name) => (
							<button
								key={name}
								onClick={() => setActive(name)}
								className={`block w-full truncate px-2.5 py-1.5 text-left text-xs ${
									name === active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
								}`}
							>
								{name}
							</button>
						))}
					</div>
					<div className="relative flex-1 overflow-hidden rounded-md border border-border bg-input">
						<pre
							aria-hidden
							ref={preRef}
							dangerouslySetInnerHTML={{ __html: highlighted }}
							className="pointer-events-none absolute inset-0 m-0 overflow-auto whitespace-pre px-3 py-2 font-mono text-xs leading-5 text-foreground"
						/>
						<textarea
							value={content}
							ref={textareaRef}
							spellCheck={false}
							onScroll={syncScroll}
							onKeyDown={handleKeyDown}
							disabled={!active || saving}
							onChange={(e) => {
								setContent(e.target.value);
								setDirty(true);
							}}
							className="absolute inset-0 m-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-3 py-2 font-mono text-xs leading-5 text-transparent caret-foreground focus-visible:outline-none"
						/>
					</div>
				</div>
				<DialogFooter className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
					<div className="mr-auto flex items-center gap-2">
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								void invoke('open_scripts_dir').catch((e) => setStatus(`error: ${String(e)}`));
							}}
						>
							Open Folder
						</Button>
						<Button size="sm" variant="ghost" onClick={reloadFromDisk}>
							Reload Files
						</Button>
					</div>
					<span className="self-center px-1 text-xs text-muted-foreground">{status}</span>
					<Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
						Close
					</Button>
					<Button size="sm" onClick={save} disabled={saveDisabled}>
						Save + Reload
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
