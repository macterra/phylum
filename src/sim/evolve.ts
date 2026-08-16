import type { Tank } from "./world";
import { mutateGenome, randomGenome } from "./genome";

export function replaceOne(tank: Tank): void {
  const parent = pickParent(tank);
  if (!parent || tank.rng.chance(0.1)) {
    const child = randomGenome(tank.rng, tank.generation);
    tank.spawn(child);
    tank.noteBirth();
    return;
  }
  const child = mutateGenome(parent.genome, tank.rng, tank.params.mutationRate);
  child.born = tank.generation;
  const at = parent.centroid();
  tank.spawn(child, at.x + tank.rng.range(-6, 6), at.y + tank.rng.range(-6, 6));
  tank.noteBirth();
}

export function nextGeneration(tank: Tank): void {
  const live = tank.creatures.filter((c) => c.alive);
  const ranked = live.slice().sort((a, b) => b.score() - a.score());
  const eliteCount = Math.max(4, Math.floor(tank.params.population * 0.2));
  const elites = ranked.slice(0, eliteCount);

  tank.bestScore = Math.max(tank.bestScore, ranked[0]?.score() ?? 0);
  tank.clearCreatures();
  tank.generation += 1;

  for (const parent of elites) {
    const kept = mutateGenome(parent.genome, tank.rng, tank.params.mutationRate * 0.15);
    kept.born = tank.generation;
    tank.spawn(kept);
  }

  while (tank.creatures.length < tank.params.population) {
    replaceOne(tank);
  }

  tank.births = 0;
  tank.refillFood(false);
}

function pickParent(tank: Tank) {
  const live = tank.creatures.filter((c) => c.alive);
  if (live.length === 0) return null;
  let best = tank.rng.pick(live);
  for (let i = 0; i < 2; i++) {
    const challenger = tank.rng.pick(live);
    if (challenger.score() > best.score()) best = challenger;
  }
  return best;
}
