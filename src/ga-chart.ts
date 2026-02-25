import type { GenerationResult } from './ga-types';

const COLORS = {
  bg: '#12161a',
  border: '#2a2e34',
  best: '#e8d44d',
  avg: '#6a7488',
  gridLine: '#222830',
  text: '#8a9099',
};

export class FitnessChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  render(history: GenerationResult[]) {
    const { ctx, canvas } = this;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const pad = { top: 24, right: 16, bottom: 28, left: 50 };

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    if (history.length < 2) {
      ctx.fillStyle = COLORS.text;
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for data...', w / 2, h / 2);
      return;
    }

    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Y-axis: fitness 0 to 1
    const maxY = 1.0;
    const gridSteps = 5;
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;

    for (let i = 0; i <= gridSteps; i++) {
      const y = pad.top + (plotH / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();

      const val = (maxY * (1 - i / gridSteps)).toFixed(1);
      ctx.fillStyle = COLORS.text;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val, pad.left - 6, y + 4);
    }

    // X-axis labels
    const xLabelCount = Math.min(history.length, 6);
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < xLabelCount; i++) {
      const idx = Math.floor((i / (xLabelCount - 1)) * (history.length - 1));
      const x = pad.left + (idx / (history.length - 1)) * plotW;
      ctx.fillText(String(history[idx].generation), x, pad.top + plotH + 18);
    }

    // Draw lines
    const drawLine = (getValue: (r: GenerationResult) => number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      for (let i = 0; i < history.length; i++) {
        const x = pad.left + (i / (history.length - 1)) * plotW;
        const y = pad.top + plotH - (getValue(history[i]) / maxY) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    drawLine((r) => r.bestFitness, COLORS.best);
    drawLine((r) => r.avgFitness, COLORS.avg);

    // Legend
    const legendY = pad.top + 2;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    ctx.fillStyle = COLORS.best;
    ctx.fillRect(pad.left + 4, legendY - 6, 10, 3);
    ctx.fillText('Best', pad.left + 18, legendY);

    ctx.fillStyle = COLORS.avg;
    ctx.fillRect(pad.left + 64, legendY - 6, 10, 3);
    ctx.fillText('Average', pad.left + 78, legendY);
  }
}
