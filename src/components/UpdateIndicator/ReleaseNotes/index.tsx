import { type ReactNode } from 'react';

interface ReleaseNotesProps {
	notes: string;
}

const renderInline = (text: string): ReactNode[] => {
	const nodes: ReactNode[] = [];
	const regex = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g;
	let last = 0;
	let match: null | RegExpExecArray;
	let key = 0;

	while ((match = regex.exec(text))) {
		if (match.index > last) nodes.push(text.slice(last, match.index));
		if (match[1] !== undefined) {
			nodes.push(
				<strong key={key++} className="font-semibold text-foreground">
					{match[1]}
				</strong>
			);
		} else if (match[2] !== undefined) {
			nodes.push(
				<code key={key++} className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">
					{match[2]}
				</code>
			);
		} else if (match[3] !== undefined) {
			nodes.push(
				<a key={key++} href={match[4]} target="_blank" rel="noreferrer" className="text-primary underline">
					{match[3]}
				</a>
			);
		}
		last = regex.lastIndex;
	}
	if (last < text.length) nodes.push(text.slice(last));
	return nodes;
};

export const ReleaseNotes = ({ notes }: ReleaseNotesProps) => {
	const lines = notes.split('\n');
	const blocks: ReactNode[] = [];
	let bullets: string[] = [];
	let key = 0;

	const flush = () => {
		if (!bullets.length) return;
		blocks.push(
			<ul key={key++} className="list-disc pl-4 space-y-0.5">
				{bullets.map((b, i) => (
					<li key={i}>{renderInline(b)}</li>
				))}
			</ul>
		);
		bullets = [];
	};

	for (const raw of lines) {
		const line = raw.trim();
		if (!line) {
			flush();
			continue;
		}
		const heading = line.match(/^#{1,6}\s+(.*)$/);
		if (heading) {
			flush();
			blocks.push(
				<p key={key++} className="text-[10px] font-semibold uppercase tracking-wide text-foreground/80 mt-1 first:mt-0">
					{renderInline(heading[1])}
				</p>
			);
			continue;
		}
		const bullet = line.match(/^[-*]\s+(.*)$/);
		if (bullet) {
			bullets.push(bullet[1]);
			continue;
		}
		flush();
		blocks.push(
			<p key={key++} className="leading-relaxed">
				{renderInline(line)}
			</p>
		);
	}
	flush();

	return <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-1.5 pr-1">{blocks}</div>;
};
