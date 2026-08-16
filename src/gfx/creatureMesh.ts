import * as THREE from "three/webgpu";
import chroma from "chroma-js";
import {
  MAX_CREATURES,
  MAX_EDGES,
  MAX_FOOD,
  MAX_NODES,
  TRAIL_SAMPLES,
} from "../config";
import type { Tank } from "../sim/world";

const dummy = new THREE.Object3D();
const color = new THREE.Color();

function glowTexture(): any {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.28, "rgba(255,255,255,0.72)");
  g.addColorStop(0.62, "rgba(255,255,255,0.18)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowMaterial(opacity = 1): any {
  return new THREE.MeshBasicMaterial({
    map: glowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity,
  });
}

export class LifeLayer {
  readonly group = new THREE.Group();
  private readonly organs: any;
  private readonly ligaments: any;
  private readonly food: any;
  private readonly trails: any;
  private readonly trail: Array<{ x: number; y: number; hex: string; life: number; size: number } | null>;
  private trailCursor = 0;

  constructor() {
    const plane = new THREE.PlaneGeometry(1, 1);
    this.organs = new THREE.InstancedMesh(plane, glowMaterial(1), MAX_CREATURES * MAX_NODES);
    this.ligaments = new THREE.InstancedMesh(plane, glowMaterial(0.85), MAX_CREATURES * MAX_EDGES);
    this.food = new THREE.InstancedMesh(plane, glowMaterial(1), MAX_FOOD);
    this.trails = new THREE.InstancedMesh(
      plane,
      glowMaterial(0.7),
      MAX_CREATURES * MAX_NODES * TRAIL_SAMPLES,
    );
    for (const mesh of [this.organs, this.ligaments, this.food, this.trails]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(mesh);
    }
    this.trail = Array.from({ length: this.trails.count }, () => null);
  }

  sync(tank: Tank, dt: number): void {
    this.syncCreatures(tank, dt);
    this.syncFood(tank);
    this.syncTrails(tank.params.trailFade);
  }

  private syncCreatures(tank: Tank, dt: number): void {
    let organI = 0;
    let edgeI = 0;
    const drop = dt > 0 && Math.random() < Math.min(1, dt * 28);

    for (const creature of tank.creatures) {
      if (!creature.alive) continue;
      const energy = creature.energy / creature.maxEnergy;
      const selected = creature.genome.id === tank.selectedId;
      const base = chroma(creature.colorHex);

      for (let i = 0; i < creature.genome.nodes.length; i++) {
        const node = creature.genome.nodes[i]!;
        const body = creature.bodies[i];
        if (!body) continue;
        const p = body.translation();
        const kindBoost = node.kind === "mouth" ? 1.15 : node.kind === "thruster" ? 1.08 : 1;
        const pulse = 0.82 + 0.22 * Math.sin(creature.pulse + i) * energy;
        const liveR = creature.radii[i] ?? node.radius;
        const size = liveR * 2.8 * kindBoost * pulse * (selected ? 1.08 : 1);
        dummy.position.set(p.x, p.y, 0.1);
        dummy.scale.set(size, size, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        this.organs.setMatrixAt(organI, dummy.matrix);

        const hue = (creature.hue + node.hueShift + 1) % 1;
        const lite = node.kind === "sensor" ? 0.72 : node.kind === "mouth" ? 0.66 : 0.56;
        const col = chroma.hsl(hue * 360, 0.78, lite).brighten(energy * 0.4);
        color.set(col.hex());
        this.organs.setColorAt(organI, color);
        organI += 1;

        if (drop) this.pushTrail(p.x, p.y, col.hex(), size * 0.72);
      }

      for (const edge of creature.genome.edges) {
        const a = creature.bodies[edge.a];
        const b = creature.bodies[edge.b];
        if (!a || !b) continue;
        const pa = a.translation();
        const pb = b.translation();
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const len = Math.hypot(dx, dy);
        dummy.position.set((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, 0.05);
        dummy.rotation.set(0, 0, Math.atan2(dy, dx));
        dummy.scale.set(len, 0.09 + energy * 0.05, 1);
        dummy.updateMatrix();
        this.ligaments.setMatrixAt(edgeI, dummy.matrix);
        color.set(base.saturate(0.2).hex());
        this.ligaments.setColorAt(edgeI, color);
        edgeI += 1;
      }
    }

    this.organs.count = organI;
    this.ligaments.count = edgeI;
    this.organs.instanceMatrix.needsUpdate = true;
    this.ligaments.instanceMatrix.needsUpdate = true;
    if (this.organs.instanceColor) this.organs.instanceColor.needsUpdate = true;
    if (this.ligaments.instanceColor) this.ligaments.instanceColor.needsUpdate = true;
  }

  private syncFood(tank: Tank): void {
    let i = 0;
    for (const food of tank.foods) {
      if (!food.alive) continue;
      food.pulse += 0.04;
      const s = food.size * 2.6 + 0.06 * Math.sin(food.pulse);
      dummy.position.set(food.x, food.y, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(s, s, 1);
      dummy.updateMatrix();
      this.food.setMatrixAt(i, dummy.matrix);
      color.set(food.hex ?? 0xb8ff6a);
      this.food.setColorAt(i, color);
      i += 1;
    }
    this.food.count = i;
    this.food.instanceMatrix.needsUpdate = true;
    if (this.food.instanceColor) this.food.instanceColor.needsUpdate = true;
  }

  private pushTrail(x: number, y: number, hex: string, size: number): void {
    this.trail[this.trailCursor] = { x, y, hex, life: 1, size };
    this.trailCursor = (this.trailCursor + 1) % this.trail.length;
  }

  private syncTrails(fade: number): void {
    let i = 0;
    for (let t = 0; t < this.trail.length; t++) {
      const sample = this.trail[t];
      if (!sample) continue;
      sample.life *= fade;
      if (sample.life < 0.03) {
        this.trail[t] = null;
        continue;
      }
      dummy.position.set(sample.x, sample.y, -0.05);
      dummy.rotation.set(0, 0, 0);
      const s = sample.size * (0.35 + sample.life * 0.7);
      dummy.scale.set(s, s, 1);
      dummy.updateMatrix();
      this.trails.setMatrixAt(i, dummy.matrix);
      color.set(sample.hex);
      color.multiplyScalar(sample.life * 0.55);
      this.trails.setColorAt(i, color);
      i += 1;
    }
    this.trails.count = i;
    this.trails.instanceMatrix.needsUpdate = true;
    if (this.trails.instanceColor) this.trails.instanceColor.needsUpdate = true;
  }
}
