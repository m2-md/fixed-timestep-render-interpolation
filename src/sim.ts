import { World } from "./world";

export interface StepperOpts {
  step?: number; // fixed physics step (seconds)
  maxSteps?: number; // max ticks per frame — spiral of death protection
  maxFrame?: number; // upper bound of a single frame (seconds)
}

const EPS = 1e-9; // floating-point tolerance: avoid missing a tick at the acc == step boundary

export class Accumulator {
  acc = 0;
  readonly step: number;
  readonly maxSteps: number;
  readonly maxFrame: number;

  constructor(opts: StepperOpts = {}) {
    this.step = opts.step ?? 1 / 60;
    this.maxSteps = opts.maxSteps ?? 5;
    this.maxFrame = opts.maxFrame ?? 0.25;
  }

  advance(world: World, frameTime: number): { steps: number; alpha: number } {
    if (frameTime > this.maxFrame) frameTime = this.maxFrame;
    this.acc += frameTime;

    let steps = 0;
    while (this.acc >= this.step - EPS && steps < this.maxSteps) {
      world.snapshot();
      world.step(this.step);
      this.acc -= this.step;
      steps++;
    }
    if (steps === this.maxSteps && this.acc >= this.step - EPS) this.acc = 0;

    return { steps, alpha: this.acc / this.step };
  }
}

export function runFixed(
  makeWorld: () => World,
  frames: number[],
  opts?: StepperOpts,
): World {
  const world = makeWorld();
  const acc = new Accumulator(opts);
  for (const ft of frames) acc.advance(world, ft);
  return world;
}

// Old approach in the series — for comparison: direct step with variable dt.
export function runVariable(
  makeWorld: () => World,
  frames: number[],
  maxFrame = 1,
): World {
  const world = makeWorld();
  for (const ft of frames) world.step(Math.min(ft, maxFrame));
  return world;
}
