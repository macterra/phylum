import { BRAIN_INPUTS } from "../config";
import type { Genome } from "./genome";
import { outputCount } from "./genome";

export function think(genome: Genome, inputs: number[]): number[] {
  const outs = outputCount(genome);
  const y = new Array<number>(outs);
  for (let o = 0; o < outs; o++) {
    let s = genome.biases[o] ?? 0;
    for (let i = 0; i < BRAIN_INPUTS; i++) {
      s += (genome.weights[o * BRAIN_INPUTS + i] ?? 0) * (inputs[i] ?? 0);
    }
    y[o] = Math.tanh(s);
  }
  return y;
}
