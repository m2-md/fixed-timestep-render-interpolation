import { vec, lerp } from "./vec";
import { World, createBody } from "./world";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;

const world = new World(canvas.width, canvas.height, 900);
const ball = world.add(createBody(120, 80, 24, 0.85));
ball.vel = vec(220, 0); // yana doğru bir başlangıç hızı

let STEP = 1 / 60; // "Fizik Hz" kaydırıcısı çalışma anında değiştirir
const MAX_STEPS = 5;
const MAX_FRAME = 0.25;

let interpolate = true; // düğmeyle değişir
let slowMotion = false; // "düşük FPS simüle et" — kareyi bilerek yavaşlatır
let acc = 0;
let last = performance.now();

function frame(now: number) {
  let frameTime = (now - last) / 1000;
  last = now;
  if (frameTime > MAX_FRAME) frameTime = MAX_FRAME;

  // Düşük FPS'i simüle etmek için gerçek zamanı olduğu gibi kullanırız;
  // slowMotion açıkken render'ı kasıtlı geciktirerek büyük frameTime üretiriz.
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
    // Ağır bir kare / uzun kareyi taklit et: bir sonraki frame'i geciktir.
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

// --- Kontroller: index.html'deki üç giriş demoyu canlı sürer ---
const interpEl = document.querySelector<HTMLInputElement>("#interp")!;
const slowEl = document.querySelector<HTMLInputElement>("#slow")!;
const hzEl = document.querySelector<HTMLInputElement>("#hz")!;
const hzOut = document.querySelector<HTMLSpanElement>("#hzval")!;
const hud = document.querySelector<HTMLSpanElement>("#hud")!;

interpEl.addEventListener("change", () => (interpolate = interpEl.checked));
slowEl.addEventListener("change", () => (slowMotion = slowEl.checked));
hzEl.addEventListener("input", () => {
  const hz = Number(hzEl.value);
  STEP = 1 / hz; // metronomun tık aralığını yeniden ayarla
  hzOut.textContent = String(hz);
});

let fps = 0;
function updateHud(frameTime: number, steps: number) {
  // Basit üstel ortalama ile FPS'i yumuşat.
  fps += (1 / Math.max(frameTime, 1e-3) - fps) * 0.1;
  hud.textContent = `${fps.toFixed(0)} FPS • ${steps} tık/kare`;
}

requestAnimationFrame(frame);
