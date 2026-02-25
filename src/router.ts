export type Route = 'sim' | 'ga';
type MountFn = (appEl: HTMLElement) => (() => void);

const routes: Record<string, MountFn> = {};
let currentCleanup: (() => void) | null = null;

export function registerRoute(route: Route, mount: MountFn) {
  routes[route] = mount;
}

export function startRouter(appEl: HTMLElement) {
  function navigate() {
    const hash = window.location.hash || '#/sim';
    const route = hash.replace('#/', '');

    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }

    const mount = routes[route] || routes['sim'];
    if (mount) {
      currentCleanup = mount(appEl);
    }
  }

  window.addEventListener('hashchange', navigate);
  navigate();
}
