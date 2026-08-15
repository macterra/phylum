import * as THREE from "three/webgpu";
import { Fn, uv, time, vec3, sin, cos } from "three/tsl";
import { WORLD_H, WORLD_W } from "../config";

export function createField(): any {
  const material = new THREE.MeshBasicNodeMaterial();
  material.colorNode = Fn(() => {
    const p = uv().mul(7.0);
    const t = time.mul(0.05);
    const wave = sin(p.x.add(t)).mul(cos(p.y.mul(1.3).sub(t.mul(0.8))));
    const ripple = sin(p.x.mul(0.45).add(p.y.mul(0.7)).sub(t.mul(1.4)));
    const base = vec3(0.012, 0.025, 0.05);
    const glow = vec3(0.03, 0.09, 0.14).mul(wave.abs().mul(0.28).add(ripple.abs().mul(0.12)));
    return base.add(glow);
  })();

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W * 1.25, WORLD_H * 1.25), material);
  mesh.position.z = -2;
  mesh.frustumCulled = false;
  return mesh;
}
