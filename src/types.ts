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
  huntCooldownTimer: number;
  targetId: number;
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
  catchChance: number;
  huntCooldown: number;
  grassCoverVisionReduction: number;
  predatorMovementEnergyCost: number;
  preyAlarmRadius: number;
  initialRoads: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  width: 160, // Grid width in cells
  height: 100, // Grid height in cells
  grassGrowthRate: 0.015, // Chance per tick an empty cell grows grass (boosted near existing grass)
  initialPrey: 120, // Prey spawned at simulation start
  initialPredators: 25, // Predators spawned at simulation start
  preyEnergyFromGrass: 10, // Energy prey gains from eating one grass tile
  predatorEnergyFromPrey: 40, // Energy predator gains from catching one prey
  preyReproductionThreshold: 100, // Energy above which prey reproduce (halved after)
  predatorReproductionThreshold: 120, // Energy above which predators reproduce (halved after)
  preyMaxAge: 300, // Ticks before prey dies of old age
  predatorMaxAge: 500, // Ticks before predator dies of old age
  preySpeed: 1, // Cells per tick; fractional part = chance of an extra step
  predatorSpeed: 1.3, // Cells per tick; fractional part = chance of an extra step
  preyVision: 5, // Detection range in cells (predators + grass)
  predatorVision: 7, // Detection range in cells (prey)
  roadKillChance: 0.3, // Chance per tick a creature on a road tile dies
  movementEnergyCost: 0.5, // Energy prey spends per tick moving
  catchChance: 0.7, // Probability an adjacent predator catches its prey
  huntCooldown: 15, // Ticks a predator idles after a successful kill
  grassCoverVisionReduction: 0.5, // Fraction of predator vision lost when prey hides on grass
  predatorMovementEnergyCost: 1.2, // Energy predator spends per tick moving
  preyAlarmRadius: 6, // Radius in cells where nearby prey flee after a kill
  initialRoads: 2, // Number of roads generated across the map at start
};

export interface PopulationSnapshot {
  tick: number;
  prey: number;
  predators: number;
  grass: number;
}
