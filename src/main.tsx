import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import './index.css';
import './lib/formats/tibia/handler';

if (typeof window !== 'undefined') {
	document.addEventListener('contextmenu', (e) => {
		e.preventDefault();
	});

	window.addEventListener('dragover', (e) => {
		e.preventDefault();
	});
	window.addEventListener('drop', (e) => {
		if (!(e.target as null | HTMLElement)?.closest('[data-file-drop="true"]')) {
			e.preventDefault();
		}
	});
}

createRoot(document.getElementById('root')!).render(<App />);
