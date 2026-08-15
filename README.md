# Phylum

A cinematic 2D artificial-life tank in the browser. Creatures are soft-body graphs — glowing organs, ligaments, sensors, mouths, thrusters — with tiny brains that mutate each generation.

## Stack

- **Three.js WebGPU + TSL** — ortho 2D, bloom, field shader
- **Rapier2D** — swimming soft bodies
- **Tweakpane** — live evolution / look controls
- **Vite + TypeScript**

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Controls

- Click a creature to inspect and follow it
- Scroll to zoom, `Esc` / `0` / click empty space to pull back
- `Space` pause
- `F` follow the current fittest
- `R` new random tank
- `N` force the next generation

## What you are watching

Each organism is a genome: node kinds, rest lengths, and a small feed-forward brain. Mouths eat the green motes. Thrusters fire from neural output. When the clock runs out — or the tank thins — the top 20% seed the next generation.
