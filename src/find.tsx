import { createRoot } from 'react-dom/client';

import FindApp from './FindApp';
import './index.css';
import { tibiaHandler } from './lib/formats/tibia/handler';
import { registerFormat } from './lib/formats/registry';

registerFormat(tibiaHandler);

if (typeof window !== 'undefined') {
	document.addEventListener('contextmenu', (e) => {
		e.preventDefault();
	});
}

createRoot(document.getElementById('root')!).render(<FindApp />);
