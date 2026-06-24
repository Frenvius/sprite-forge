import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';

import { Input } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from '~/components/ui/select';

interface FindDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const PROPERTIES = [
	'Is Ground',
	'Ground Border',
	'Bottom',
	'Top',
	'Has Light',
	'Automap',
	'Has Offset',
	'Has Elevation',
	'Equip',
	'Market',
	'Writable',
	'Writable Once',
	'Has Action',
	'Container',
	'Stackable',
	'Force Use',
	'Multi Use',
	'Fluid Container',
	'Fluid',
	'Unpassable',
	'Unmovable',
	'Block Missile',
	'Block Pathfinder',
	'No Move Animation',
	'Pickupable',
	'Hangable',
	'Hook East',
	'Hook South',
	'Rotatable',
	"Don't Hide",
	'Translucent',
	'Lying Object',
	'Animate Always',
	'Full Ground',
	'Ignore Look',
	'Wrappable',
	'Unwrappable',
	'Top effect',
	'Useable',
	'Has Charges',
	'Floor Change',
	'Lens Help',
	'Is Animation'
];

export const FindDialog = ({ open, onOpenChange }: FindDialogProps) => {
	const [properties, setProperties] = useState<Record<string, boolean>>(
		PROPERTIES.reduce((acc, prop) => ({ ...acc, [prop]: false }), {})
	);
	const [name, setName] = useState('');

	const handlePropertyToggle = (property: string) => {
		setProperties((prev) => ({ ...prev, [property]: !prev[property] }));
	};

	const handleFind = () => {
		// TODO: Implement find logic
	};

	const handleSelect = () => {
		// TODO: Implement select logic
	};

	const handleClear = () => {
		setProperties(PROPERTIES.reduce((acc, prop) => ({ ...acc, [prop]: false }), {}));
		setName('');
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl h-[600px] p-0 flex flex-col [&>button]:hidden">
				<Tabs defaultValue="objects" className="flex-1 flex flex-col overflow-hidden">
					<div className="border-b border-border">
						<div className="h-8 bg-muted/50 flex items-center justify-between px-4">
							<span className="text-sm font-medium">Find</span>
							<button
								onClick={() => onOpenChange(false)}
								className="w-6 h-6 flex items-center justify-center hover:bg-accent rounded transition-colors"
							>
								<X className="h-3 w-3" />
							</button>
						</div>
						<div className="px-4">
							<TabsList className="h-8 bg-transparent p-0 gap-0">
								<TabsTrigger
									value="objects"
									className="h-8 px-3 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
								>
									Objects
								</TabsTrigger>
							</TabsList>
						</div>
					</div>

					<TabsContent value="objects" className="flex-1 flex overflow-hidden mt-0">
						<div className="flex-1 flex overflow-hidden">
							<div className="w-80 border-r border-border p-4 flex flex-col overflow-hidden">
								<div className="mb-4">
									<label className="text-xs font-medium mb-2 block">Properties</label>
									<Select>
										<SelectTrigger className="h-8 text-xs">
											<SelectValue placeholder="Item" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="item">Item</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<ScrollArea className="flex-1 pr-2">
									<div className="space-y-2">
										{PROPERTIES.map((property) => (
											<div key={property} className="flex items-center justify-between">
												<span className="text-xs">{property}</span>
												<Switch checked={properties[property]} onCheckedChange={() => handlePropertyToggle(property)} />
											</div>
										))}
									</div>
								</ScrollArea>

								<div className="mt-4 pt-4 border-t border-border">
									<label className="text-xs font-medium mb-2 block">Name:</label>
									<Input value={name} placeholder="" className="h-8 text-xs" onChange={(e) => setName(e.target.value)} />
								</div>
							</div>

							<div className="flex-1 p-4 flex flex-col">
								<div className="text-xs font-medium mb-2">Found</div>
								<div className="flex-1 border border-border rounded bg-muted/20" />
							</div>
						</div>
					</TabsContent>
				</Tabs>

				<div className="h-12 border-t border-border flex items-center justify-end gap-2 px-4">
					<Button size="sm" onClick={handleFind} className="h-8 text-xs">
						Find
					</Button>
					<Button size="sm" variant="outline" onClick={handleSelect} className="h-8 text-xs">
						Select
					</Button>
					<Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleClear}>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
