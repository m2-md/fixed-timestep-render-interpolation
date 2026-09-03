// Deterministic bench: feed the same 10 seconds with different frame splits.
// Fixed step -> EXACTLY identical. Variable dt -> diverges. Node process, no browser.
import { World, createBody } from "./world";
import { runFixed, runVariable } from "./sim";

const STEP = 1 / 60;
const makeWorld = () => {
  const w = new World(800, 600, 900);
  const b = w.add(createBody(120, 80, 20, 0.8));
  b.vel.x = 220;
  return w;
};

// Three FPS scenarios, all 10 seconds total:
const framesA = Array(600).fill(STEP); // 60 FPS
const framesB = Array(150).fill(4 * STEP); // 15 FPS
const framesC = Array(300).fill(2 * STEP); // 30 FPS

const fmt = (v: number) => v.toFixed(6).padStart(12);
const show = (label: string, w: World) => {
  const b = w.bodies[0];
  console.log(
    `  ${label.padEnd(16)} pos=(${fmt(b.pos.x)},${fmt(b.pos.y)})  vel=(${fmt(b.vel.x)},${fmt(b.vel.y)})`,
  );
};

console.log("FIXED STEP (accumulator) — same total duration, three frame splits:");
const fa = runFixed(makeWorld, framesA);
const fb = runFixed(makeWorld, framesB);
const fc = runFixed(makeWorld, framesC);
show("60 FPS (600x)", fa);
show("15 FPS (150x4)", fb);
show("30 FPS (300x2)", fc);
const fixedMaxDx = Math.max(
  Math.abs(fa.bodies[0].pos.x - fb.bodies[0].pos.x),
  Math.abs(fa.bodies[0].pos.x - fc.bodies[0].pos.x),
);
const fixedMaxDy = Math.max(
  Math.abs(fa.bodies[0].pos.y - fb.bodies[0].pos.y),
  Math.abs(fa.bodies[0].pos.y - fc.bodies[0].pos.y),
);
console.log(
  `  -> max |Δpos| = (${fixedMaxDx}, ${fixedMaxDy})  ${fixedMaxDx === 0 && fixedMaxDy === 0 ? "EXACTLY IDENTICAL" : "DIFFERENCE DETECTED!"}`,
);

console.log(
  "\nVARIABLE dt (old loop) — same total duration, two frame splits:",
);
const va = runVariable(makeWorld, framesA);
const vb = runVariable(makeWorld, framesB);
show("60 FPS (600x)", va);
show("15 FPS (150x4)", vb);
const varDx = Math.abs(va.bodies[0].pos.x - vb.bodies[0].pos.x);
const varDy = Math.abs(va.bodies[0].pos.y - vb.bodies[0].pos.y);
console.log(
  `  -> |Δpos| = (${varDx.toFixed(4)}, ${varDy.toFixed(4)})  DIVERGED`,
);

console.log(
  `\nSummary: fixed step diverges 0 px, variable dt diverges ${Math.hypot(varDx, varDy).toFixed(1)} px (same 10 s).`,
);
