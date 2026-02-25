import { registerRoute, startRouter } from './router';
import { mountSimPage } from './sim-page';
import { mountGAPage } from './ga-page';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

registerRoute('sim', mountSimPage);
registerRoute('ga', mountGAPage);

startRouter(app);
