import { Simulation } from './simulation';
import { Renderer } from './renderer';
import { PopulationChart } from './chart';
import { CELL_SIZE, DEFAULT_CONFIG } from './types';
import type { SimConfig } from './types';
import './style.css';

// --- Config persistence ---
const STORAGE_KEY = 'speciessim-config';

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

// --- State ---
let userConfig = loadConfig();
let sim = new Simulation(userConfig);
let paused = false;
let speed = 1; // 1 = every 4th frame, 10 = every frame * multiple ticks
let frameCount = 0;
let tool: 'road' | 'erase' | 'prey' | 'predator' = 'road';
let isDrawing = false;

// --- DOM ---
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div class="layout">
    <header class="header">
      <h1 class="logo">Species<span class="logo-accent">Sim</span></h1>
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
              <label>Initial count</label>
              <input type="range" min="10" max="400" step="10" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="preySpeed">
              <label>Speed</label>
              <input type="range" min="0.5" max="3" step="0.1" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="preyVision">
              <label>Vision range</label>
              <input type="range" min="2" max="15" step="1" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="preyEnergyFromGrass">
              <label>Energy from grass</label>
              <input type="range" min="2" max="40" step="1" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="preyReproductionThreshold">
              <label>Reproduce at energy</label>
              <input type="range" min="20" max="120" step="5" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="preyMaxAge">
              <label>Max age (ticks)</label>
              <input type="range" min="100" max="1000" step="50" />
              <span class="param-val"></span>
            </div>
          </div>

          <div class="settings-col">
            <h3 class="settings-heading pred-color">Predators</h3>
            <div class="param-row" data-key="initialPredators">
              <label>Initial count</label>
              <input type="range" min="5" max="100" step="5" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="predatorSpeed">
              <label>Speed</label>
              <input type="range" min="0.5" max="3" step="0.1" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="predatorVision">
              <label>Vision range</label>
              <input type="range" min="2" max="15" step="1" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="predatorEnergyFromPrey">
              <label>Energy from prey</label>
              <input type="range" min="10" max="80" step="5" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="predatorReproductionThreshold">
              <label>Reproduce at energy</label>
              <input type="range" min="30" max="150" step="5" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="predatorMaxAge">
              <label>Max age (ticks)</label>
              <input type="range" min="100" max="1000" step="50" />
              <span class="param-val"></span>
            </div>
          </div>

          <div class="settings-col">
            <h3 class="settings-heading">World</h3>
            <div class="param-row" data-key="grassGrowthRate">
              <label>Grass growth rate</label>
              <input type="range" min="0.002" max="0.06" step="0.001" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="roadKillChance">
              <label>Road kill chance</label>
              <input type="range" min="0" max="1" step="0.05" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="movementEnergyCost">
              <label>Movement energy cost</label>
              <input type="range" min="0.1" max="2" step="0.1" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="catchChance">
              <label>Catch chance</label>
              <input type="range" min="0.1" max="1" step="0.05" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="huntCooldown">
              <label>Hunt cooldown (ticks)</label>
              <input type="range" min="0" max="40" step="1" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="grassCoverVisionReduction">
              <label>Grass cover (vision reduction)</label>
              <input type="range" min="0" max="0.9" step="0.05" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="predatorMovementEnergyCost">
              <label>Predator energy drain</label>
              <input type="range" min="0.1" max="3" step="0.1" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="preyAlarmRadius">
              <label>Prey alarm radius</label>
              <input type="range" min="0" max="15" step="1" />
              <span class="param-val"></span>
            </div>
            <div class="param-row" data-key="initialRoads">
              <label>Initial roads</label>
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
          <button id="btn-play" class="btn btn-primary">Pause</button>
          <button id="btn-restart" class="btn" title="Restart with same map">Reset</button>
          <button id="btn-reset" class="btn">Randomize</button>
          <div class="divider"></div>
          <label class="label">Speed</label>
          <input type="range" id="speed" min="0.25" max="10" step="0.25" value="1" class="slider" />
          <span id="speed-val" class="slider-val">1x</span>
        </div>

        <div class="bottom-section">
          <div class="tool-row">
            <button class="btn tool-btn active" data-tool="road">
              <span class="tool-icon road-icon"></span>Road
            </button>
            <button class="btn tool-btn" data-tool="erase">
              <span class="tool-icon erase-icon"></span>Erase
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

      <div class="bottom-row">
        <canvas id="chart" height="120"></canvas>
      </div>
    </footer>
  </div>
