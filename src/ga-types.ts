import type { SimConfig } from './types';

// Core prey/predator traits that drive ecosystem balance
export type EvolvableKey =
  | 'preySpeed'
  | 'predatorSpeed'
  | 'preyVision'
  | 'predatorVision'
  | 'preyReproductionThreshold'
  | 'predatorReproductionThreshold'
  | 'preyMaxAge'
  | 'predatorMaxAge'
  | 'catchChance';

// Type guard: ensure every EvolvableKey is a valid SimConfig key
type _Check = EvolvableKey extends keyof SimConfig ? true : never;
const _check: _Check = true;
void _check;

export interface GeneRange {
  min: number;
  max: number;
  step: number;
}

export interface Individual {
  genes: Record<EvolvableKey, number>;
  fitness: number;
}

export interface GAConfig {
  populationSize: number;
  maxGenerations: number;
  eliteCount: number;
  crossoverRate: number;
  mutationRate: number;
  mutationStrength: number;
  simTicks: number;
  tournamentSize: number;
}

export interface GenerationResult {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  bestIndividual: Individual;
}

export const DEFAULT_GA_CONFIG: GAConfig = {
  populationSize: 30,
  maxGenerations: 100,
  eliteCount: 2,
  crossoverRate: 0.7,
  mutationRate: 0.15,
  mutationStrength: 0.2,
  simTicks: 1000,
  tournamentSize: 3,
};

// Tightened ranges — avoid degenerate configs on the small 50x32 GA grid
export const GENE_RANGES: Record<EvolvableKey, GeneRange> = {
  preySpeed:                    { min: 0.5,  max: 2,    step: 0.1 },
  predatorSpeed:                { min: 0.8,  max: 2.5,  step: 0.1 },
  preyVision:                   { min: 3,    max: 10,   step: 1 },
  predatorVision:               { min: 3,    max: 12,   step: 1 },
  preyReproductionThreshold:    { min: 40,   max: 120,  step: 5 },
  predatorReproductionThreshold:{ min: 50,   max: 150,  step: 5 },
  preyMaxAge:                   { min: 150,  max: 600,  step: 50 },
  predatorMaxAge:               { min: 200,  max: 800,  step: 50 },
  catchChance:                  { min: 0.3,  max: 0.95, step: 0.05 },
};

export const EVOLVABLE_KEYS = Object.keys(GENE_RANGES) as EvolvableKey[];
