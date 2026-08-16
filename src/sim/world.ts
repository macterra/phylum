import type RAPIER from "@dimforge/rapier2d-compat";
import { createNoise2D } from "simplex-noise";
import { DEFAULTS, MAX_FOOD, PLANT_SIZE, WORLD_H, WORLD_W, type FollowMode } from "../config";
import { Creature, type Food } from "./creature";
import { replaceOne } from "./evolve";
import { randomGenome, type Genome } from "./genome";
import { Rng } from "./rng";

export interface SimParams {
  population: number;
  foodCount: number;
  mutationRate: number;
  bloomStrength: number;
  bloomThreshold: number;
  trailFade: number;
  follow: FollowMode;
  paused: boolean;
}

type Rapier = typeof import("@dimforge/rapier2d-compat").default;

export class Tank {
  readonly R: Rapier;
  readonly physics: RAPIER.World;
  readonly params: SimParams;
  readonly creatures: Creature[] = [];
  readonly foods: Food[] = [];
  readonly rng: Rng;
  generation = 1;
  births = 0;
  selectedId: string | null = null;
  bestScore = 0;
  private readonly noise: (x: number, y: number) => number;

  constructor(R: Rapier, seed?: number) {
    this.R = R;
    this.rng = new Rng(seed);
    this.noise = createNoise2D(() => this.rng.next());
    this.physics = new R.World({ x: 0, y: 0 });
    this.physics.timestep = 1 / 60;
    this.params = { ...DEFAULTS };
    this.buildWalls();
    this.reseed();
  }

  reseed(): void {
    this.clearCreatures();
    this.generation = 1;
    this.births = 0;
    this.bestScore = 0;
    this.selectedId = null;
    this.foods.length = 0;
    for (let i = 0; i < this.params.population; i++) {
      this.spawn(randomGenome(this.rng, this.generation));
    }
    this.refillFood(true);
  }

  spawn(genome: Genome, x?: number, y?: number): Creature {
    const px = x ?? this.rng.range(-WORLD_W * 0.38, WORLD_W * 0.38);
    const py = y ?? this.rng.range(-WORLD_H * 0.38, WORLD_H * 0.38);
    const c = new Creature(
      this.R,
      this.physics,
      genome,
      clamp(px, -WORLD_W * 0.42, WORLD_W * 0.42),
      clamp(py, -WORLD_H * 0.42, WORLD_H * 0.42),
    );
    this.creatures.push(c);
    return c;
  }

  noteBirth(): void {
    this.births += 1;
    if (this.births >= this.params.population) {
      this.births = 0;
      this.generation += 1;
    }
  }

  step(dt: number): void {
    const clamped = Math.min(dt, 0.05);
    for (const c of this.creatures) {
      if (c.alive) c.step(this.foods, clamped);
    }

    for (const c of this.creatures) {
      if (!c.alive && c.bodies.length) {
        this.foods.push(...c.corpseFood());
        c.destroy(this.physics);
      }
      if (c.alive) this.bestScore = Math.max(this.bestScore, c.score());
    }
    this.creatures.splice(0, this.creatures.length, ...this.creatures.filter((c) => c.alive));
    this.trimFood();

    this.physics.step();
    this.refillFood(false);

    while (this.creatures.length < this.params.population) {
      replaceOne(this);
    }
  }

  aliveCount(): number {
    return this.creatures.reduce((n, c) => n + (c.alive ? 1 : 0), 0);
  }

  fittest(): Creature | null {
    let best: Creature | null = null;
    let s = -1;
    for (const c of this.creatures) {
      if (!c.alive) continue;
      const sc = c.score();
      if (sc > s) {
        s = sc;
        best = c;
      }
    }
    return best;
  }

  selected(): Creature | null {
    return this.creatures.find((c) => c.alive && c.genome.id === this.selectedId) ?? null;
  }

  pickAt(x: number, y: number): Creature | null {
    let best: Creature | null = null;
    let dBest = 1.6;
    for (const c of this.creatures) {
      if (!c.alive) continue;
      const p = c.centroid();
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < dBest) {
        dBest = d;
        best = c;
      }
    }
    this.selectedId = best?.genome.id ?? null;
    return best;
  }

  followTarget(): Creature | null {
    if (this.params.follow === "selected") return this.selected();
    if (this.params.follow === "fittest") return this.fittest();
    return null;
  }

  refillFood(force: boolean): void {
    const want = this.params.foodCount;
    const live = this.foods.filter((f) => f.alive);
    this.foods.length = 0;
    this.foods.push(...live);
    while (this.foods.length < want) {
      this.foods.push(this.placeFood(force));
    }
  }

  private placeFood(scatter: boolean): Food {
    for (let tries = 0; tries < 12; tries++) {
      const x = this.rng.range(-WORLD_W * 0.46, WORLD_W * 0.46);
      const y = this.rng.range(-WORLD_H * 0.46, WORLD_H * 0.46);
      const n = this.noise(x * 0.08, y * 0.08);
      if (scatter || n > 0.05 || this.rng.chance(0.25)) {
        return {
          x,
          y,
          size: PLANT_SIZE,
          energy: 12,
          alive: true,
          pulse: this.rng.range(0, Math.PI * 2),
          source: "plant",
        };
      }
    }
    return {
      x: this.rng.range(-WORLD_W * 0.4, WORLD_W * 0.4),
      y: this.rng.range(-WORLD_H * 0.4, WORLD_H * 0.4),
      size: PLANT_SIZE,
      energy: 12,
      alive: true,
      pulse: this.rng.range(0, Math.PI * 2),
      source: "plant",
    };
  }

  private trimFood(): void {
    const live = this.foods.filter((f) => f.alive);
    if (live.length <= MAX_FOOD) {
      this.foods.length = 0;
      this.foods.push(...live);
      return;
    }
    const carrion = live.filter((f) => f.source === "carrion");
    const plants = live.filter((f) => f.source !== "carrion");
    this.foods.length = 0;
    this.foods.push(...carrion, ...plants.slice(0, Math.max(0, MAX_FOOD - carrion.length)));
  }

  clearCreatures(): void {
    for (const c of this.creatures) {
      if (c.bodies.length) c.destroy(this.physics);
    }
    this.creatures.length = 0;
  }

  private buildWalls(): void {
    const t = 1.2;
    const hw = WORLD_W / 2;
    const hh = WORLD_H / 2;
    const walls: Array<[number, number, number, number]> = [
      [0, -hh - t, hw + t * 2, t],
      [0, hh + t, hw + t * 2, t],
      [-hw - t, 0, t, hh + t * 2],
      [hw + t, 0, t, hh + t * 2],
    ];
    for (const [x, y, hx, hy] of walls) {
      const body = this.physics.createRigidBody(this.R.RigidBodyDesc.fixed().setTranslation(x, y));
      this.physics.createCollider(this.R.ColliderDesc.cuboid(hx, hy), body);
    }
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
