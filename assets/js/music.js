import { initPageShell, registerServiceWorker } from './site-shell.js';
import { initMusicEmbeds } from './music-embeds.js';

initPageShell();
initMusicEmbeds();
registerServiceWorker();
