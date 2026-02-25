import type { PopulationSnapshot } from './types';

const CHART_COLORS = {
  bg: '#12161a',
  border: '#2a2e34',
  prey: '#e8d44d',
  predator: '#d94040',
  grass: '#3a7a32',
  gridLine: '#222830',
  text: '#8a9099',
};

export class PopulationChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  render(history: PopulationSnapshot[]) {
    const { ctx, canvas } = this;
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    const pad = { top: 20, right: 16, bottom: 28, left: 50 };

    ctx.fillStyle = CHART_COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (history.length < 2) {
      ctx.fillStyle = CHART_COLORS.text;
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Collecting data...', w / 2, h / 2);
      return;
    }

    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Find max values for scaling
    let maxCreatures = 0;
    for (const snap of history) {
      maxCreatures = Math.max(maxCreatures, snap.prey, snap.predators);
    }
    maxCreatures = Math.max(maxCreatures, 10) * 1.15;

    // Grid lines
    ctx.strokeStyle = CHART_COLORS.gridLine;
    ctx.lineWidth = 1;
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = pad.top + (plotH / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();

      // Label
      const val = Math.round(maxCreatures * (1 - i / gridSteps));
      ctx.fillStyle = CHART_COLORS.text;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(val), pad.left - 6, y + 4);
    }

    // Draw lines
    const drawLine = (
      data: PopulationSnapshot[],
      getValue: (s: PopulationSnapshot) => number,
      color: string,
      maxVal: number
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      for (let i = 0; i < data.length; i++) {
        const x = pad.left + (i / (data.length - 1)) * plotW;
        const y = pad.top + plotH - (getValue(data[i]) / maxVal) * plotH;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    drawLine(history, (s) => s.prey, CHART_COLORS.prey, maxCreatures);
    drawLine(history, (s) => s.predators, CHART_COLORS.predator, maxCreatures);

    // Legend
    const legendY = pad.top + 2;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    ctx.fillStyle = CHART_COLORS.prey;
    ctx.fillRect(pad.left + 4, legendY - 6, 10, 3);
    ctx.fillText('Prey', pad.left + 18, legendY);

    ctx.fillStyle = CHART_COLORS.predator;
    ctx.fillRect(pad.left + 70, legendY - 6, 10, 3);
    ctx.fillText('Predators', pad.left + 84, legendY);
  }
}
