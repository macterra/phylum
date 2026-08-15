import * as THREE from "three/webgpu";
import { WORLD_H, WORLD_W } from "../config";
import type { Tank } from "../sim/world";
import { LifeLayer } from "./creatureMesh";
import { createField } from "./field";
import { createPost, type PostFx } from "./post";

export class Viz {
  readonly renderer: any;
  readonly scene = new THREE.Scene();
  readonly camera: any;
  readonly life = new LifeLayer();
  private post!: PostFx;
  private zoom = 1;
  private userZoom = 1;
  private camX = 0;
  private camY = 0;

  private constructor(renderer: any) {
    this.renderer = renderer;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
    this.camera.position.z = 12;
    this.scene.background = new THREE.Color(0x02050c);
    this.scene.add(createField());
    this.scene.add(this.life.group);
  }

  static async create(canvas: HTMLCanvasElement): Promise<Viz> {
    const renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    await renderer.init();

    const viz = new Viz(renderer);
    viz.post = createPost(renderer, viz.scene, viz.camera, {
      population: 0,
      foodCount: 0,
      mutationRate: 0,
      generationSeconds: 0,
      bloomStrength: 0.95,
      bloomThreshold: 0.12,
      trailFade: 0.86,
      follow: "none",
      paused: false,
    });
    viz.layout();
    window.addEventListener("resize", () => viz.layout());
    return viz;
  }

  layout(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.applyFrustum();
  }

  private applyFrustum(): void {
    const viewAspect = window.innerWidth / Math.max(1, window.innerHeight);
    const worldAspect = WORLD_W / WORLD_H;
    let halfW: number;
    let halfH: number;
    if (viewAspect > worldAspect) {
      halfH = (WORLD_H / 2) * 1.06;
      halfW = halfH * viewAspect;
    } else {
      halfW = (WORLD_W / 2) * 1.06;
      halfH = halfW / viewAspect;
    }
    const z = 1 / this.zoom;
    this.camera.left = -halfW * z;
    this.camera.right = halfW * z;
    this.camera.top = halfH * z;
    this.camera.bottom = -halfH * z;
    this.camera.position.x = this.camX;
    this.camera.position.y = this.camY;
    this.camera.updateProjectionMatrix();
  }

  resetView(): void {
    this.userZoom = 1;
    this.zoom = 1;
    this.camX = 0;
    this.camY = 0;
    this.applyFrustum();
  }

  frameSelected(): void {
    this.userZoom = Math.max(this.userZoom, 2.35);
  }

  nudgeZoom(deltaY: number, clientX: number, clientY: number): void {
    const before = this.screenToWorld(clientX, clientY);
    const factor = deltaY > 0 ? 0.88 : 1.14;
    this.userZoom = Math.max(0.55, Math.min(7, this.userZoom * factor));
    this.zoom = this.userZoom;
    this.applyFrustum();
    const after = this.screenToWorld(clientX, clientY);
    this.camX += before.x - after.x;
    this.camY += before.y - after.y;
    this.applyFrustum();
  }

  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const ndcX = (clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(clientY / window.innerHeight) * 2 + 1;
    const x = this.camX + ndcX * (this.camera.right - this.camera.left) * 0.5;
    const y = this.camY + ndcY * (this.camera.top - this.camera.bottom) * 0.5;
    return { x, y };
  }

  sync(tank: Tank, dt: number): void {
    this.life.sync(tank, tank.params.paused ? 0 : dt);
    const target = tank.followTarget();
    this.zoom += (this.userZoom - this.zoom) * 0.14;
    if (target) {
      const p = target.centroid();
      this.camX += (p.x - this.camX) * 0.07;
      this.camY += (p.y - this.camY) * 0.07;
    } else if (this.userZoom <= 1.02) {
      this.camX += (0 - this.camX) * 0.04;
      this.camY += (0 - this.camY) * 0.04;
    }
    this.applyFrustum();
    this.post.apply(tank.params);
  }

  render(): void {
    this.post.render();
  }
}
