import { Pane } from "tweakpane";
import { nextGeneration } from "../sim/evolve";
import type { Tank } from "../sim/world";

export function bindPane(tank: Tank, onRestart: () => void): { refresh: () => void } {
  const pane = new Pane({
    title: "Phylum",
    container: document.querySelector("#pane-root") as HTMLElement,
  }) as any;

  pane.addBinding(tank.params, "paused");
  pane.addBinding(tank.params, "follow", {
    options: { none: "none", fittest: "fittest", selected: "selected" },
  });

  const evo = pane.addFolder({ title: "evolution" });
  evo.addBinding(tank.params, "mutationRate", { min: 0.02, max: 0.55, step: 0.01 });
  evo.addBinding(tank.params, "population", { min: 12, max: 80, step: 1 });
  evo.addBinding(tank.params, "foodCount", { min: 20, max: 180, step: 1 });

  const look = pane.addFolder({ title: "look" });
  look.addBinding(tank.params, "bloomStrength", { min: 0, max: 2.2, step: 0.05 });
  look.addBinding(tank.params, "bloomThreshold", { min: 0, max: 0.8, step: 0.01 });
  look.addBinding(tank.params, "trailFade", { min: 0.55, max: 0.97, step: 0.01 });

  pane.addButton({ title: "Next generation" }).on("click", () => nextGeneration(tank));
  pane.addButton({ title: "New tank" }).on("click", onRestart);
  return pane;
}
