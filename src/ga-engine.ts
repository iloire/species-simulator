import { Simulation } from './simulation';
import { SeededRng, randomSeed } from './rng';
import type { Individual, GAConfig, GenerationResult, EvolvableKey } from './ga-types';
import { GENE_RANGES, EVOLVABLE_KEYS } from './ga-types';

function snap(value: number, range: { min: number; max: number; step: number }): number {
  const clamped = Math.max(range.min, Math.min(range.max, value));
  return Math.round(clamped / range.step) * range.step;
}

function randomIndividual(rng: SeededRng): Individual {
  const genes = {} as Record<EvolvableKey, number>;
  for (const key of EVOLVABLE_KEYS) {
    const r = GENE_RANGES[key];
    genes[key] = snap(r.min + rng.next() * (r.max - r.min), r);
  }
  return { genes, fitness: 0 };
}

// Headless grid size — smaller = much faster (growGrass is O(w*h) per tick)
const GA_WIDTH = 50;
const GA_HEIGHT = 32;

// Max creatures before we consider the sim "exploded" (unsustainable, and slow)
const CREATURE_CAP = 400;

// Only count populations every N ticks (avoids iterating creatures array each tick)
const SAMPLE_INTERVAL = 20;

function countPopulations(creatures: Array<{ type: string }>): { prey: number; pred: number } {
  let prey = 0;
  let pred = 0;
  for (let i = 0; i < creatures.length; i++) {
    if (creatures[i].type === 'prey') prey++;
    else pred++;
  }
  return { prey, pred };
}

function evaluateFitness(individual: Individual, simTicks: number): number {
  const sim = new Simulation({
    ...individual.genes,
    width: GA_WIDTH,
    height: GA_HEIGHT,
    initialPrey: 50,
    initialPredators: 12,
    initialRoads: 1,
    preyAlarmRadius: 6,
  }, undefined, true); // headless = true: skip history recording

  let bothAlivesamples = 0;
  let totalSamples = 0;
  const samples: Array<{ prey: number; pred: number }> = [];
  let preySum = 0;
  let predSum = 0;
  let lastPrey = 0;
  let lastPred = 0;
  let extinct = false;

  for (let t = 0; t < simTicks; t++) {
    sim.step();

    // Only count populations at sample intervals
    if (t % SAMPLE_INTERVAL === 0) {
      const pop = countPopulations(sim.creatures);
      lastPrey = pop.prey;
      lastPred = pop.pred;
      totalSamples++;

      if (pop.prey > 0 && pop.pred > 0) {
        bothAlivesamples++;
      }

      samples.push(pop);
      preySum += pop.prey;
      predSum += pop.pred;

      // Early termination: both extinct
      if (pop.prey === 0 && pop.pred === 0) { extinct = true; break; }

      // Early termination: population explosion
      if (pop.prey + pop.pred > CREATURE_CAP) break;
    }
  }

  if (totalSamples === 0) return 0;

  // Coexistence: fraction of sample points where both species alive
  const coexistence = bothAlivesamples / (simTicks / SAMPLE_INTERVAL);

  // Population stability (low coefficient of variation = good)
  let stability = 0;
  if (samples.length > 1) {
    const preyMean = preySum / samples.length;
    const predMean = predSum / samples.length;

    if (preyMean > 0 && predMean > 0) {
      const preyCV = Math.sqrt(
        samples.reduce((s, v) => s + (v.prey - preyMean) ** 2, 0) / samples.length
      ) / preyMean;
      const predCV = Math.sqrt(
        samples.reduce((s, v) => s + (v.pred - predMean) ** 2, 0) / samples.length
      ) / predMean;
      stability = (1 - Math.min(preyCV, 2) / 2) * 0.5
                + (1 - Math.min(predCV, 2) / 2) * 0.5;
    }
  }

  // Balance between species
  let balance = 0;
  if (lastPrey > 0 && lastPred > 0) {
    balance = Math.min(lastPrey, lastPred) / Math.max(lastPrey, lastPred);
  }

  // Penalize early extinction harder
  const extinctPenalty = extinct ? 0.5 : 1;

  return (coexistence * 0.6 + stability * 0.25 + balance * 0.15) * extinctPenalty;
}

function tournamentSelect(population: Individual[], size: number, rng: SeededRng): Individual {
  let best = population[rng.int(0, population.length)];
  for (let i = 1; i < size; i++) {
    const candidate = population[rng.int(0, population.length)];
    if (candidate.fitness > best.fitness) best = candidate;
  }
  return best;
}

