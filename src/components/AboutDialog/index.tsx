import { useState, useEffect } from 'react';
import { Bug, Star, Github } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';

import { Button } from '~/components/ui/button';
import { Dialog, DialogTitle, DialogHeader, DialogContent, DialogDescription } from '~/components/ui/dialog';

interface AboutDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const AUTHOR_URL = 'https://github.com/Frenvius';
const REPO_URL = `${AUTHOR_URL}/sprite-forge`;
const ISSUES_URL = `${REPO_URL}/issues`;

export const AboutDialog = ({ open, onOpenChange }: AboutDialogProps) => {
	const [version, setVersion] = useState('');

	useEffect(() => {
		getVersion()
			.then(setVersion)
			.catch(() => {});
	}, []);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[440px] gap-0 p-0 overflow-hidden">
				<DialogHeader className="sr-only">
					<DialogTitle>About Sprite Forge</DialogTitle>
					<DialogDescription>Application information and resources</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col items-center px-6 pt-8 pb-5 border-b border-border/50">
					<img draggable={false} alt="Sprite Forge" src="/sprite-forge.png" className="h-20 w-20 mb-3 select-none" />
					<h2 className="text-2xl font-semibold tracking-tight">Sprite Forge</h2>
					{version && <span className="mt-1 text-sm font-mono text-primary">{version}</span>}
				</div>

				<div className="px-6 py-4 space-y-3 text-xs text-muted-foreground leading-relaxed">
					<p className="text-foreground">
						Copyright &copy; {new Date().getFullYear()}{' '}
						<button
							type="button"
							onClick={() => void openUrl(AUTHOR_URL)}
							className="text-primary underline-offset-2 hover:underline"
						>
							Frenvius
						</button>
					</p>
					<p className="uppercase text-[10px] tracking-wide">
						THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
						LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
						THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
						CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
						THE SOFTWARE.
					</p>
				</div>

				<div className="flex items-center gap-2 border-t border-border bg-muted/30 px-6 py-3">
					<Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => void openUrl(REPO_URL)}>
						<Github className="h-3.5 w-3.5" />
						GitHub
					</Button>
					<Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => void openUrl(ISSUES_URL)}>
						<Bug className="h-3.5 w-3.5" />
						Report Issue
					</Button>
					<Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => void openUrl(REPO_URL)}>
						<Star className="h-3.5 w-3.5" />
						Star
					</Button>
					<Button size="sm" variant="outline" className="ml-auto h-8 text-xs" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
