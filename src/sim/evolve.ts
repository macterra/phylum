import type { Tank } from "./world";
import { mutateGenome, randomGenome } from "./genome";

export function nextGeneration(tank: Tank): void {
  const ranked = tank.creatures
    .slice()
    .sort((a, b) => b.score() - a.score());
  const eliteCount = Math.max(4, Math.floor(tank.params.population * 0.2));
  const elites = ranked.slice(0, eliteCount);

  tank.bestScore = Math.max(tank.bestScore, ranked[0]?.score() ?? 0);
  tank.clearCreatures();
  tank.generation += 1;
  tank.timeInGen = 0;

  for (const parent of elites) {
    const kept = mutateGenome(parent.genome, tank.rng, tank.params.mutationRate * 0.15);
    kept.born = tank.generation;
    tank.spawn(kept);
  }

  while (tank.creatures.length < tank.params.population) {
    if (tank.rng.chance(0.12) || elites.length === 0) {
      tank.spawn(randomGenome(tank.rng, tank.generation));
      continue;
    }
    const a = tank.rng.pick(elites);
    const child = mutateGenome(a.genome, tank.rng, tank.params.mutationRate);
    child.born = tank.generation;
    tank.spawn(child);
  }

  tank.refillFood(false);
}
