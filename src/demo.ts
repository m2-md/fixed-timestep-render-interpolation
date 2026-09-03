import { vec, lerp } from "./vec";
import { World, createBody } from "./world";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;

const world = new World(canvas.width, canvas.height, 900);
const ball = world.add(createBody(120, 80, 24, 0.85));
ball.vel = vec(220, 0); // initial sideways velocity

let STEP = 1 / 60; // "Physics Hz" slider changes this at runtime
const MAX_STEPS = 5;
const MAX_FRAME = 0.25;

let interpolate = true; // toggled by button
let slowMotion = false; // "simulate low FPS" — intentionally slows down frames
let acc = 0;
let last = performance.now();

function frame(now: number) {
  let frameTime = (now - last) / 1000;
  last = now;
  if (frameTime > MAX_FRAME) frameTime = MAX_FRAME;

  // To simulate low FPS, we use wall-clock time as is;
  // when slowMotion is active, we intentionally delay rendering to produce large frameTime.
  acc += frameTime;

  let steps = 0;
  while (acc >= STEP && steps < MAX_STEPS) {
    world.snapshot();
    world.step(STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === MAX_STEPS) acc = 0;

  const alpha = acc / STEP;
  render(alpha);
  updateHud(frameTime, steps);

  if (slowMotion) {
    // Simulate a heavy / long frame: delay the next frame.
    setTimeout(() => requestAnimationFrame(frame), 90);
  } else {
    requestAnimationFrame(frame);
  }
}

function render(alpha: number) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const b of world.bodies) {
    const p = interpolate ? lerp(b.prev, b.pos, alpha) : b.pos;
    ctx.beginPath();
    ctx.arc(p.x, p.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#e91e63";
    ctx.fill();
  }
}

// --- Controls: the three inputs in index.html drive the live demo ---
const interpEl = document.querySelector<HTMLInputElement>("#interp")!;
const slowEl = document.querySelector<HTMLInputElement>("#slow")!;
const hzEl = document.querySelector<HTMLInputElement>("#hz")!;
const hzOut = document.querySelector<HTMLSpanElement>("#hzval")!;
const hud = document.querySelector<HTMLSpanElement>("#hud")!;

interpEl.addEventListener("change", () => (interpolate = interpEl.checked));
slowEl.addEventListener("change", () => (slowMotion = slowEl.checked));
hzEl.addEventListener("input", () => {
  const hz = Number(hzEl.value);
  STEP = 1 / hz; // readjust metronome tick interval
  hzOut.textContent = String(hz);
});

let fps = 0;
function updateHud(frameTime: number, steps: number) {
  // Smooth FPS with a simple exponential moving average.
  fps += (1 / Math.max(frameTime, 1e-3) - fps) * 0.1;
  hud.textContent = `${fps.toFixed(0)} FPS • ${steps} ticks/frame`;
}

requestAnimationFrame(frame);
