import { BRAIN_INPUTS, MAX_NODES, NODE_KINDS, type NodeKind } from "../config";
import { Rng, uid } from "./rng";

export interface GeneNode {
  kind: NodeKind;
  radius: number;
  ox: number;
  oy: number;
  hueShift: number;
  thrustAngle: number;
}

export interface GeneEdge {
  a: number;
  b: number;
  rest: number;
  stiffness: number;
  damping: number;
}

export interface Genome {
  id: string;
  lineage: number;
  born: number;
  nodes: GeneNode[];
  edges: GeneEdge[];
  weights: number[];
  biases: number[];
}

export function thrusterCount(g: Genome): number {
  return g.nodes.reduce((n, node) => n + (node.kind === "thruster" ? 1 : 0), 0);
}

export function outputCount(g: Genome): number {
  return 1 + thrusterCount(g);
}

export function randomGenome(rng: Rng, generation: number): Genome {
  const n = rng.int(4, 7);
  const nodes: GeneNode[] = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const rad = rng.range(0.35, 1.15);
    nodes.push({
      kind: "body",
      radius: rng.range(0.18, 0.42),
      ox: Math.cos(ang) * rad,
      oy: Math.sin(ang) * rad,
      hueShift: rng.range(-0.08, 0.08),
      thrustAngle: rng.range(-Math.PI, Math.PI),
    });
  }

  nodes[0]!.kind = "mouth";
  nodes[1]!.kind = "thruster";
  nodes[2]!.kind = "sensor";
  if (n > 3 && rng.chance(0.6)) nodes[3]!.kind = "thruster";
  if (n > 4 && rng.chance(0.45)) nodes[4]!.kind = rng.pick(["storage", "sensor", "body"]);
  for (let i = 5; i < n; i++) {
    if (rng.chance(0.5)) nodes[i]!.kind = rng.pick(NODE_KINDS);
  }

  const edges = connectGraph(nodes, rng);
  const g: Genome = {
    id: uid(),
    lineage: rng.next(),
    born: generation,
    nodes,
    edges,
    weights: [],
    biases: [],
  };
  randomizeBrain(g, rng);
  return g;
}

function connectGraph(nodes: GeneNode[], rng: Rng): GeneEdge[] {
  const edges: GeneEdge[] = [];
  const used = new Set<string>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  const add = (a: number, b: number) => {
    if (a === b || used.has(key(a, b))) return;
    used.add(key(a, b));
    const dx = nodes[a]!.ox - nodes[b]!.ox;
    const dy = nodes[a]!.oy - nodes[b]!.oy;
    const rest = Math.hypot(dx, dy);
    edges.push({
      a,
      b,
      rest: Math.max(0.28, rest * rng.range(0.85, 1.15)),
      stiffness: rng.range(8, 22),
      damping: rng.range(0.6, 1.8),
    });
  };

  for (let i = 1; i < nodes.length; i++) {
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(nodes[i]!.ox - nodes[j]!.ox, nodes[i]!.oy - nodes[j]!.oy);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    add(i, best);
  }

  const extra = rng.int(1, Math.min(3, nodes.length));
  for (let k = 0; k < extra; k++) add(rng.int(0, nodes.length - 1), rng.int(0, nodes.length - 1));
  return edges;
}

export function randomizeBrain(g: Genome, rng: Rng): void {
  const outs = outputCount(g);
  g.weights = Array.from({ length: outs * BRAIN_INPUTS }, () => rng.range(-1.2, 1.2));
  g.biases = Array.from({ length: outs }, () => rng.range(-0.3, 0.3));
}

export function cloneGenome(g: Genome): Genome {
  return {
    id: uid(),
    lineage: g.lineage,
    born: g.born,
    nodes: g.nodes.map((n) => ({ ...n })),
    edges: g.edges.map((e) => ({ ...e })),
    weights: g.weights.slice(),
    biases: g.biases.slice(),
  };
}

