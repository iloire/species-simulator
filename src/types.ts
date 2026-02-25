export const CELL_SIZE = 6;

export const CellType = {
  Empty: 0,
  Grass: 1,
  Road: 2,
} as const;

export type CellType = (typeof CellType)[keyof typeof CellType];

export interface Creature {
  id: number;
  type: 'prey' | 'predator';
  x: number;
  y: number;
  energy: number;
  age: number;
  maxAge: number;
  speed: number;
  vision: number;
  fleeTimer: number;
}

export interface SimConfig {
  width: number;
  height: number;
  grassGrowthRate: number;
  initialPrey: number;
  initialPredators: number;
  preyEnergyFromGrass: number;
  predatorEnergyFromPrey: number;
  preyReproductionThreshold: number;
  predatorReproductionThreshold: number;
  preyMaxAge: number;
  predatorMaxAge: number;
  preySpeed: number;
  predatorSpeed: number;
  preyVision: number;
  predatorVision: number;
  roadKillChance: number;
  movementEnergyCost: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  width: 160,
  height: 100,
  grassGrowthRate: 0.015,
  initialPrey: 120,
  initialPredators: 25,
  preyEnergyFromGrass: 12,
  predatorEnergyFromPrey: 40,
  preyReproductionThreshold: 100,
  predatorReproductionThreshold: 140,
  preyMaxAge: 300,
  predatorMaxAge: 500,
  preySpeed: 1,
  predatorSpeed: 1.1,
  preyVision: 5,
  predatorVision: 7,
  roadKillChance: 0.3,
  movementEnergyCost: 0.5,
};

export interface PopulationSnapshot {
  tick: number;
  prey: number;
  predators: number;
  grass: number;
}
