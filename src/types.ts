export const CELL_SIZE = 8;

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
  huntCooldownTimer: number;
  targetId: number;
}

export interface SimConfig {
  // World
  width: number;
  height: number;
  grassGrowthRate: number;
  initialRoads: number;
  roadKillChance: number;
  // Spawn
  initialPrey: number;
  initialPredators: number;
  // Prey
  preySpeed: number;
  preyVision: number;
  preyMaxAge: number;
  preyEnergyFromGrass: number;
  preyReproductionThreshold: number;
  movementEnergyCost: number;
  preyAlarmRadius: number;
  // Predator
  predatorSpeed: number;
  predatorVision: number;
  predatorMaxAge: number;
  predatorEnergyFromPrey: number;
  predatorReproductionThreshold: number;
  predatorMovementEnergyCost: number;
  catchChance: number;
  huntCooldown: number;
  grassCoverVisionReduction: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  // ── World ──────────────────────────────────────────────
  width: 160, // Grid width in cells
  height: 100, // Grid height in cells
  grassGrowthRate: 0.015, // Chance per tick an empty cell grows grass (boosted near existing grass)
  initialRoads: 2, // Number of roads generated across the map at start
  roadKillChance: 0.3, // Chance per tick a creature on a road tile dies

  // ── Spawn ──────────────────────────────────────────────
  initialPrey: 120, // Prey spawned at simulation start
  initialPredators: 25, // Predators spawned at simulation start

  // ── Prey ───────────────────────────────────────────────
  preySpeed: 1.1, // Cells per tick; fractional part = chance of an extra step
  preyVision: 6, // Detection range in cells (predators + grass)
  preyMaxAge: 550, // Ticks before prey dies of old age
  preyEnergyFromGrass: 10, // Energy gained from eating one grass tile
  preyReproductionThreshold: 80, // Energy above which prey reproduce (halved after)
  movementEnergyCost: 0.5, // Energy spent per tick moving
  preyAlarmRadius: 6, // Radius where nearby prey flee after a kill

  // ── Predator ───────────────────────────────────────────
  predatorSpeed: 1.6, // Cells per tick; fractional part = chance of an extra step
  predatorVision: 8, // Detection range in cells (prey)
  predatorMaxAge: 800, // Ticks before predator dies of old age
  predatorEnergyFromPrey: 40, // Energy gained from catching one prey
  predatorReproductionThreshold: 130, // Energy above which predators reproduce (halved after)
  predatorMovementEnergyCost: 1.2, // Energy spent per tick moving
  catchChance: 0.8, // Probability an adjacent predator catches its prey
  huntCooldown: 10, // Ticks idled after a successful kill
  grassCoverVisionReduction: 0.5, // Fraction of vision lost when prey hides on grass
};

export interface PopulationSnapshot {
  tick: number;
  prey: number;
  predators: number;
  grass: number;
}
