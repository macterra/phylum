import RAPIER from "@dimforge/rapier2d-compat";
import { GAPE_MAX, GAPE_MIN } from "./config";
import { Viz } from "./gfx/renderer";
import { nextGeneration } from "./sim/evolve";
import { Tank } from "./sim/world";
import { bindPane } from "./ui/pane";

const hud = {
  gen: document.querySelector("#stat-gen")!,
  alive: document.querySelector("#stat-alive")!,
  best: document.querySelector("#stat-best")!,
  food: document.querySelector("#stat-food")!,
  inspect: document.querySelector("#inspect") as HTMLElement,
  inspectTitle: document.querySelector("#inspect-title")!,
  inspectBody: document.querySelector("#inspect-body")!,
};

async function boot(): Promise<void> {
  await RAPIER.init();
  const canvas = document.querySelector("#stage") as HTMLCanvasElement;
  const viz = await Viz.create(canvas);
  let tank = new Tank(RAPIER);

  const pane = bindPane(tank, () => tank.reseed());

  const releaseCamera = () => {
    tank.params.follow = "none";
    tank.selectedId = null;
    viz.resetView();
    pane.refresh();
  };

  canvas.addEventListener("pointerdown", (event) => {
    const p = viz.screenToWorld(event.clientX, event.clientY);
    const hit = tank.pickAt(p.x, p.y);
    if (hit) {
      tank.params.follow = "selected";
      viz.frameSelected();
    } else {
      releaseCamera();
    }
    pane.refresh();
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      viz.nudgeZoom(event.deltaY, event.clientX, event.clientY);
    },
    { passive: false },
  );

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      tank.params.paused = !tank.params.paused;
      pane.refresh();
    } else if (event.key === "Escape" || event.key === "0") {
      releaseCamera();
    } else if (event.key === "f" || event.key === "F") {
      tank.params.follow = tank.params.follow === "fittest" ? "none" : "fittest";
      if (tank.params.follow === "none") viz.resetView();
      else viz.frameSelected();
      pane.refresh();
    } else if (event.key === "r" || event.key === "R") {
      tank.reseed();
    } else if (event.key === "n" || event.key === "N") {
      nextGeneration(tank);
    }
  });

  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!tank.params.paused) tank.step(dt);
    viz.sync(tank, dt);
    viz.render();
    paintHud(tank);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function paintHud(tank: Tank): void {
  hud.gen.textContent = String(tank.generation);
  hud.alive.textContent = String(tank.aliveCount());
  hud.best.textContent = tank.bestScore.toFixed(0);
  hud.food.textContent = String(tank.foods.filter((f) => f.alive).length);

  const sel = tank.selected() ?? (tank.params.follow === "fittest" ? tank.fittest() : null);
  if (!sel) {
    hud.inspect.hidden = true;
    return;
  }
  hud.inspect.hidden = false;
  hud.inspectTitle.textContent = sel.genome.id;
  const kinds = sel.genome.nodes.map((n) => n.kind[0]).join("");
  hud.inspectBody.textContent = [
    `born     gen ${sel.genome.born}`,
    `lineage  ${sel.hue.toFixed(3)}`,
    `organs   ${sel.genome.nodes.length}  ${kinds}`,
    `sensors  ${sel.genome.brain.sensorIds.length}  hidden ${sel.hidden.map((h) => h.toFixed(1)).join(" ")}`,
    `energy   ${sel.energy.toFixed(1)} / ${sel.maxEnergy.toFixed(0)}`,
    `mouth    ${sel.mouthRadius().toFixed(2)}  gape ${(sel.mouthRadius() * GAPE_MIN).toFixed(2)}–${(sel.mouthRadius() * GAPE_MAX).toFixed(2)}`,
    `mass     ${sel.mass().toFixed(2)}`,
    `eaten    ${sel.foodEaten}  bites ${sel.bites}`,
    `age      ${sel.age.toFixed(1)}s`,
    `score    ${sel.score().toFixed(1)}`,
  ].join("\n");
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre class="hint">${String(err)}</pre>`,
  );
});
