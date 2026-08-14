import { createRoot } from 'react-dom/client';

import TemplateApp from './TemplateApp';
import './index.css';
import { registerLuaFormats } from './lib/formats/lua';
import { registerFormat } from './lib/formats/registry';
import { isLuaEnabled } from './usecase/util/luaSettings';
import { tibiaHandler } from './lib/formats/tibia/handler';

if (typeof window !== 'undefined') {
	document.addEventListener('contextmenu', (e) => {
		e.preventDefault();
	});
}

async function boot() {
	registerFormat(tibiaHandler);
	if (isLuaEnabled()) await registerLuaFormats();

	createRoot(document.getElementById('root')!).render(<TemplateApp />);
}

void boot();
