import {
  CellType,
  DEFAULT_CONFIG,
} from './types';
import type {
  Creature,
  SimConfig,
  PopulationSnapshot,
} from './types';

export class Simulation {
  config: SimConfig;
  grid: CellType[][];
  creatures: Creature[];
  tick: number;
  history: PopulationSnapshot[];
  private nextId: number;
  private initialGrid: CellType[][] = [];
  private initialCreatures: Creature[] = [];

  constructor(config: Partial<SimConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tick = 0;
    this.nextId = 0;
    this.history = [];
    this.grid = [];
    this.creatures = [];
    this.init();
    this.saveSnapshot();
  }

  private saveSnapshot() {
    this.initialGrid = this.grid.map((row) => [...row]);
    this.initialCreatures = this.creatures.map((c) => ({ ...c }));
  }

  reset() {
    this.tick = 0;
    this.nextId = this.initialCreatures.length;
    this.history = [];
    this.grid = this.initialGrid.map((row) => [...row]);
    this.creatures = this.initialCreatures.map((c) => ({ ...c }));
  }

  private init() {
    const { width, height } = this.config;

    // Initialize grid with empty cells
    this.grid = Array.from({ length: height }, () =>
      Array.from({ length: width }, () =>
        Math.random() < 0.4 ? CellType.Grass : CellType.Empty
      )
    );

    // Generate random roads that cross the map
    this.generateRoads();

    // Spawn prey
    for (let i = 0; i < this.config.initialPrey; i++) {
      this.spawnCreature('prey');
    }

    // Spawn predators
    for (let i = 0; i < this.config.initialPredators; i++) {
      this.spawnCreature('predator');
    }
  }

