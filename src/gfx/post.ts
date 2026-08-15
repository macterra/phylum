import * as THREE from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import type { SimParams } from "../sim/world";

export interface PostFx {
  render(): void;
  apply(params: SimParams): void;
}

type BloomHandle = {
  strength: { value: number };
  threshold: { value: number };
  radius: { value: number };
};

export function createPost(renderer: any, scene: any, camera: any, params: SimParams): PostFx {
  const scenePass = pass(scene, camera);
  const sceneColor = scenePass.getTextureNode("output");
  const bloomPass = bloom(sceneColor, params.bloomStrength, 0.42, params.bloomThreshold) as unknown as BloomHandle;

  const PipelineCtor = THREE.RenderPipeline ?? THREE.PostProcessing;

  const pipeline = new PipelineCtor(renderer);
  pipeline.outputNode = sceneColor.add(bloomPass as never);

  return {
    render() {
      pipeline.render();
    },
    apply(next) {
      bloomPass.strength.value = next.bloomStrength;
      bloomPass.threshold.value = next.bloomThreshold;
    },
  };
}
