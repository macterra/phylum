import type RAPIER from "@dimforge/rapier2d-compat";
import chroma from "chroma-js";
import {
  AREA_PER_ENERGY,
  BITE_COOLDOWN,
  CATABOLIZE_BELOW,
  GAPE_MAX,
  GAPE_MIN,
  GROW_FROM_MEAL,
  HIDDEN,
  MAX_RADIUS,
  MIN_RADIUS,
  SENSE_RANGE,
  SENSOR_FEATURES,
  WORLD_H,
  WORLD_W,
} from "../config";
import { think } from "./brain";
import type { Genome } from "./genome";

export interface Food {
  x: number;
  y: number;
  energy: number;
  size: number;
  alive: boolean;
  pulse: number;
  source: "plant" | "carrion";
  hex?: string;
}

type Rapier = typeof import("@dimforge/rapier2d-compat").default;

export class Creature {
  readonly genome: Genome;
  readonly bodies: RAPIER.RigidBody[] = [];
  readonly colliders: RAPIER.Collider[] = [];
  readonly radii: number[] = [];
  energy: number;
  age = 0;
  foodEaten = 0;
  bites = 0;
  biteCool = 0;
  alive = true;
  hue: number;
  pulse: number;
  lastOutputs: number[] = [];
  hidden: number[];
  colorHex: string;

  constructor(R: Rapier, physics: RAPIER.World, genome: Genome, x: number, y: number) {
    this.genome = genome;
    this.hue = genome.lineage;
    this.pulse = Math.random() * Math.PI * 2;
    this.colorHex = chroma.hsl(this.hue * 360, 0.72, 0.58).hex();
    this.hidden = new Array<number>(HIDDEN).fill(0);

    for (const node of genome.nodes) {
      const desc = R.RigidBodyDesc.dynamic()
        .setTranslation(x + node.ox, y + node.oy)
        .setLinearDamping(2.4)
        .setAngularDamping(2.2)
        .setCcdEnabled(true);
      const body = physics.createRigidBody(desc);
      const collider = physics.createCollider(
        R.ColliderDesc.ball(node.radius).setRestitution(0.18).setFriction(0.05).setDensity(1.1),
        body,
      );
      this.bodies.push(body);
      this.colliders.push(collider);
      this.radii.push(node.radius);
    }
    this.energy = this.maxEnergy * (0.34 + Math.random() * 0.12);
  }

  get maxEnergy(): number {
    const storage = this.genome.nodes.filter((n) => n.kind === "storage").length;
    return 18 + storage * 8 + this.mass() * 16;
  }

  mass(): number {
    return this.radii.reduce((s, r) => s + r * r, 0);
  }

  mouthRadius(): number {
    let best = 0;
    for (let i = 0; i < this.genome.nodes.length; i++) {
      if (this.genome.nodes[i]!.kind === "mouth") best = Math.max(best, this.radii[i] ?? 0);
    }
    return best;
  }

  canEat(food: Food): boolean {
    for (let i = 0; i < this.genome.nodes.length; i++) {
      if (this.genome.nodes[i]!.kind !== "mouth") continue;
      const mouth = this.radii[i] ?? 0;
      if (food.size > mouth * GAPE_MIN && food.size < mouth * GAPE_MAX) return true;
    }
    return false;
  }

