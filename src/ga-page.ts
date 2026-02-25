import { GARunner } from './ga-engine';
import type { EvalProgress } from './ga-engine';
import { FitnessChart } from './ga-chart';
import { Simulation } from './simulation';
import { Renderer } from './renderer';
import type { GAConfig, GenerationResult, EvolvableKey } from './ga-types';
import { DEFAULT_GA_CONFIG, EVOLVABLE_KEYS } from './ga-types';

const STORAGE_KEY = 'speciessim-config';
const GA_SETTINGS_KEY = 'speciessim-ga-settings';

const PARAM_LABELS: Record<EvolvableKey, { label: string; category: 'prey' | 'predator' | 'world' }> = {
  preySpeed:                    { label: 'Speed',                     category: 'prey' },
  preyVision:                   { label: 'Vision',                    category: 'prey' },
  preyReproductionThreshold:    { label: 'Reproduce at',              category: 'prey' },
  preyMaxAge:                   { label: 'Max age',                   category: 'prey' },
  predatorSpeed:                { label: 'Speed',                     category: 'predator' },
  predatorVision:               { label: 'Vision',                    category: 'predator' },
  predatorReproductionThreshold:{ label: 'Reproduce at',              category: 'predator' },
  predatorMaxAge:               { label: 'Max age',                   category: 'predator' },
  catchChance:                  { label: 'Catch chance',              category: 'world' },
};

function formatValue(key: string, value: number): string {
  if (key.includes('Rate') || key.includes('Chance') || key.includes('Cost')) {
    return value.toFixed(key === 'grassGrowthRate' ? 3 : 2);
  }
  if (key.includes('Speed')) return value.toFixed(1);
  return String(Math.round(value));
}

const CATEGORY_COLORS: Record<string, string> = {
  prey: 'var(--prey)',
  predator: 'var(--predator)',
  world: 'var(--text-muted)',
};