function crossover(a: Individual, b: Individual, rng: SeededRng): Individual {
  const genes = {} as Record<EvolvableKey, number>;
  for (const key of EVOLVABLE_KEYS) {
    genes[key] = rng.next() < 0.5 ? a.genes[key] : b.genes[key];
  }
  return { genes, fitness: 0 };
}

function gaussianNoise(rng: SeededRng): number {
  // Box-Muller transform
  const u1 = Math.max(1e-10, rng.next());
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function mutate(individual: Individual, rate: number, strength: number, rng: SeededRng): Individual {
  const genes = { ...individual.genes };
  for (const key of EVOLVABLE_KEYS) {
    if (rng.next() < rate) {
      const range = GENE_RANGES[key];
      const delta = gaussianNoise(rng) * strength * (range.max - range.min);
      genes[key] = snap(genes[key] + delta, range);
    }
  }
  return { genes, fitness: individual.fitness };
}

export interface EvalProgress {
  generation: number;
  maxGenerations: number;
  evaluated: number;
  populationSize: number;
}

export class GARunner {
  private config: GAConfig;
  private population: Individual[];
  private generation: number;
  private rng: SeededRng;
  private running: boolean;
  private history: GenerationResult[];
  private onProgress: (result: GenerationResult) => void;
  private onEvalProgress: (progress: EvalProgress) => void;
  private onComplete: (history: GenerationResult[]) => void;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    config: GAConfig,
    onProgress: (result: GenerationResult) => void,
    onComplete: (history: GenerationResult[]) => void,
    onEvalProgress: (progress: EvalProgress) => void,
    seed?: number,
  ) {
    this.config = config;
    this.onProgress = onProgress;
    this.onEvalProgress = onEvalProgress;
    this.onComplete = onComplete;
    this.rng = new SeededRng(seed ?? randomSeed());
    this.generation = 0;
    this.running = false;
    this.history = [];
    this.population = Array.from({ length: config.populationSize }, () =>
      randomIndividual(this.rng)
    );
  }

  start() {
    this.running = true;
    this.stepGeneration();
  }

  stop() {
    this.running = false;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private stepGeneration() {
    if (!this.running || this.generation >= this.config.maxGenerations) {
      this.running = false;
      this.onComplete(this.history);
      return;
    }
    this.evaluatePopulationAsync(0);
  }

  private evaluatePopulationAsync(index: number) {
    if (!this.running) return;

    if (index >= this.population.length) {
      this.advanceGeneration();
      return;
    }

    // Batch: evaluate up to BATCH_SIZE individuals per yield to reduce overhead
    const BATCH_SIZE = 5;
    const end = Math.min(index + BATCH_SIZE, this.population.length);
    for (let i = index; i < end; i++) {
      this.population[i].fitness = evaluateFitness(
        this.population[i],
        this.config.simTicks
      );
    }

    this.onEvalProgress({
      generation: this.generation,
      maxGenerations: this.config.maxGenerations,
      evaluated: end,
      populationSize: this.population.length,
    });

    // Yield to browser between batches
    this.timeoutId = setTimeout(() => this.evaluatePopulationAsync(end), 0);
  }

  private advanceGeneration() {
    this.population.sort((a, b) => b.fitness - a.fitness);

    const result: GenerationResult = {
      generation: this.generation,
      bestFitness: this.population[0].fitness,
      avgFitness: this.population.reduce((s, i) => s + i.fitness, 0) / this.population.length,
      bestIndividual: {
        genes: { ...this.population[0].genes },
        fitness: this.population[0].fitness,
      },
    };

    this.history.push(result);
    this.onProgress(result);

    this.population = this.breedNextGeneration();
    this.generation++;

    this.timeoutId = setTimeout(() => this.stepGeneration(), 0);
  }

  private breedNextGeneration(): Individual[] {
    const { populationSize, eliteCount, crossoverRate, mutationRate, mutationStrength, tournamentSize } = this.config;
    const next: Individual[] = [];

    // Elites pass through unchanged
    for (let i = 0; i < eliteCount && i < this.population.length; i++) {
      next.push({ genes: { ...this.population[i].genes }, fitness: 0 });
    }

    // Fill rest with offspring
    while (next.length < populationSize) {
      const parentA = tournamentSelect(this.population, tournamentSize, this.rng);
      const parentB = tournamentSelect(this.population, tournamentSize, this.rng);

      let child: Individual;
      if (this.rng.next() < crossoverRate) {
        child = crossover(parentA, parentB, this.rng);
      } else {
        child = { genes: { ...parentA.genes }, fitness: 0 };
      }

      child = mutate(child, mutationRate, mutationStrength, this.rng);
      next.push(child);
    }

    return next;
  }
}
