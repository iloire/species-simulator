import { CellType, CELL_SIZE } from './types';
import { Simulation } from './simulation';

const COLORS = {
  background: '#1a1a1a',
  empty: '#1e2428',
  grass: '#2d5a27',
  grassLight: '#3a7a32',
  road: '#4a4a50',
  roadLine: '#d4a940',
  prey: '#e8d44d',
  preyGlow: 'rgba(232, 212, 77, 0.3)',
  predator: '#d94040',
  predatorGlow: 'rgba(217, 64, 64, 0.3)',
  gridLine: 'rgba(255,255,255,0.02)',
};

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: Simulation;

  constructor(canvas: HTMLCanvasElement, sim: Simulation) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.sim = sim;
    this.resize();
  }

  resize() {
    const w = this.sim.config.width * CELL_SIZE;
    const h = this.sim.config.height * CELL_SIZE;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  render() {
    const { ctx, sim } = this;
    const { width, height } = sim.config;
    const s = CELL_SIZE;

    // Clear
    ctx.fillStyle = COLORS.empty;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid cells
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = sim.grid[y][x];

        if (cell === CellType.Grass) {
          // Slight variation for organic feel
          const shade = ((x * 7 + y * 13) % 3);
          ctx.fillStyle = shade === 0 ? COLORS.grass : COLORS.grassLight;
          ctx.fillRect(x * s, y * s, s, s);
        } else if (cell === CellType.Road) {
          ctx.fillStyle = COLORS.road;
          ctx.fillRect(x * s, y * s, s, s);

          // Center line
          ctx.fillStyle = COLORS.roadLine;
          if ((x + y) % 4 < 2) {
            ctx.fillRect(x * s + s * 0.4, y * s + s * 0.4, s * 0.2, s * 0.2);
          }
        }
      }
    }

    // Draw creatures
    for (const c of sim.creatures) {
      const cx = c.x * s + s / 2;
      const cy = c.y * s + s / 2;

      if (c.type === 'prey') {
        // Glow
        ctx.fillStyle = COLORS.preyGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = COLORS.prey;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Glow
        ctx.fillStyle = COLORS.predatorGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 1.0, 0, Math.PI * 2);
        ctx.fill();

        // Body — slightly larger
        ctx.fillStyle = COLORS.predator;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
