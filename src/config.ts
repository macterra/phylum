export const WORLD_W = 72;
export const WORLD_H = 40;

export const MAX_CREATURES = 80;
export const MAX_NODES = 8;
export const MAX_EDGES = 12;
export const MAX_FOOD = 640;
export const TRAIL_SAMPLES = 10;

export const DEFAULTS = {
  population: 56,
  foodCount: 110,
  mutationRate: 0.18,
  generationSeconds: 80,
  bloomStrength: 0.95,
  bloomThreshold: 0.12,
  trailFade: 0.86,
  follow: "none" as FollowMode,
  paused: false,
};

export type FollowMode = "none" | "fittest" | "selected";

export const BRAIN_INPUTS = 8;

export const NODE_KINDS = ["body", "sensor", "mouth", "thruster", "storage"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];
