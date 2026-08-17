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

Each organism is a genome: node kinds, rest lengths, and a recurrent brain (6 hidden units). Sensor organs look in their facing hemisphere and report the nearest plant, carrion, neighbor, and biteable prey. A mouth that reaches a smaller organ bites: it knocks the victim, steals energy and mass, and sheds a scrap of carrion others can pile onto. Hits flash white. Adding or losing a thruster or sensor keeps the old weights. There is no generation clock: when someone starves (or is eaten down), a child of a living high-scorer is born nearby.
