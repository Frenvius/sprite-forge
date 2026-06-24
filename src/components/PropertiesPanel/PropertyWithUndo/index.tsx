import React from 'react';
import { Undo2 } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { usePropertiesContext } from '~/usecase/context/PropertiesContext';

interface PropertyWithUndoProps {
	property: string;
	children: React.ReactNode;
}

export const PropertyWithUndo = ({ property, children }: PropertyWithUndoProps) => {
	const { hasPropertyChanged, handleUndoProperty } = usePropertiesContext();
	const hasChanged = hasPropertyChanged(property);
	return (
		<div className="flex items-center gap-1">
			{hasChanged && (
				<Button
					size="icon"
					variant="ghost"
					title="Undo to original"
					onClick={() => handleUndoProperty(property)}
					className="h-5 w-5 p-0 hover:bg-primary/20 hover:text-primary"
				>
					<Undo2 className="h-2 w-2" />
				</Button>
			)}
			{children}
		</div>
	);
};