  centroid(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const body of this.bodies) {
      const t = body.translation();
      x += t.x;
      y += t.y;
    }
    const n = Math.max(1, this.bodies.length);
    return { x: x / n, y: y / n };
  }

  score(): number {
    return this.foodEaten * 14 + this.bites * 18 + this.age * 0.35 + Math.max(0, this.energy);
  }

  destroy(physics: RAPIER.World): void {
    for (const body of this.bodies) physics.removeRigidBody(body);
    this.bodies.length = 0;
    this.colliders.length = 0;
    this.radii.length = 0;
    this.alive = false;
  }

  step(foods: Food[], others: Creature[], dt: number): void {
    if (!this.alive) return;
    this.age += dt;
    this.biteCool = Math.max(0, this.biteCool - dt);
    this.pulse += dt * (1.6 + (1 - this.energy / this.maxEnergy));

    const com = this.centroid();
    let vx = 0;
    let vy = 0;
    for (const body of this.bodies) {
      const v = body.linvel();
      vx += v.x;
      vy += v.y;
    }
    vx /= Math.max(1, this.bodies.length);
    vy /= Math.max(1, this.bodies.length);

    const inputs = [
      (this.energy / this.maxEnergy) * 2 - 1,
      clamp(vx / 6, -1, 1),
      clamp(vy / 6, -1, 1),
      Math.sin(this.pulse),
      Math.cos(this.pulse * 0.7),
    ];
    for (const sid of this.genome.brain.sensorIds) {
      inputs.push(...this.senseAt(sid, foods, others, com));
    }

    const thought = think(this.genome.brain, inputs, this.hidden);
    this.hidden = thought.hidden;
    this.lastOutputs = thought.out;
    const pulse = thought.out[0] ?? 0;

    const driveById = new Map<number, number>();
    for (let t = 0; t < this.genome.brain.thrusterIds.length; t++) {
      driveById.set(this.genome.brain.thrusterIds[t]!, thought.out[1 + t] ?? 0);
    }

    let work = 0;
    for (let i = 0; i < this.genome.nodes.length; i++) {
      const node = this.genome.nodes[i]!;
      const body = this.bodies[i];
      if (!body) continue;
      body.resetForces(true);

      if (node.kind === "thruster") {
        const drive = driveById.get(node.id) ?? 0;
        const pos = body.translation();
        const heading = Math.atan2(pos.y - com.y, pos.x - com.x) + node.thrustAngle;
        const mag = drive * 3.4 + pulse * 0.8;
        body.addForce({ x: Math.cos(heading) * mag, y: Math.sin(heading) * mag }, true);
        work += Math.abs(mag);
      }
    }

    for (const edge of this.genome.edges) {
      const a = this.bodies[edge.a];
      const b = this.bodies[edge.b];
      if (!a || !b) continue;
      const pa = a.translation();
      const pb = b.translation();
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.hypot(dx, dy) || 1e-5;
      const nxn = dx / dist;
      const nyn = dy / dist;
      const va = a.linvel();
      const vb = b.linvel();
      const rel = (vb.x - va.x) * nxn + (vb.y - va.y) * nyn;
      const f = (dist - edge.rest) * edge.stiffness + rel * edge.damping;
      a.addForce({ x: f * nxn, y: f * nyn }, true);
      b.addForce({ x: -f * nxn, y: -f * nyn }, true);
    }

    for (let i = 0; i < this.genome.nodes.length; i++) {
      if (this.genome.nodes[i]!.kind !== "mouth") continue;
      const p = this.bodies[i]!.translation();
      const mouth = this.radii[i] ?? 0;
      for (const food of foods) {
        if (!food.alive) continue;
        if (Math.hypot(food.x - p.x, food.y - p.y) > mouth + 0.35) continue;
        if (!this.mouthCanEat(mouth, food)) continue;
        food.alive = false;
        this.growFromMeal(i, food.energy * GROW_FROM_MEAL);
        this.energy = Math.min(this.maxEnergy, this.energy + food.energy * (1 - GROW_FROM_MEAL));
        this.foodEaten += 1;
      }
      this.tryBite(i, others);
    }

    const mass = this.mass();
    this.energy -= dt * (0.16 + work * 0.016 + this.genome.nodes.length * 0.018 + mass * 0.22);
    if (this.energy < this.maxEnergy * CATABOLIZE_BELOW) this.catabolize(dt);
    this.energy = Math.min(this.energy, this.maxEnergy);
    if (this.energy <= 0) {
      this.catabolize(dt * 4);
      if (this.energy <= 0) this.alive = false;
    }
    if (this.alive) this.keepInTank();
  }

  corpseFood(): Food[] {
    const bits: Food[] = [];
    for (let i = 0; i < this.bodies.length; i++) {
      const p = this.bodies[i]!.translation();
      const size = this.radii[i] ?? this.genome.nodes[i]?.radius ?? 0.25;
      bits.push({
        x: p.x,
        y: p.y,
        size,
        energy: 3.2 + size * 16,
        alive: true,
        pulse: Math.random() * Math.PI * 2,
        source: "carrion",
        hex: this.colorHex,
      });
    }
    return bits;
  }

  private senseAt(
    sensorId: number,
    foods: Food[],
    others: Creature[],
    com: { x: number; y: number },
  ): number[] {
    const idx = this.genome.nodes.findIndex((n) => n.id === sensorId);
    const blank = new Array<number>(SENSOR_FEATURES).fill(0);
    if (idx < 0) return blank;
    const node = this.genome.nodes[idx]!;
    const body = this.bodies[idx];
    if (!body) return blank;
    const p = body.translation();
    const facing = Math.atan2(p.y - com.y, p.x - com.x) + node.thrustAngle;
    const cs = Math.cos(-facing);
    const sn = Math.sin(-facing);

    const pick = (dx: number, dy: number) => {
      const dist = Math.hypot(dx, dy);
      if (dist > SENSE_RANGE || dist < 1e-4) return null;
      const localX = dx * cs - dy * sn;
      if (localX < -0.12) return null;
      const localY = dx * sn + dy * cs;
      return {
        fx: clamp(localX / SENSE_RANGE, -1, 1),
        fy: clamp(localY / SENSE_RANGE, -1, 1),
        near: 1 - dist / SENSE_RANGE,
        d: dist,
      };
    };

    let plant = { fx: 0, fy: 0, near: 0, d: SENSE_RANGE };
    let carrion = { fx: 0, fy: 0, near: 0, d: SENSE_RANGE };
    let other = { fx: 0, fy: 0, near: 0, d: SENSE_RANGE };
    for (const food of foods) {
      if (!food.alive) continue;
      const hit = pick(food.x - p.x, food.y - p.y);
      if (!hit) continue;
      if (food.source === "carrion") {
        if (hit.d < carrion.d) carrion = hit;
      } else if (hit.d < plant.d) {
        plant = hit;
      }
    }
    for (const creature of others) {
      if (!creature.alive || creature === this) continue;
      for (const organ of creature.bodies) {
        const q = organ.translation();
        const hit = pick(q.x - p.x, q.y - p.y);
        if (hit && hit.d < other.d) other = hit;
      }
    }
    return [plant.fx, plant.fy, plant.near, carrion.fx, carrion.fy, carrion.near, other.fx, other.fy, other.near];
  }

  private tryBite(mouthIndex: number, others: Creature[]): void {
    if (this.biteCool > 0) return;
    const mouth = this.radii[mouthIndex] ?? 0;
    const p = this.bodies[mouthIndex]!.translation();
    for (const other of others) {
      if (!other.alive || other === this) continue;
      for (let j = 0; j < other.bodies.length; j++) {
        const r = other.radii[j] ?? 0;
        if (r >= mouth * 0.92) continue;
        const q = other.bodies[j]!.translation();
        if (Math.hypot(q.x - p.x, q.y - p.y) > mouth + r * 0.4) continue;
        const take = 5.5 + mouth * 10;
        other.wound(j, take);
        this.energy = Math.min(this.maxEnergy, this.energy + take * 0.55);
        this.growFromMeal(mouthIndex, take * 0.35);
        this.bites += 1;
        this.biteCool = BITE_COOLDOWN;
        return;
      }
    }
  }

  wound(organIndex: number, take: number): void {
    this.energy -= take;
    const r = this.radii[organIndex] ?? 0;
    const minR = this.minRadius(organIndex);
    const area = r * r;
    const takeArea = Math.min(Math.max(0, area - minR * minR), take * AREA_PER_ENERGY * 0.85);
    this.setRadius(organIndex, Math.sqrt(Math.max(minR * minR, area - takeArea)));
    if (this.energy <= 0) this.alive = false;
  }

  private mouthCanEat(mouth: number, food: Food): boolean {
    return food.size > mouth * GAPE_MIN && food.size < mouth * GAPE_MAX;
  }

  private growFromMeal(mouthIndex: number, energy: number): void {
    let area = energy * AREA_PER_ENERGY;
    area -= this.addArea(mouthIndex, area * 0.55);
    const next = this.neighbors(mouthIndex);
    if (next.length === 0) {
      this.addArea(mouthIndex, area);
      return;
    }
    const share = area / next.length;
    for (const j of next) this.addArea(j, share);
  }

  private catabolize(dt: number): void {
    let biggest = -1;
    let biggestR = 0;
    for (let i = 0; i < this.radii.length; i++) {
      const minR = this.minRadius(i);
      const r = this.radii[i] ?? 0;
      if (r > minR + 0.002 && r > biggestR) {
        biggestR = r;
        biggest = i;
      }
    }
    if (biggest < 0) return;
    const minR = this.minRadius(biggest);
    const area = biggestR * biggestR;
    const take = Math.min(area - minR * minR, 0.35 * dt);
    this.setRadius(biggest, Math.sqrt(Math.max(minR * minR, area - take)));
    this.energy += (take / AREA_PER_ENERGY) * 0.65;
  }

  private addArea(index: number, area: number): number {
    const r = this.radii[index] ?? 0;
    const maxR = this.maxRadius(index);
    const room = maxR * maxR - r * r;
    const used = Math.max(0, Math.min(area, room));
    this.setRadius(index, Math.sqrt(r * r + used));
    return used;
  }

  private setRadius(index: number, radius: number): void {
    const next = clamp(radius, this.minRadius(index), this.maxRadius(index));
    this.radii[index] = next;
    this.colliders[index]?.setRadius(next);
  }

  private minRadius(index: number): number {
    return Math.max(MIN_RADIUS, (this.genome.nodes[index]?.radius ?? 0.2) * 0.45);
  }

  private maxRadius(index: number): number {
    return Math.min(MAX_RADIUS, (this.genome.nodes[index]?.radius ?? 0.2) * 2.8);
  }

  private neighbors(index: number): number[] {
    const out: number[] = [];
    for (const edge of this.genome.edges) {
      if (edge.a === index) out.push(edge.b);
      else if (edge.b === index) out.push(edge.a);
    }
    return out;
  }

  private keepInTank(): void {
    const pad = 1.2;
    const minX = -WORLD_W / 2 + pad;
    const maxX = WORLD_W / 2 - pad;
    const minY = -WORLD_H / 2 + pad;
    const maxY = WORLD_H / 2 - pad;
    for (const body of this.bodies) {
      const p = body.translation();
      const v = body.linvel();
      let x = p.x;
      let y = p.y;
      let vx = v.x;
      let vy = v.y;
      let hit = false;
      if (x < minX) {
        x = minX;
        vx = Math.abs(vx) * 0.4;
        hit = true;
      } else if (x > maxX) {
        x = maxX;
        vx = -Math.abs(vx) * 0.4;
        hit = true;
      }
      if (y < minY) {
        y = minY;
        vy = Math.abs(vy) * 0.4;
        hit = true;
      } else if (y > maxY) {
        y = maxY;
        vy = -Math.abs(vy) * 0.4;
        hit = true;
      }
      if (hit) {
        body.setTranslation({ x, y }, true);
        body.setLinvel({ x: vx, y: vy }, true);
      }
    }
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
