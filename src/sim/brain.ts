import { GLOBAL_INPUTS, HIDDEN, SENSOR_FEATURES } from "../config";
import type { BrainGene } from "./genome";

export function inputSize(sensorCount: number): number {
  return GLOBAL_INPUTS + sensorCount * SENSOR_FEATURES;
}

export function think(
  brain: BrainGene,
  inputs: number[],
  hidden: number[],
): { out: number[]; hidden: number[] } {
  const nextH = new Array<number>(HIDDEN);
  const inCount = Math.max(inputs.length, 1);
  for (let h = 0; h < HIDDEN; h++) {
    let s = brain.bh[h] ?? 0;
    for (let i = 0; i < inCount; i++) {
      s += (brain.wih[h * inCount + i] ?? 0) * (inputs[i] ?? 0);
    }
    for (let k = 0; k < HIDDEN; k++) {
      s += (brain.whh[h * HIDDEN + k] ?? 0) * (hidden[k] ?? 0);
    }
    nextH[h] = Math.tanh(s);
  }

  const outs = brain.bo.length;
  const out = new Array<number>(outs);
  for (let o = 0; o < outs; o++) {
    let s = brain.bo[o] ?? 0;
    for (let h = 0; h < HIDDEN; h++) {
      s += (brain.who[o * HIDDEN + h] ?? 0) * nextH[h]!;
    }
    out[o] = Math.tanh(s);
  }
  return { out, hidden: nextH };
}
