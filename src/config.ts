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
  bloomStrength: 0.95,
  bloomThreshold: 0.12,
  trailFade: 0.86,
  follow: "none" as FollowMode,
  paused: false,
};

export type FollowMode = "none" | "fittest" | "selected";

export const PLANT_SIZE = 0.1;
export const GAPE_MIN = 0.22;
export const GAPE_MAX = 1.12;
export const MIN_RADIUS = 0.09;
export const MAX_RADIUS = 0.95;
export const GROW_FROM_MEAL = 0.48;
export const AREA_PER_ENERGY = 0.011;
export const CATABOLIZE_BELOW = 0.28;

export const HIDDEN = 6;
export const GLOBAL_INPUTS = 5;
export const SENSOR_FEATURES = 12;
export const BITE_COOLDOWN = 0.16;
export const SENSE_RANGE = 16;

export const NODE_KINDS = ["body", "sensor", "mouth", "thruster", "storage"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];
