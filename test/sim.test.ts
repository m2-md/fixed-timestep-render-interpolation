import { describe, it, expect } from "vitest";
import { World, createBody } from "../src/world";
import { runFixed, runVariable } from "../src/sim";
import { lerp, vec } from "../src/vec";

const STEP = 1 / 60;
const makeWorld = () => {
  const w = new World(800, 600, 900);
  w.add(createBody(120, 80, 20, 0.8));
  return w;
};

describe("fixed-timestep loop is deterministic", () => {
  // Same 10-second total time, three different frame splits:
  const framesA = Array(600).fill(STEP); // 60 FPS
  const framesB = Array(150).fill(4 * STEP); // 15 FPS (4 ticks per frame)
  const framesC = Array(300).fill(2 * STEP); // 30 FPS (2 ticks per frame)

  it("produces EXACTLY the same state regardless of frame timing", () => {
    const a = runFixed(makeWorld, framesA).bodies[0];
    const b = runFixed(makeWorld, framesB).bodies[0];
    const c = runFixed(makeWorld, framesC).bodies[0];

    expect(a.pos).toEqual(b.pos);
    expect(a.pos).toEqual(c.pos);
    expect(a.vel).toEqual(b.vel);
  });

  it("variable-dt version diverges (no determinism)", () => {
    // Before the first wall contact, compare in free fall: semi-implicit
    // Euler's g·dt² term yields different positions depending on dt (without settling).
    const freeA = Array(48).fill(STEP); // 0.8 s, 60 FPS
    const freeB = Array(12).fill(4 * STEP); // 0.8 s, 15 FPS
    const a = runVariable(makeWorld, freeA).bodies[0];
    const b = runVariable(makeWorld, freeB).bodies[0];

    expect(a.pos).not.toEqual(b.pos); // same total duration, different result
  });
});

describe("interpolation math", () => {
  const a = vec(0, 0);
  const b = vec(10, 20);

  it("alpha=0 yields the previous state", () =>
    expect(lerp(a, b, 0)).toEqual(vec(0, 0)));
  it("alpha=1 yields the current state", () =>
    expect(lerp(a, b, 1)).toEqual(vec(10, 20)));
  it("alpha=0.5 yields the exact midpoint", () =>
    expect(lerp(a, b, 0.5)).toEqual(vec(5, 10)));
});
