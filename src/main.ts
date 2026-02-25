import { Simulation } from './simulation';
import { Renderer } from './renderer';
import { PopulationChart } from './chart';
import { CELL_SIZE } from './types';
import './style.css';

// --- State ---
let sim = new Simulation();
let paused = false;
let speed = 1;
let tool: 'road' | 'erase' | 'prey' | 'predator' = 'road';
let isDrawing = false;

// --- DOM ---
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div class="layout">
    <header class="header">
      <h1 class="logo">Species<span class="logo-accent">Sim</span></h1>
      <div class="header-stats" id="stats"></div>
    </header>

    <main class="main">
      <div class="canvas-wrap">
        <canvas id="world"></canvas>
      </div>

      <aside class="sidebar">
        <section class="panel">
          <h2 class="panel-title">Controls</h2>
          <div class="controls-row">
            <button id="btn-play" class="btn btn-primary">Pause</button>
            <button id="btn-reset" class="btn">Reset</button>
          </div>
          <div class="control-group">
            <label class="label">Speed</label>
            <input type="range" id="speed" min="1" max="10" value="1" class="slider" />
            <span id="speed-val" class="slider-val">1x</span>
          </div>
        </section>

        <section class="panel">
          <h2 class="panel-title">Tools</h2>
          <div class="tool-grid">
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
        </section>

        <section class="panel">
          <h2 class="panel-title">Population</h2>
          <canvas id="chart" width="320" height="180"></canvas>
        </section>

        <section class="panel hint-panel">
          <h2 class="panel-title">How It Works</h2>
          <p class="info-text">
            <strong class="prey-color">Prey</strong> eat grass, flee from predators, and reproduce when well-fed.
            <strong class="pred-color">Predators</strong> hunt prey and starve without food.
            <strong class="road-color">Roads</strong> fragment habitat and kill creatures crossing them.
          </p>
          <p class="info-text muted">Click and drag on the world to use tools.</p>
        </section>
      </aside>
    </main>
  </div>
`;

const worldCanvas = document.getElementById('world') as HTMLCanvasElement;
const chartCanvas = document.getElementById('chart') as HTMLCanvasElement;
const statsEl = document.getElementById('stats')!;
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const speedSlider = document.getElementById('speed') as HTMLInputElement;
const speedVal = document.getElementById('speed-val')!;

let rendererInstance = new Renderer(worldCanvas, sim);
const chart = new PopulationChart(chartCanvas);

// --- Controls ---
btnPlay.addEventListener('click', () => {
  paused = !paused;
  btnPlay.textContent = paused ? 'Play' : 'Pause';
  btnPlay.classList.toggle('btn-paused', paused);
});

btnReset.addEventListener('click', () => {
  sim = new Simulation();
  rendererInstance = new Renderer(worldCanvas, sim);
  paused = false;
  btnPlay.textContent = 'Pause';
  btnPlay.classList.remove('btn-paused');
});

speedSlider.addEventListener('input', () => {
  speed = parseInt(speedSlider.value);
  speedVal.textContent = `${speed}x`;
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
    for (let i = 0; i < 3; i++) {
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
  if (!paused) {
    for (let i = 0; i < speed; i++) {
      sim.step();
    }
  }

  rendererInstance.render();
  chart.render(sim.history);
  updateStats();

  requestAnimationFrame(loop);
}

loop();
