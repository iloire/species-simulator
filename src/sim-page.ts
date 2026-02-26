import { Simulation } from './simulation';
import { Renderer } from './renderer';
import { CELL_SIZE, DEFAULT_CONFIG } from './types';
import type { SimConfig } from './types';

const STORAGE_KEY = 'speciessim-config';

const PARAM_HELP: Record<string, string> = {
  initialPrey: 'Number of prey spawned when the simulation starts or is randomized.',
  preySpeed: 'Cells moved per tick. The fractional part is a chance for an extra step (e.g. 1.3 = 1 cell + 30% chance of 2).',
  preyVision: 'How far prey can detect predators and grass, in cells.',
  preyEnergyFromGrass: 'Energy gained each time a prey eats a grass tile.',
  preyReproductionThreshold: 'When energy exceeds this, prey splits into two (energy halved).',
  preyMaxAge: 'Ticks before a prey dies of old age.',
  initialPredators: 'Number of predators spawned when the simulation starts or is randomized.',
  predatorSpeed: 'Cells moved per tick. The fractional part is a chance for an extra step.',
  predatorVision: 'How far predators can spot prey, in cells.',
  predatorEnergyFromPrey: 'Energy gained each time a predator catches a prey.',
  predatorReproductionThreshold: 'When energy exceeds this, predator splits into two (energy halved).',
  predatorMaxAge: 'Ticks before a predator dies of old age.',
  grassGrowthRate: 'Chance per tick that an empty cell grows grass. Higher = faster regrowth.',
  roadKillChance: 'Chance per tick that a creature standing on a road tile dies.',
  movementEnergyCost: 'Energy prey spends per tick while moving.',
  catchChance: 'Probability that a predator catches an adjacent prey each tick.',
  huntCooldown: 'Ticks a predator rests after a successful kill before hunting again.',
  grassCoverVisionReduction: 'Fraction of predator vision lost when prey hides on a grass tile (0.5 = 50% shorter detection range).',
  predatorMovementEnergyCost: 'Energy predators spend per tick while moving.',
  preyAlarmRadius: 'When a prey is killed, nearby prey within this radius flee.',
  initialRoads: 'Number of roads generated across the map at start.',
};

