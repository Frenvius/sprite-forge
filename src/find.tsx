import { createRoot } from 'react-dom/client';

import FindApp from './FindApp';
import './index.css';

if (typeof window !== 'undefined') {
	document.addEventListener('contextmenu', (e) => {
		e.preventDefault();
	});
}

createRoot(document.getElementById('root')!).render(<FindApp />);