  private generateRoads() {
    const { width, height, initialRoads } = this.config;

    for (let r = 0; r < initialRoads; r++) {
      // Pick a random orientation — mostly horizontal or mostly vertical
      const vertical = Math.random() < 0.5;

      // Start from a random edge point
      let x = vertical
        ? Math.floor(width * 0.2 + Math.random() * width * 0.6)
        : 0;
      let y = vertical
        ? 0
        : Math.floor(height * 0.2 + Math.random() * height * 0.6);

      // Walk across the map with gentle wandering
      const length = vertical ? height : width;
      for (let step = 0; step < length; step++) {
        // Place road with 3-cell width for visibility
        for (let t = -1; t <= 1; t++) {
          const px = vertical ? x + t : x;
          const py = vertical ? y : y + t;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            this.grid[py][px] = CellType.Road;
          }
        }

        // Advance in primary direction
        if (vertical) {
          y++;
        } else {
          x++;
        }

        // Wander in secondary direction
        if (Math.random() < 0.3) {
          if (vertical) {
            x += Math.random() < 0.5 ? 1 : -1;
            x = Math.max(1, Math.min(width - 2, x));
          } else {
            y += Math.random() < 0.5 ? 1 : -1;
            y = Math.max(1, Math.min(height - 2, y));
          }
        }
      }
    }
  }

  private spawnCreature(
    type: 'prey' | 'predator',
    x?: number,
    y?: number
  ): Creature | null {
    const cfg = this.config;
    const cx = x ?? Math.floor(Math.random() * cfg.width);
    const cy = y ?? Math.floor(Math.random() * cfg.height);

    if (this.grid[cy]?.[cx] === CellType.Road) return null;

    const isPrey = type === 'prey';
    const creature: Creature = {
      id: this.nextId++,
      type,
      x: cx,
      y: cy,
      energy: isPrey ? 25 : 50,
      age: 0,
      maxAge: isPrey ? cfg.preyMaxAge : cfg.predatorMaxAge,
      speed: isPrey ? cfg.preySpeed : cfg.predatorSpeed,
      vision: isPrey ? cfg.preyVision : cfg.predatorVision,
      fleeTimer: 0,
      huntCooldownTimer: 0,
    };

    this.creatures.push(creature);
    return creature;
  }

  placeRoad(x: number, y: number) {
    if (y >= 0 && y < this.config.height && x >= 0 && x < this.config.width) {
      this.grid[y][x] = CellType.Road;
    }
  }

  removeRoad(x: number, y: number) {
    if (
      y >= 0 &&
      y < this.config.height &&
      x >= 0 &&
      x < this.config.width &&
      this.grid[y][x] === CellType.Road
    ) {
      this.grid[y][x] = CellType.Empty;
    }
  }

  step() {
    this.tick++;
    this.growGrass();
    this.updateCreatures();
    this.recordHistory();
  }

  private growGrass() {
    const { width, height, grassGrowthRate } = this.config;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.grid[y][x] === CellType.Empty && Math.random() < grassGrowthRate) {
          // Higher chance to grow near existing grass
          if (this.hasAdjacentGrass(x, y)) {
            this.grid[y][x] = CellType.Grass;
          } else if (Math.random() < 0.1) {
            this.grid[y][x] = CellType.Grass;
          }
        }
      }
    }
  }

  private hasAdjacentGrass(x: number, y: number): boolean {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (
        ny >= 0 &&
        ny < this.config.height &&
        nx >= 0 &&
        nx < this.config.width &&
        this.grid[ny][nx] === CellType.Grass
      ) {
        return true;
      }
    }
    return false;
  }

  private updateCreatures() {
    // Shuffle for fairness
    const shuffled = [...this.creatures].sort(() => Math.random() - 0.5);
    const toRemove = new Set<number>();
    const toAdd: Array<{ type: 'prey' | 'predator'; x: number; y: number }> = [];

    for (const c of shuffled) {
      if (toRemove.has(c.id)) continue;

      c.age++;
      c.energy -= c.type === 'predator'
        ? this.config.predatorMovementEnergyCost
        : this.config.movementEnergyCost;

      // Death by age or starvation
      if (c.energy <= 0 || c.age >= c.maxAge) {
        toRemove.add(c.id);
        continue;
      }

      if (c.type === 'prey') {
        this.updatePrey(c, toRemove);
      } else {
        this.updatePredator(c, shuffled, toRemove);
      }

      // Road kill check
      if (this.grid[c.y]?.[c.x] === CellType.Road) {
        if (Math.random() < this.config.roadKillChance) {
          toRemove.add(c.id);
          continue;
        }
      }

      // Reproduction
      const threshold =
        c.type === 'prey'
          ? this.config.preyReproductionThreshold
          : this.config.predatorReproductionThreshold;

      if (c.energy > threshold) {
        c.energy *= 0.5;
        toAdd.push({ type: c.type, x: c.x, y: c.y });
      }
    }

    // Remove dead creatures
    this.creatures = this.creatures.filter((c) => !toRemove.has(c.id));

    // Add offspring
    for (const baby of toAdd) {
      this.spawnCreature(baby.type, baby.x, baby.y);
    }
  }

  private updatePrey(c: Creature, _toRemove: Set<number>) {
    // Look for nearby predators
    const nearestPredator = this.findNearest(c, 'predator');

    if (nearestPredator && this.distance(c, nearestPredator) < c.vision) {
      // Flee away from predator
      this.moveAway(c, nearestPredator);
      c.fleeTimer = 5;
    } else if (c.fleeTimer > 0) {
      // Continue fleeing in random direction
      this.moveRandom(c);
      c.fleeTimer--;
    } else {
      // Look for grass
      if (this.grid[c.y][c.x] === CellType.Grass) {
        this.grid[c.y][c.x] = CellType.Empty;
        c.energy += this.config.preyEnergyFromGrass;
      } else {
        // Move toward nearest grass or random
        this.moveTowardGrass(c);
      }
    }
  }

  private updatePredator(
    c: Creature,
    _allCreatures: Creature[],
    toRemove: Set<number>
  ) {
    // Cooldown after eating
    if (c.huntCooldownTimer > 0) {
      c.huntCooldownTimer--;
      this.moveRandom(c);
      return;
    }

    const nearestPrey = this.findNearest(c, 'prey');

    if (nearestPrey && !toRemove.has(nearestPrey.id)) {
      const dist = this.distance(c, nearestPrey);

      // Grass cover: reduce effective vision when prey is on grass
      const effectiveVision = this.grid[nearestPrey.y]?.[nearestPrey.x] === CellType.Grass
        ? c.vision * (1 - this.config.grassCoverVisionReduction)
        : c.vision;

      if (dist < 1.5) {
        // Attempt catch — not guaranteed
        if (Math.random() < this.config.catchChance) {
          c.energy += this.config.predatorEnergyFromPrey;
          toRemove.add(nearestPrey.id);
          c.huntCooldownTimer = this.config.huntCooldown;
          this.triggerAlarm(nearestPrey);
        } else {
          // Failed catch — prey escapes, predator loses a tick
          this.moveRandom(c);
        }
      } else if (dist < effectiveVision) {
        // Chase
        this.moveToward(c, nearestPrey);
      } else {
        this.moveRandom(c);
      }
    } else {
      this.moveRandom(c);
    }
  }

  private triggerAlarm(killed: Creature) {
    const radius = this.config.preyAlarmRadius;
    for (const c of this.creatures) {
      if (c.type !== 'prey' || c.id === killed.id) continue;
      if (this.distance(c, killed) <= radius) {
        c.fleeTimer = Math.max(c.fleeTimer, 8);
      }
    }
  }

  private findNearest(
    from: Creature,
    targetType: 'prey' | 'predator'
  ): Creature | null {
    let best: Creature | null = null;
    let bestDist = Infinity;

    for (const c of this.creatures) {
      if (c.type !== targetType || c.id === from.id) continue;
      const d = this.distance(from, c);
      if (d < bestDist && d < from.vision * 1.5) {
        bestDist = d;
        best = c;
      }
    }

    return best;
  }

  private distance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  private moveToward(c: Creature, target: { x: number; y: number }) {
    const dx = Math.sign(target.x - c.x);
    const dy = Math.sign(target.y - c.y);
    const steps = this.getSteps(c);
    for (let i = 0; i < steps; i++) {
      this.tryMove(c, dx, dy);
    }
  }

  private moveAway(c: Creature, threat: { x: number; y: number }) {
    const dx = Math.sign(c.x - threat.x);
    const dy = Math.sign(c.y - threat.y);
    const steps = this.getSteps(c);
    for (let i = 0; i < steps; i++) {
      this.tryMove(c, dx, dy);
    }
  }

  // Speed 1.0 = always 1 step. Speed 1.3 = 1 step + 30% chance of a 2nd step.
  private getSteps(c: Creature): number {
    const base = Math.floor(c.speed);
    const frac = c.speed - base;
    return base + (Math.random() < frac ? 1 : 0);
  }

  private moveTowardGrass(c: Creature) {
    // Scan for nearby grass
    let bestX = -1,
      bestY = -1,
      bestDist = Infinity;

    const range = c.vision;
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (
          ny >= 0 &&
          ny < this.config.height &&
          nx >= 0 &&
          nx < this.config.width &&
          this.grid[ny][nx] === CellType.Grass
        ) {
          const d = Math.abs(dx) + Math.abs(dy);
          if (d < bestDist) {
            bestDist = d;
            bestX = nx;
            bestY = ny;
          }
        }
      }
    }

    if (bestX >= 0) {
      this.moveToward(c, { x: bestX, y: bestY });
    } else {
      this.moveRandom(c);
    }
  }

  private moveRandom(c: Creature) {
    const steps = this.getSteps(c);
    for (let i = 0; i < steps; i++) {
      const dx = Math.floor(Math.random() * 3) - 1;
      const dy = Math.floor(Math.random() * 3) - 1;
      this.tryMove(c, dx, dy);
    }
  }

  private tryMove(c: Creature, dx: number, dy: number) {
    const nx = Math.max(0, Math.min(this.config.width - 1, c.x + dx));
    const ny = Math.max(0, Math.min(this.config.height - 1, c.y + dy));
    c.x = nx;
    c.y = ny;
  }

  private recordHistory() {
    if (this.tick % 5 !== 0) return;

    let grassCount = 0;
    for (let y = 0; y < this.config.height; y++) {
      for (let x = 0; x < this.config.width; x++) {
        if (this.grid[y][x] === CellType.Grass) grassCount++;
      }
    }

    this.history.push({
      tick: this.tick,
      prey: this.creatures.filter((c) => c.type === 'prey').length,
      predators: this.creatures.filter((c) => c.type === 'predator').length,
      grass: grassCount,
    });

    // Keep last 600 snapshots (~3000 ticks)
    if (this.history.length > 600) {
      this.history.shift();
    }
  }

  getPopulationCounts() {
    let prey = 0,
      predators = 0;
    for (const c of this.creatures) {
      if (c.type === 'prey') prey++;
      else predators++;
    }
    return { prey, predators };
  }
}
