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

describe("sabit adımlı döngü deterministiktir", () => {
  // Aynı 10 saniyelik toplam zaman, üç farklı kare bölünmesi:
  const framesA = Array(600).fill(STEP); // 60 FPS
  const framesB = Array(150).fill(4 * STEP); // 15 FPS (kare başına 4 tık)
  const framesC = Array(300).fill(2 * STEP); // 30 FPS (kare başına 2 tık)

  it("kare zamanlamasından bağımsız BİREBİR aynı durum verir", () => {
    const a = runFixed(makeWorld, framesA).bodies[0];
    const b = runFixed(makeWorld, framesB).bodies[0];
    const c = runFixed(makeWorld, framesC).bodies[0];

    expect(a.pos).toEqual(b.pos);
    expect(a.pos).toEqual(c.pos);
    expect(a.vel).toEqual(b.vel);
  });

  it("değişken-dt sürüm ise ıraksar (determinizm yok)", () => {
    // İlk duvar temasından ÖNCE, serbest düşüşte karşılaştır: semi-implicit
    // Euler'in g·dt² terimi dt'ye göre farklı konum verir (settle olmadan).
    const freeA = Array(48).fill(STEP); // 0.8 sn, 60 FPS
    const freeB = Array(12).fill(4 * STEP); // 0.8 sn, 15 FPS
    const a = runVariable(makeWorld, freeA).bodies[0];
    const b = runVariable(makeWorld, freeB).bodies[0];

    expect(a.pos).not.toEqual(b.pos); // aynı toplam süre, farklı sonuç
  });
});

describe("enterpolasyon matematiği", () => {
  const a = vec(0, 0);
  const b = vec(10, 20);

  it("alpha=0 önceki durumu verir", () =>
    expect(lerp(a, b, 0)).toEqual(vec(0, 0)));
  it("alpha=1 şimdiki durumu verir", () =>
    expect(lerp(a, b, 1)).toEqual(vec(10, 20)));
  it("alpha=0.5 tam ortayı verir", () =>
    expect(lerp(a, b, 0.5)).toEqual(vec(5, 10)));
});