`;

const worldCanvas = document.getElementById('world') as HTMLCanvasElement;
const chartCanvas = document.getElementById('chart') as HTMLCanvasElement;
const statsEl = document.getElementById('stats')!;
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const speedSlider = document.getElementById('speed') as HTMLInputElement;
const speedVal = document.getElementById('speed-val')!;

const seedInput = document.getElementById('seed-input') as HTMLInputElement;
const btnLoadSeed = document.getElementById('btn-load-seed') as HTMLButtonElement;
const btnCopySeed = document.getElementById('btn-copy-seed') as HTMLButtonElement;

let rendererInstance = new Renderer(worldCanvas, sim);
const chart = new PopulationChart(chartCanvas);

// --- Seed UI ---
function updateSeedDisplay() {
  seedInput.value = String(sim.seed);
}
updateSeedDisplay();

btnCopySeed.addEventListener('click', () => {
  navigator.clipboard.writeText(String(sim.seed));
  btnCopySeed.textContent = 'Copied!';
  setTimeout(() => { btnCopySeed.textContent = 'Copy'; }, 1200);
});

btnLoadSeed.addEventListener('click', () => {
  const seed = parseInt(seedInput.value);
  if (isNaN(seed)) return;
  sim = new Simulation(sim.config, seed);
  rendererInstance = new Renderer(worldCanvas, sim);
  updateSeedDisplay();
  syncSettingsUI();
  paused = true;
  btnPlay.textContent = 'Play';
  btnPlay.classList.add('btn-paused');
});

seedInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnLoadSeed.click();
});

function resizeChart() {
  const rect = chartCanvas.getBoundingClientRect();
  chartCanvas.width = Math.round(rect.width * devicePixelRatio);
  chartCanvas.height = Math.round(rect.height * devicePixelRatio);
  chartCanvas.getContext('2d')!.scale(devicePixelRatio, devicePixelRatio);
}
resizeChart();
window.addEventListener('resize', resizeChart);

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
  btnPlay.textContent = 'Play';
  btnPlay.classList.add('btn-paused');
  settingsModal.classList.remove('hidden');
}

function closeSettings() {
  settingsModal.classList.add('hidden');
  if (!pausedBeforeSettings) {
    paused = false;
    btnPlay.textContent = 'Pause';
    btnPlay.classList.remove('btn-paused');
  }
}

btnSettings.addEventListener('click', openSettings);
btnCloseSettings.addEventListener('click', closeSettings);

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettings();
});

// Initialize all param sliders from current config
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

function formatParamValue(key: string, value: number): string {
  if (key.includes('Rate') || key.includes('Chance') || key.includes('Cost')) {
    return value.toFixed(key === 'grassGrowthRate' ? 3 : 2);
  }
  if (key.includes('Speed')) return value.toFixed(1);
  return String(Math.round(value));
}

// Bind slider changes
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
  Object.assign(sim.config, DEFAULT_CONFIG);
  saveConfig(sim.config);
  syncSettingsUI();
});

syncSettingsUI();

// --- Controls ---
btnPlay.addEventListener('click', () => {
  paused = !paused;
  btnPlay.textContent = paused ? 'Play' : 'Pause';
  btnPlay.classList.toggle('btn-paused', paused);
});

const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;

btnRestart.addEventListener('click', () => {
  sim.reset();
  paused = true;
  btnPlay.textContent = 'Play';
  btnPlay.classList.add('btn-paused');
});

btnReset.addEventListener('click', () => {
  sim = new Simulation(sim.config);
  rendererInstance = new Renderer(worldCanvas, sim);
  updateSeedDisplay();
  syncSettingsUI();
  paused = true;
  btnPlay.textContent = 'Play';
  btnPlay.classList.add('btn-paused');
});

speedSlider.addEventListener('input', () => {
  speed = parseFloat(speedSlider.value);
  speedVal.textContent = speed < 1 ? `${speed}x` : `${Math.round(speed)}x`;
});

// Tool selection
document.querySelectorAll('.tool-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    tool = (btn as HTMLElement).dataset.tool as typeof tool;
  });
});

// Canvas interaction
function canvasToGrid(e: MouseEvent): [number, number] {
  const rect = worldCanvas.getBoundingClientRect();
  const scaleX = worldCanvas.width / rect.width;
  const scaleY = worldCanvas.height / rect.height;
  const x = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE);
  const y = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE);
  return [x, y];
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

worldCanvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  const [x, y] = canvasToGrid(e);
  applyTool(x, y);
});

worldCanvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  const [x, y] = canvasToGrid(e);
  applyTool(x, y);
});

window.addEventListener('mouseup', () => {
  isDrawing = false;
});

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
    // speed 0.25 = 1 tick every 16 frames
    // speed 0.5  = 1 tick every 8 frames
    // speed 1    = 1 tick every 4 frames
    // speed 5    = 1 tick every frame
    // speed 10   = 6 ticks per frame
    const frameSkip = Math.max(1, Math.round(4 / speed));
    const ticksPerFrame = speed > 4 ? Math.round(speed - 3) : 1;

    if (frameCount % frameSkip === 0) {
      for (let i = 0; i < ticksPerFrame; i++) {
        sim.step();
      }
    }
  }

  rendererInstance.render();
  chart.render(sim.history);
  updateStats();

  requestAnimationFrame(loop);
}

loop();