export function mutateGenome(g: Genome, rng: Rng, rate: number): Genome {
  const child = cloneGenome(g);
  child.lineage = (child.lineage + rng.range(-0.03, 0.03) * rate * 4 + 1) % 1;

  if (rng.chance(rate * 0.35) && child.nodes.length < MAX_NODES) addNode(child, rng);
  if (rng.chance(rate * 0.28) && child.nodes.length > 4) removeNode(child, rng);

  for (const node of child.nodes) {
    if (rng.chance(rate)) node.radius = clamp(node.radius + rng.range(-0.08, 0.08), 0.14, 0.52);
    if (rng.chance(rate * 0.6)) {
      node.ox += rng.range(-0.18, 0.18);
      node.oy += rng.range(-0.18, 0.18);
    }
    if (rng.chance(rate * 0.5)) node.hueShift = clamp(node.hueShift + rng.range(-0.05, 0.05), -0.15, 0.15);
    if (rng.chance(rate * 0.45)) node.thrustAngle += rng.range(-0.5, 0.5);
    if (rng.chance(rate * 0.2)) node.kind = rng.pick(NODE_KINDS);
  }

  ensureRoles(child);

  for (const edge of child.edges) {
    if (rng.chance(rate)) edge.rest = clamp(edge.rest + rng.range(-0.12, 0.12), 0.22, 2.4);
    if (rng.chance(rate)) edge.stiffness = clamp(edge.stiffness + rng.range(-3, 3), 4, 28);
    if (rng.chance(rate)) edge.damping = clamp(edge.damping + rng.range(-0.3, 0.3), 0.2, 2.4);
  }

  const prevOut = child.biases.length;
  const nextOut = outputCount(child);
  if (prevOut !== nextOut) {
    randomizeBrain(child, rng);
  } else {
    for (let i = 0; i < child.weights.length; i++) {
      if (rng.chance(rate * 1.4)) child.weights[i] = clamp(child.weights[i]! + rng.range(-0.35, 0.35), -2.4, 2.4);
    }
    for (let i = 0; i < child.biases.length; i++) {
      if (rng.chance(rate)) child.biases[i] = clamp(child.biases[i]! + rng.range(-0.15, 0.15), -1, 1);
    }
  }

  return child;
}

function addNode(g: Genome, rng: Rng): void {
  const parent = rng.int(0, g.nodes.length - 1);
  const ang = rng.range(0, Math.PI * 2);
  const d = rng.range(0.35, 0.9);
  g.nodes.push({
    kind: rng.pick(["body", "thruster", "sensor", "storage"]),
    radius: rng.range(0.16, 0.34),
    ox: g.nodes[parent]!.ox + Math.cos(ang) * d,
    oy: g.nodes[parent]!.oy + Math.sin(ang) * d,
    hueShift: rng.range(-0.08, 0.08),
    thrustAngle: rng.range(-Math.PI, Math.PI),
  });
  const b = g.nodes.length - 1;
  g.edges.push({
    a: parent,
    b,
    rest: d,
    stiffness: rng.range(8, 20),
    damping: rng.range(0.6, 1.6),
  });
}

function removeNode(g: Genome, rng: Rng): void {
  const idx = rng.int(0, g.nodes.length - 1);
  g.nodes.splice(idx, 1);
  g.edges = g.edges
    .filter((e) => e.a !== idx && e.b !== idx)
    .map((e) => ({
      ...e,
      a: e.a > idx ? e.a - 1 : e.a,
      b: e.b > idx ? e.b - 1 : e.b,
    }));
  ensureRoles(g);
}

function ensureRoles(g: Genome): void {
  if (!g.nodes.some((n) => n.kind === "mouth")) g.nodes[0]!.kind = "mouth";
  if (!g.nodes.some((n) => n.kind === "thruster")) g.nodes[Math.min(1, g.nodes.length - 1)]!.kind = "thruster";
  if (!g.nodes.some((n) => n.kind === "sensor") && g.nodes.length > 2) g.nodes[2]!.kind = "sensor";
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
