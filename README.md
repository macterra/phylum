# Phylum

A cinematic 2D artificial-life tank in the browser. Creatures are soft-body graphs — glowing organs, ligaments, sensors, mouths, thrusters — with tiny brains that mutate each generation.

**Live:** [macterra.github.io/phylum](https://macterra.github.io/phylum/)

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
- `N` optional full reset from current elites

## What you are watching

Each organism is a genome: node kinds, rest lengths, and a recurrent brain (6 hidden units). Sensor organs look in their facing hemisphere and report the nearest plant and nearest carrion in local coordinates — they are not a global GPS. Adding or losing a thruster or sensor keeps the old weights and only randomizes the new slot. Meals become biomass; a mouth only swallows food in its gape window. There is no generation clock: when someone starves, a child of a living high-scorer is born nearby.