function loadConfig(): Partial<SimConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveConfig(config: SimConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function orientedConfig(overrides: Partial<SimConfig> = {}): Partial<SimConfig> {
  const isPortrait = window.innerHeight > window.innerWidth;
  const base = { ...overrides };
  if (isPortrait) {
    base.width = overrides.height ?? DEFAULT_CONFIG.height;
    base.height = overrides.width ?? DEFAULT_CONFIG.width;
  }
  return base;
}

function formatParamValue(key: string, value: number): string {
  if (key.includes('Rate') || key.includes('Chance') || key.includes('Cost')) {
    return value.toFixed(key === 'grassGrowthRate' ? 3 : 2);
  }
  if (key.includes('Speed')) return value.toFixed(1);
  return String(Math.round(value));
}

export function mountSimPage(appEl: HTMLElement): () => void {
  let userConfig = loadConfig();
  let sim = new Simulation(orientedConfig(userConfig));
  let paused = true;
  let speed = 1;
  let frameCount = 0;
  let tool: 'road' | 'erase' | 'prey' | 'predator' = 'road';
  let isDrawing = false;
  let lastGridX = -1;
  let lastGridY = -1;
  let rafId = 0;

  appEl.innerHTML = `
    <div class="layout">
      <header class="header">
        <h1 class="logo">Species<span class="logo-accent">Sim</span></h1>
        <nav class="nav-tabs">
          <a href="#/sim" class="nav-tab active">Simulation</a>
          <a href="#/ga" class="nav-tab">Evolve</a>
        </nav>
        <div class="header-stats" id="stats"></div>
        <div class="seed-group">
          <label class="label seed-label">Seed</label>
          <input type="text" id="seed-input" class="seed-input" />
          <button id="btn-load-seed" class="btn btn-sm" title="Load this seed">Go</button>
          <button id="btn-copy-seed" class="btn btn-sm btn-icon-sm" title="Copy seed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
        <div class="header-actions">
          <button id="btn-settings" class="btn btn-icon" title="Settings">&#9881;</button>
          <button id="btn-help" class="btn btn-help">?</button>
        </div>
      </header>

      <div id="settings-modal" class="modal-overlay hidden">
        <div class="modal modal-wide">
          <button id="btn-close-settings" class="modal-close">&times;</button>
          <h2 class="modal-title">Parameters</h2>

          <div class="settings-grid">
            <div class="settings-col">
              <h3 class="settings-heading prey-color">Prey</h3>
              <div class="param-row" data-key="initialPrey">
                <label>Initial count <span class="param-help" data-tip="${PARAM_HELP.initialPrey}">?</span></label>
                <input type="range" min="10" max="400" step="10" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="preySpeed">
                <label>Speed <span class="param-help" data-tip="${PARAM_HELP.preySpeed}">?</span></label>
                <input type="range" min="0.5" max="3" step="0.1" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="preyVision">
                <label>Vision range <span class="param-help" data-tip="${PARAM_HELP.preyVision}">?</span></label>
                <input type="range" min="2" max="15" step="1" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="preyEnergyFromGrass">
                <label>Energy from grass <span class="param-help" data-tip="${PARAM_HELP.preyEnergyFromGrass}">?</span></label>
                <input type="range" min="2" max="40" step="1" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="preyReproductionThreshold">
                <label>Reproduce at energy <span class="param-help" data-tip="${PARAM_HELP.preyReproductionThreshold}">?</span></label>
                <input type="range" min="20" max="120" step="5" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="preyMaxAge">
                <label>Max age (ticks) <span class="param-help" data-tip="${PARAM_HELP.preyMaxAge}">?</span></label>
                <input type="range" min="100" max="1000" step="50" />
                <span class="param-val"></span>
              </div>
            </div>

            <div class="settings-col">
              <h3 class="settings-heading pred-color">Predators</h3>
              <div class="param-row" data-key="initialPredators">
                <label>Initial count <span class="param-help" data-tip="${PARAM_HELP.initialPredators}">?</span></label>
                <input type="range" min="5" max="100" step="5" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="predatorSpeed">
                <label>Speed <span class="param-help" data-tip="${PARAM_HELP.predatorSpeed}">?</span></label>
                <input type="range" min="0.5" max="3" step="0.1" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="predatorVision">
                <label>Vision range <span class="param-help" data-tip="${PARAM_HELP.predatorVision}">?</span></label>
                <input type="range" min="2" max="15" step="1" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="predatorEnergyFromPrey">
                <label>Energy from prey <span class="param-help" data-tip="${PARAM_HELP.predatorEnergyFromPrey}">?</span></label>
                <input type="range" min="10" max="80" step="5" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="predatorReproductionThreshold">
                <label>Reproduce at energy <span class="param-help" data-tip="${PARAM_HELP.predatorReproductionThreshold}">?</span></label>
                <input type="range" min="30" max="150" step="5" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="predatorMaxAge">
                <label>Max age (ticks) <span class="param-help" data-tip="${PARAM_HELP.predatorMaxAge}">?</span></label>
                <input type="range" min="100" max="1000" step="50" />
                <span class="param-val"></span>
              </div>
            </div>

            <div class="settings-col">
              <h3 class="settings-heading">World</h3>
              <div class="param-row" data-key="grassGrowthRate">
                <label>Grass growth rate <span class="param-help" data-tip="${PARAM_HELP.grassGrowthRate}">?</span></label>
                <input type="range" min="0.002" max="0.06" step="0.001" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="roadKillChance">
                <label>Road kill chance <span class="param-help" data-tip="${PARAM_HELP.roadKillChance}">?</span></label>
                <input type="range" min="0" max="1" step="0.05" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="movementEnergyCost">
                <label>Movement energy cost <span class="param-help" data-tip="${PARAM_HELP.movementEnergyCost}">?</span></label>
                <input type="range" min="0.1" max="2" step="0.1" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="catchChance">
                <label>Catch chance <span class="param-help" data-tip="${PARAM_HELP.catchChance}">?</span></label>
                <input type="range" min="0.1" max="1" step="0.05" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="huntCooldown">
                <label>Hunt cooldown (ticks) <span class="param-help" data-tip="${PARAM_HELP.huntCooldown}">?</span></label>
                <input type="range" min="0" max="40" step="1" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="grassCoverVisionReduction">
                <label>Grass cover (vision reduction) <span class="param-help" data-tip="${PARAM_HELP.grassCoverVisionReduction}">?</span></label>
                <input type="range" min="0" max="0.9" step="0.05" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="predatorMovementEnergyCost">
                <label>Predator energy drain <span class="param-help" data-tip="${PARAM_HELP.predatorMovementEnergyCost}">?</span></label>
                <input type="range" min="0.1" max="3" step="0.1" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="preyAlarmRadius">
                <label>Prey alarm radius <span class="param-help" data-tip="${PARAM_HELP.preyAlarmRadius}">?</span></label>
                <input type="range" min="0" max="15" step="1" />
                <span class="param-val"></span>
              </div>
              <div class="param-row" data-key="initialRoads">
                <label>Initial roads <span class="param-help" data-tip="${PARAM_HELP.initialRoads}">?</span></label>
                <input type="range" min="0" max="6" step="1" />
                <span class="param-val"></span>
              </div>
            </div>
          </div>

          <div class="settings-footer">
            <button id="btn-reset-defaults" class="btn">Reset to Defaults</button>
            <p class="info-text muted">Changes apply live &amp; are saved automatically. Initial counts apply on next Randomize.</p>
          </div>
        </div>
      </div>

      <div id="help-modal" class="modal-overlay hidden">
        <div class="modal">
          <button id="btn-close-help" class="modal-close">&times;</button>
          <h2 class="modal-title">How <span class="logo-accent">SpeciesSim</span> Works</h2>

          <div class="modal-body">
            <div class="modal-section">
              <h3>The Ecosystem</h3>
              <p>A self-regulating world where populations rise and fall based on energy, food, and predation. Watch classic <em>Lotka-Volterra</em> dynamics emerge naturally.</p>
            </div>

            <div class="modal-section">
              <h3><span class="prey-color">&#9679;</span> Prey</h3>
              <p>Eat grass to gain energy. Flee from nearby predators. Reproduce when energy is high. Die of old age or starvation.</p>
            </div>

            <div class="modal-section">
              <h3><span class="pred-color">&#9679;</span> Predators</h3>
              <p>Hunt and eat prey for energy. Faster and with wider vision than prey. Starve quickly without food — their population crashes follow prey declines.</p>
            </div>

            <div class="modal-section">
              <h3><span class="road-color">&#9632;</span> Roads</h3>
              <p>Block grass growth and fragment habitat. Creatures crossing roads have a 30% chance of dying. Use roads to split the ecosystem and observe isolated populations.</p>
            </div>

            <div class="modal-section">
              <h3>Tools</h3>
              <ul class="modal-list">
                <li><strong>Road</strong> — Click &amp; drag to draw roads</li>
                <li><strong>Erase</strong> — Remove roads</li>
                <li><strong>+ Prey / + Predator</strong> — Spawn creatures at cursor</li>
              </ul>
            </div>

            <div class="modal-section">
              <h3>Tips</h3>
              <ul class="modal-list">
                <li>Draw a road wall across the map to see two isolated ecosystems evolve differently</li>
                <li>If predators go extinct, prey will explode and eat all the grass</li>
                <li>Reintroduce predators to a prey-dominated area to restore balance</li>
                <li>Use the population chart to track boom-bust cycles</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <main class="main">
        <div class="canvas-wrap">
          <canvas id="world"></canvas>
        </div>
      </main>

      <footer class="bottom-bar">
        <div class="bottom-row">
          <div class="bottom-section">
            <button id="btn-play" class="btn btn-primary" title="Pause"></button>
            <button id="btn-restart" class="btn" title="Restart with same map">Reset</button>
            <button id="btn-reset" class="btn">Randomize</button>
            <div class="divider"></div>
            <label class="label">Speed</label>
            <input type="range" id="speed" min="0" max="4" step="1" value="2" class="slider" />
            <span id="speed-val" class="slider-val">1x</span>
          </div>

          <div class="bottom-section">
            <div class="tool-row">
              <button class="btn tool-btn active" data-tool="road">
                <span class="tool-icon road-icon"></span>Road
              </button>
              <button class="btn tool-btn" data-tool="prey">
                <span class="tool-icon prey-dot"></span>+ Prey
              </button>
              <button class="btn tool-btn" data-tool="predator">
                <span class="tool-icon pred-dot"></span>+ Predator
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `;

  const worldCanvas = document.getElementById('world') as HTMLCanvasElement;
  const statsEl = document.getElementById('stats')!;
  const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
  const ICON_PAUSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  const ICON_PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>';
  const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
  const speedSlider = document.getElementById('speed') as HTMLInputElement;
  const speedVal = document.getElementById('speed-val')!;
  const seedInput = document.getElementById('seed-input') as HTMLInputElement;
  const btnLoadSeed = document.getElementById('btn-load-seed') as HTMLButtonElement;
  const btnCopySeed = document.getElementById('btn-copy-seed') as HTMLButtonElement;

  btnPlay.innerHTML = ICON_PLAY;
  btnPlay.classList.add('btn-paused');

  let rendererInstance = new Renderer(worldCanvas, sim);

  // --- Seed UI ---
  function updateSeedDisplay() {
    seedInput.value = String(sim.seed);
  }
  updateSeedDisplay();

  const copyIcon = btnCopySeed.innerHTML;
  const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  btnCopySeed.addEventListener('click', () => {
    navigator.clipboard.writeText(String(sim.seed));
    btnCopySeed.innerHTML = checkIcon;
    setTimeout(() => { btnCopySeed.innerHTML = copyIcon; }, 1200);
  });

  btnLoadSeed.addEventListener('click', () => {
    const seed = parseInt(seedInput.value);
    if (isNaN(seed)) return;
    sim = new Simulation(orientedConfig(sim.config), seed);
    rendererInstance = new Renderer(worldCanvas, sim);
    updateSeedDisplay();
    syncSettingsUI();
    paused = true;
    btnPlay.innerHTML = ICON_PLAY;
    btnPlay.classList.add('btn-paused');
  });

  seedInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnLoadSeed.click();
  });

  // --- Help Modal ---
  const helpModal = document.getElementById('help-modal')!;
  const btnHelp = document.getElementById('btn-help') as HTMLButtonElement;
  const btnCloseHelp = document.getElementById('btn-close-help') as HTMLButtonElement;

  btnHelp.addEventListener('click', () => {
    helpModal.classList.remove('hidden');
  });

  btnCloseHelp.addEventListener('click', () => {
    helpModal.classList.add('hidden');
  });

  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.add('hidden');
  });

  // --- Settings Modal ---
  const settingsModal = document.getElementById('settings-modal')!;
  const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement;
  const btnCloseSettings = document.getElementById('btn-close-settings') as HTMLButtonElement;
  const btnResetDefaults = document.getElementById('btn-reset-defaults') as HTMLButtonElement;

  let pausedBeforeSettings = false;

  function openSettings() {
    pausedBeforeSettings = paused;
    paused = true;
    btnPlay.innerHTML = ICON_PLAY;
    btnPlay.classList.add('btn-paused');
    settingsModal.classList.remove('hidden');
  }

  function closeSettings() {
    settingsModal.classList.add('hidden');
    if (!pausedBeforeSettings) {
      paused = false;
      btnPlay.innerHTML = ICON_PAUSE;
      btnPlay.classList.remove('btn-paused');
    }
  }

  btnSettings.addEventListener('click', openSettings);
  btnCloseSettings.addEventListener('click', closeSettings);

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  function syncSettingsUI() {
    settingsModal.querySelectorAll<HTMLDivElement>('.param-row').forEach((row) => {
      const key = row.dataset.key as keyof SimConfig;
      const input = row.querySelector('input') as HTMLInputElement;
      const valEl = row.querySelector('.param-val') as HTMLSpanElement;
      const value = sim.config[key] as number;
      input.value = String(value);
      valEl.textContent = formatParamValue(key, value);
    });
  }

  settingsModal.querySelectorAll<HTMLDivElement>('.param-row').forEach((row) => {
    const key = row.dataset.key as keyof SimConfig;
    const input = row.querySelector('input') as HTMLInputElement;
    const valEl = row.querySelector('.param-val') as HTMLSpanElement;

    input.addEventListener('input', () => {
      const num = parseFloat(input.value);
      (sim.config as unknown as Record<string, number>)[key] = num;
      valEl.textContent = formatParamValue(key, num);
      saveConfig(sim.config);
    });
  });

  btnResetDefaults.addEventListener('click', () => {
    const defaults = { ...DEFAULT_CONFIG, ...orientedConfig() };
    sim = new Simulation(defaults);
    rendererInstance = new Renderer(worldCanvas, sim);
    saveConfig(sim.config);
    updateSeedDisplay();
    syncSettingsUI();
  });

  syncSettingsUI();

  // --- Controls ---
  btnPlay.addEventListener('click', () => {
    paused = !paused;
    btnPlay.innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
    btnPlay.classList.toggle('btn-paused', paused);
  });

  const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;

  btnRestart.addEventListener('click', () => {
    sim.reset();
    paused = true;
    btnPlay.innerHTML = ICON_PLAY;
    btnPlay.classList.add('btn-paused');
  });

  btnReset.addEventListener('click', () => {
    sim = new Simulation(sim.config);
    rendererInstance = new Renderer(worldCanvas, sim);
    updateSeedDisplay();
    syncSettingsUI();
    paused = true;
    btnPlay.innerHTML = ICON_PLAY;
    btnPlay.classList.add('btn-paused');
  });

  const speedSteps = [0.25, 0.5, 1, 2, 5];
  speedSlider.addEventListener('input', () => {
    speed = speedSteps[parseInt(speedSlider.value)];
    speedVal.textContent = `${speed}x`;
  });

  // Tool selection
  appEl.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      appEl.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      tool = (btn as HTMLElement).dataset.tool as typeof tool;
    });
  });

  // Canvas interaction
  function canvasToGrid(clientX: number, clientY: number): [number, number] {
    const rect = worldCanvas.getBoundingClientRect();
    const scaleX = worldCanvas.width / rect.width;
    const scaleY = worldCanvas.height / rect.height;
    const x = Math.floor(((clientX - rect.left) * scaleX) / CELL_SIZE);
    const y = Math.floor(((clientY - rect.top) * scaleY) / CELL_SIZE);
    return [x, y];
  }

  function plotLine(x0: number, y0: number, x1: number, y1: number, cb: (x: number, y: number) => void) {
    let dx = Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      cb(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function applyToolLine(x: number, y: number) {
    if (lastGridX >= 0 && (lastGridX !== x || lastGridY !== y)) {
      plotLine(lastGridX, lastGridY, x, y, applyTool);
    } else {
      applyTool(x, y);
    }
    lastGridX = x;
    lastGridY = y;
  }

  function applyTool(x: number, y: number) {
    const brushSize = tool === 'road' || tool === 'erase' ? 1 : 0;

    for (let dy = -brushSize; dy <= brushSize; dy++) {
      for (let dx = -brushSize; dx <= brushSize; dx++) {
        const gx = x + dx;
        const gy = y + dy;
        if (tool === 'road') {
          sim.placeRoad(gx, gy);
        } else if (tool === 'erase') {
          sim.removeRoad(gx, gy);
        }
      }
    }

    if (tool === 'prey' || tool === 'predator') {
      const count = tool === 'predator' ? 1 : 3;
      for (let i = 0; i < count; i++) {
        const ox = x + Math.floor(Math.random() * 5) - 2;
        const oy = y + Math.floor(Math.random() * 5) - 2;
        sim['spawnCreature'](tool, ox, oy);
      }
    }
  }

  const onMouseDown = (e: MouseEvent) => {
    isDrawing = true;
    lastGridX = -1;
    lastGridY = -1;
    const [x, y] = canvasToGrid(e.clientX, e.clientY);
    applyToolLine(x, y);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDrawing) return;
    const [x, y] = canvasToGrid(e.clientX, e.clientY);
    applyToolLine(x, y);
  };

  const onMouseUp = () => {
    isDrawing = false;
  };

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    isDrawing = true;
    lastGridX = -1;
    lastGridY = -1;
    const touch = e.touches[0];
    const [x, y] = canvasToGrid(touch.clientX, touch.clientY);
    applyToolLine(x, y);
  };

  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const touch = e.touches[0];
    const [x, y] = canvasToGrid(touch.clientX, touch.clientY);
    applyToolLine(x, y);
  };

  const onTouchEnd = () => {
    isDrawing = false;
  };

  worldCanvas.addEventListener('mousedown', onMouseDown);
  worldCanvas.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  worldCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
  worldCanvas.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd);

  // --- Game Loop ---
  function updateStats() {
    const { prey, predators } = sim.getPopulationCounts();
    statsEl.innerHTML = `
      <span class="stat"><span class="stat-dot prey-dot"></span>${prey} prey</span>
      <span class="stat"><span class="stat-dot pred-dot"></span>${predators} predators</span>
      <span class="stat stat-tick">tick ${sim.tick}</span>
    `;
  }

  function loop() {
    frameCount++;

    if (!paused) {
      const frameSkip = Math.max(1, Math.round(4 / speed));
      const ticksPerFrame = speed > 4 ? Math.round(speed - 3) : 1;

      if (frameCount % frameSkip === 0) {
        for (let i = 0; i < ticksPerFrame; i++) {
          sim.step();
        }
      }
    }

    rendererInstance.render();
    updateStats();

    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  // Cleanup function
  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('touchend', onTouchEnd);
  };
}