function loadGASettings(): { pop: number; gens: number; ticks: number } {
  try {
    const raw = localStorage.getItem(GA_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    pop: DEFAULT_GA_CONFIG.populationSize,
    gens: DEFAULT_GA_CONFIG.maxGenerations,
    ticks: DEFAULT_GA_CONFIG.simTicks,
  };
}

function saveGASettings(pop: number, gens: number, ticks: number) {
  localStorage.setItem(GA_SETTINGS_KEY, JSON.stringify({ pop, gens, ticks }));
}

export function mountGAPage(appEl: HTMLElement): () => void {
  let runner: GARunner | null = null;
  let history: GenerationResult[] = [];
  let bestResult: GenerationResult | null = null;
  let previewSim: Simulation | null = null;
  let previewRenderer: Renderer | null = null;
  let previewRafId = 0;
  let previewing = false;

  const saved = loadGASettings();

  const paramRows = EVOLVABLE_KEYS.map((key) => {
    const info = PARAM_LABELS[key];
    return `<div class="ga-param-row" data-key="${key}">
      <span class="ga-param-label" style="color:${CATEGORY_COLORS[info.category]}">${info.label}</span>
      <span class="ga-param-value" id="gp-${key}">—</span>
    </div>`;
  }).join('');

  appEl.innerHTML = `
    <div class="layout">
      <header class="header">
        <h1 class="logo">Species<span class="logo-accent">Sim</span></h1>
        <nav class="nav-tabs">
          <a href="#/sim" class="nav-tab">Simulation</a>
          <a href="#/ga" class="nav-tab active">Evolve</a>
        </nav>
        <div class="header-stats" id="ga-header-stats">
          <span class="stat stat-tick">Genetic Algorithm</span>
        </div>
      </header>

      <main class="ga-main">
        <div class="ga-panel ga-chart-panel">
          <h2 class="panel-title" id="ga-chart-title">Fitness over Generations</h2>
          <canvas id="ga-chart"></canvas>
          <canvas id="ga-preview" class="hidden"></canvas>
          <div class="ga-preview-stats hidden" id="ga-preview-stats">
            <span><span class="prey-dot-inline"></span> <span id="gp-prey">0</span></span>
            <span><span class="pred-dot-inline"></span> <span id="gp-pred">0</span></span>
            <span>Tick <span id="gp-tick">0</span></span>
          </div>
          <div class="ga-stats" id="ga-stats">
            <span>Gen <span class="ga-stat-value" id="gs-gen">0</span> / <span id="gs-max">100</span></span>
            <span>Best <span class="ga-stat-value" id="gs-best">0.000</span></span>
            <span>Avg <span class="ga-stat-value" id="gs-avg">0.000</span></span>
            <span class="ga-eval-status" id="gs-status"></span>
          </div>
          <div class="ga-progress"><div class="ga-progress-bar" id="ga-progress-bar"></div></div>
        </div>

        <div class="ga-panel ga-params-panel">
          <h2 class="panel-title">Best Individual</h2>
          <div class="ga-params-table" id="ga-params">
            ${paramRows}
          </div>
          <div class="ga-actions">
            <button id="ga-preview-btn" class="btn" disabled>Preview</button>
            <button id="ga-apply" class="btn btn-primary" disabled>Apply to Simulator</button>
          </div>
        </div>
      </main>

      <footer class="bottom-bar">
        <div class="bottom-row">
          <div class="bottom-section">
            <button id="ga-start" class="btn btn-primary">Start</button>
            <button id="ga-stop" class="btn" disabled>Stop</button>
            <button id="ga-reset" class="btn">Reset</button>
          </div>

          <div class="bottom-section">
            <label class="label" title="Number of parameter sets tested per generation. Higher = better exploration but slower.">Pop</label>
            <input type="range" id="ga-pop" min="10" max="60" step="5" value="${saved.pop}" class="slider" title="Population size" />
            <span id="ga-pop-val" class="slider-val">${saved.pop}</span>
            <div class="divider"></div>
            <label class="label" title="Number of evolutionary cycles. Each generation breeds a new population from the best of the previous.">Gens</label>
            <input type="range" id="ga-gens" min="20" max="200" step="10" value="${saved.gens}" class="slider" title="Generations" />
            <span id="ga-gens-val" class="slider-val">${saved.gens}</span>
            <div class="divider"></div>
            <label class="label" title="How long each simulation runs to measure sustainability. More ticks = more accurate but slower.">Ticks</label>
            <input type="range" id="ga-ticks" min="500" max="5000" step="250" value="${saved.ticks}" class="slider" title="Simulation ticks per evaluation" />
            <span id="ga-ticks-val" class="slider-val">${saved.ticks}</span>
          </div>
        </div>
      </footer>
    </div>
  `;

  // DOM refs
  const chartCanvas = document.getElementById('ga-chart') as HTMLCanvasElement;
  const previewCanvas = document.getElementById('ga-preview') as HTMLCanvasElement;
  const chartTitle = document.getElementById('ga-chart-title')!;
  const previewStats = document.getElementById('ga-preview-stats')!;
  const gaStats = document.getElementById('ga-stats')!;
  const chart = new FitnessChart(chartCanvas);

  const gsGen = document.getElementById('gs-gen')!;
  const gsMax = document.getElementById('gs-max')!;
  const gsBest = document.getElementById('gs-best')!;
  const gsAvg = document.getElementById('gs-avg')!;
  const gsStatus = document.getElementById('gs-status')!;
  const progressBar = document.getElementById('ga-progress-bar')!;
  const gpPrey = document.getElementById('gp-prey')!;
  const gpPred = document.getElementById('gp-pred')!;
  const gpTick = document.getElementById('gp-tick')!;

  const btnStart = document.getElementById('ga-start') as HTMLButtonElement;
  const btnStop = document.getElementById('ga-stop') as HTMLButtonElement;
  const btnReset = document.getElementById('ga-reset') as HTMLButtonElement;
  const btnApply = document.getElementById('ga-apply') as HTMLButtonElement;
  const btnPreview = document.getElementById('ga-preview-btn') as HTMLButtonElement;

  const popSlider = document.getElementById('ga-pop') as HTMLInputElement;
  const gensSlider = document.getElementById('ga-gens') as HTMLInputElement;
  const ticksSlider = document.getElementById('ga-ticks') as HTMLInputElement;
  const popVal = document.getElementById('ga-pop-val')!;
  const gensVal = document.getElementById('ga-gens-val')!;
  const ticksVal = document.getElementById('ga-ticks-val')!;

  // Set initial gsMax from saved gens value
  gsMax.textContent = String(saved.gens);

  // Slider sync + persist
  function persistSliders() {
    saveGASettings(parseInt(popSlider.value), parseInt(gensSlider.value), parseInt(ticksSlider.value));
  }
  popSlider.addEventListener('input', () => { popVal.textContent = popSlider.value; persistSliders(); });
  gensSlider.addEventListener('input', () => {
    gensVal.textContent = gensSlider.value;
    gsMax.textContent = gensSlider.value;
    persistSliders();
  });
  ticksSlider.addEventListener('input', () => { ticksVal.textContent = ticksSlider.value; persistSliders(); });

  function setRunning(running: boolean) {
    btnStart.disabled = running;
    btnStop.disabled = !running;
    popSlider.disabled = running;
    gensSlider.disabled = running;
    ticksSlider.disabled = running;
  }

  function updateParams(result: GenerationResult) {
    for (const key of EVOLVABLE_KEYS) {
      const el = document.getElementById(`gp-${key}`);
      if (el) el.textContent = formatValue(key, result.bestIndividual.genes[key]);
    }
  }

  function onEvalProgress(progress: EvalProgress) {
    const { generation, maxGenerations, evaluated, populationSize } = progress;
    gsStatus.textContent = `Evaluating ${evaluated}/${populationSize}`;

    // Smooth progress: generation progress + fraction within current generation
    const genFraction = (generation + evaluated / populationSize) / maxGenerations;
    progressBar.style.width = `${genFraction * 100}%`;
  }

  function onProgress(result: GenerationResult) {
    history.push(result);
    bestResult = result;

    gsGen.textContent = String(result.generation + 1);
    gsBest.textContent = result.bestFitness.toFixed(3);
    gsAvg.textContent = result.avgFitness.toFixed(3);
    gsStatus.textContent = '';

    updateParams(result);
    chart.render(history);
    btnApply.disabled = false;
    btnPreview.disabled = false;
  }

  function onComplete() {
    setRunning(false);
    gsStatus.textContent = 'Done';
  }

  function stopPreview() {
    if (previewRafId) { cancelAnimationFrame(previewRafId); previewRafId = 0; }
    previewSim = null;
    previewRenderer = null;
    previewing = false;

    chartCanvas.classList.remove('hidden');
    previewCanvas.classList.add('hidden');
    previewStats.classList.add('hidden');
    gaStats.classList.remove('hidden');
    chartTitle.textContent = 'Fitness over Generations';
    btnPreview.textContent = 'Preview';
  }

  function startPreview() {
    if (!bestResult) return;

    previewSim = new Simulation({
      ...bestResult.bestIndividual.genes,
      width: 80,
      height: 50,
      initialPrey: 50,
      initialPredators: 12,
      initialRoads: 1,
      preyAlarmRadius: 6,
    });
    previewRenderer = new Renderer(previewCanvas, previewSim);
    previewing = true;

    chartCanvas.classList.add('hidden');
    previewCanvas.classList.remove('hidden');
    previewStats.classList.remove('hidden');
    gaStats.classList.add('hidden');
    chartTitle.textContent = 'Live Preview';
    btnPreview.textContent = 'Back to Chart';

    function loop() {
      if (!previewing || !previewSim || !previewRenderer) return;
      for (let i = 0; i < 2; i++) previewSim.step();
      previewRenderer.render();

      let prey = 0, pred = 0;
      for (const c of previewSim.creatures) {
        if (c.type === 'prey') prey++; else pred++;
      }
      gpPrey.textContent = String(prey);
      gpPred.textContent = String(pred);
      gpTick.textContent = String(previewSim.tick);

      previewRafId = requestAnimationFrame(loop);
    }
    previewRafId = requestAnimationFrame(loop);
  }

  btnStart.addEventListener('click', () => {
    stopPreview();
    history = [];
    bestResult = null;

    const gaConfig: GAConfig = {
      ...DEFAULT_GA_CONFIG,
      populationSize: parseInt(popSlider.value),
      maxGenerations: parseInt(gensSlider.value),
      simTicks: parseInt(ticksSlider.value),
    };

    gsMax.textContent = String(gaConfig.maxGenerations);
    gsGen.textContent = '0';
    gsBest.textContent = '0.000';
    gsAvg.textContent = '0.000';
    progressBar.style.width = '0%';

    runner = new GARunner(gaConfig, onProgress, onComplete, onEvalProgress);
    setRunning(true);
    runner.start();
  });

  btnPreview.addEventListener('click', () => {
    if (previewing) stopPreview();
    else startPreview();
  });

  btnStop.addEventListener('click', () => {
    runner?.stop();
    setRunning(false);
  });

  btnReset.addEventListener('click', () => {
    runner?.stop();
    runner = null;
    history = [];
    bestResult = null;
    stopPreview();

    setRunning(false);
    gsGen.textContent = '0';
    gsBest.textContent = '0.000';
    gsAvg.textContent = '0.000';
    gsStatus.textContent = '';
    progressBar.style.width = '0%';
    btnApply.disabled = true;
    btnPreview.disabled = true;

    for (const key of EVOLVABLE_KEYS) {
      const el = document.getElementById(`gp-${key}`);
      if (el) el.textContent = '—';
    }

    chart.render([]);
  });

  btnApply.addEventListener('click', () => {
    if (!bestResult) return;

    // Merge best genes into stored config
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const existing = raw ? JSON.parse(raw) : {};
      const merged = { ...existing, ...bestResult.bestIndividual.genes };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bestResult.bestIndividual.genes));
    }

    window.location.hash = '#/sim';
  });

  // Initial chart render
  chart.render([]);

  return () => {
    runner?.stop();
    runner = null;
    stopPreview();
  };
}
