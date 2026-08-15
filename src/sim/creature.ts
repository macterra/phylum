import type RAPIER from "@dimforge/rapier2d-compat";
import chroma from "chroma-js";
import { WORLD_H, WORLD_W } from "../config";
import { think } from "./brain";
import type { Genome } from "./genome";

export interface Food {
  x: number;
  y: number;
  energy: number;
  alive: boolean;
  pulse: number;
  source: "plant" | "carrion";
  hex?: string;
}

type Rapier = typeof import("@dimforge/rapier2d-compat").default;

export class Creature {
  readonly genome: Genome;
  readonly bodies: RAPIER.RigidBody[] = [];
  energy: number;
  readonly maxEnergy: number;
  age = 0;
  foodEaten = 0;
  alive = true;
  hue: number;
  pulse: number;
  lastOutputs: number[] = [];
  colorHex: string;

  constructor(R: Rapier, physics: RAPIER.World, genome: Genome, x: number, y: number) {
    this.genome = genome;
    this.hue = genome.lineage;
    this.pulse = Math.random() * Math.PI * 2;
    this.colorHex = chroma.hsl(this.hue * 360, 0.72, 0.58).hex();
    const storage = genome.nodes.filter((n) => n.kind === "storage").length;
    this.maxEnergy = 36 + storage * 12;
    this.energy = this.maxEnergy * (0.34 + Math.random() * 0.12);

    for (const node of genome.nodes) {
      const desc = R.RigidBodyDesc.dynamic()
        .setTranslation(x + node.ox, y + node.oy)
        .setLinearDamping(2.4)
        .setAngularDamping(2.2)
        .setCcdEnabled(true);
      const body = physics.createRigidBody(desc);
      physics.createCollider(
        R.ColliderDesc.ball(node.radius).setRestitution(0.18).setFriction(0.05).setDensity(1.1),
        body,
      );
      this.bodies.push(body);
    }
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
    return this.foodEaten * 14 + this.age * 0.35 + Math.max(0, this.energy);
  }

  destroy(physics: RAPIER.World): void {
    for (const body of this.bodies) physics.removeRigidBody(body);
    this.bodies.length = 0;
    this.alive = false;
  }

  step(foods: Food[], dt: number): void {
    if (!this.alive) return;
    this.age += dt;
    this.pulse += dt * (1.6 + (1 - this.energy / this.maxEnergy));

    const com = this.centroid();
    let nearest = 99;
    let nx = 0;
    let ny = 0;
    for (const food of foods) {
      if (!food.alive) continue;
      const dx = food.x - com.x;
      const dy = food.y - com.y;
      const d = Math.hypot(dx, dy);
      if (d < nearest) {
        nearest = d;
        nx = dx;
        ny = dy;
      }
    }

    let vx = 0;
    let vy = 0;
    for (const body of this.bodies) {
      const v = body.linvel();
      vx += v.x;
      vy += v.y;
    }
    vx /= this.bodies.length;
    vy /= this.bodies.length;

    const inputs = [
      (this.energy / this.maxEnergy) * 2 - 1,
      clamp(nx / 12, -1, 1),
      clamp(ny / 12, -1, 1),
      clamp(1 - nearest / 18, -1, 1),
      clamp(vx / 6, -1, 1),
      clamp(vy / 6, -1, 1),
      Math.sin(this.pulse),
      Math.cos(this.pulse * 0.7),
    ];
    const outputs = think(this.genome, inputs);
    this.lastOutputs = outputs;
    const pulse = outputs[0] ?? 0;

    let thrustIndex = 1;
    let work = 0;
    for (let i = 0; i < this.genome.nodes.length; i++) {
      const node = this.genome.nodes[i]!;
      const body = this.bodies[i];
      if (!body) continue;
      body.resetForces(true);

      if (node.kind === "thruster") {
        const drive = outputs[thrustIndex++] ?? 0;
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
      const node = this.genome.nodes[i]!;
      if (node.kind !== "mouth") continue;
      const p = this.bodies[i]!.translation();
      for (const food of foods) {
        if (!food.alive) continue;
        if (Math.hypot(food.x - p.x, food.y - p.y) < node.radius + 0.42) {
          food.alive = false;
          this.energy = Math.min(this.maxEnergy, this.energy + food.energy);
          this.foodEaten += 1;
        }
      }
    }

    this.energy -= dt * (0.2 + work * 0.018 + this.genome.nodes.length * 0.022);
    if (this.energy <= 0) this.alive = false;
    else this.keepInTank();
  }

  corpseFood(): Food[] {
    const bits: Food[] = [];
    for (let i = 0; i < this.bodies.length; i++) {
      const p = this.bodies[i]!.translation();
      const radius = this.genome.nodes[i]?.radius ?? 0.25;
      bits.push({
        x: p.x,
        y: p.y,
        energy: 2.6 + radius * 7,
        alive: true,
        pulse: Math.random() * Math.PI * 2,
        source: "carrion",
        hex: this.colorHex,
      });
    }
    return bits;
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
