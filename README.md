# Metronomlu Fizik — Sabit Adım + Render Enterpolasyonu

"Metronomlu Fizik: TypeScript'te Sabit Adımlı Oyun Döngüsü ve Render
Enterpolasyonu" makalesinin çalışan kodu. Değişken-dt'li fizik döngüsünü, her
makinede birebir aynı sonucu veren **sabit adımlı** (fixed timestep) deterministik
bir döngüye yükseltir ve çizimi fizikten ayırıp iki tık arasını **enterpole** eder.

İçindekiler:

1. **Mini fizik motoru** (`src/world.ts`) — semi-implicit Euler + duvar sekmesi.
   `Body`'ye enterpolasyon için `prev` alanı, `World`'e adımdan önce çağrılan
   `snapshot()` eklenmiştir.
2. **Accumulator döngüsü** (`src/sim.ts`) — gerçek zamanı biriktirip sabit `STEP`
   dilimleriyle adımlar; ölüm sarmalı koruması (`maxFrame` kırpma + `maxSteps`
   tavanı + borç silme) ve `alpha = acc / STEP` enterpolasyon oranı.
3. **Canlı demo** (`src/demo.ts` + `index.html`) — zıplayan top, enterpolasyon
   aç/kapa, "düşük FPS simüle et" ve "Fizik Hz" kaydırıcısı, canlı FPS/tık sayacı.
4. **Determinizm kanıtı** (`test/sim.test.ts`) — aynı toplam zaman, farklı kare
   bölünmeleri → sabit adım birebir aynı, değişken-dt ıraksar.

## Kurulum

```bash
npm install
```

## Çalıştırma

```bash
npm run dev
```

`http://localhost:5173/` adresinde demo açılır. Tarayıcıda tek başına çalışır;
arka planda ayrı bir Node sunucu süreci gerekmez (Vite dev sunucusu yeterli).

**Ne deneyin:** "Fizik Hz" kaydırıcısını 4'e çekin. Enterpolasyon **kapalıyken**
top saniyede 4 kez ışınlanır (jitter görünür); **açtığınız an** aynı 4 tık'ın arası
60 FPS'le doldurulur, top kayarcasına akar. Fizik ikisinde de birebir aynı; değişen
tek şey gözünüzün gördüğü. "Düşük FPS simüle et" ile büyük `frameTime` üretip
accumulator'ın her karede birden çok tık boşaltmasını gözleyin.

## Test

```bash
npm test
```

Beklenen: 5 test geçer.

- **Determinizm (3 assert):** aynı 10 saniye 60/15/30 FPS'e bölünür; sabit-adım
  durumu (`pos`, `vel`) üçünde de `toEqual` — bit özdeş.
- **Divergence:** aynı 0.8 saniyelik serbest düşüş değişken-dt ile farklı `dt`'lere
  bölününce `not.toEqual` — semi-implicit Euler'in `dt`'ye bağımlılığı.
- **Enterpolasyon matematiği (3 test):** `lerp` için `t=0`, `t=1`, `t=0.5`.

## Bench

```bash
npm run bench
```

Deterministik ölçüm (tarayıcı yok, `vite-node`): aynı 10 saniyeyi üç FPS
senaryosuyla besler. Örnek çıktı:

```
SABİT ADIM (accumulator) — aynı toplam süre, üç kare bölünmesi:
  60 FPS (600x)    pos=(  393.120000,  580.000000)  vel=(  140.800000,   -6.666667)
  15 FPS (150x4)   pos=(  393.120000,  580.000000)  vel=(  140.800000,   -6.666667)
  30 FPS (300x2)   pos=(  393.120000,  580.000000)  vel=(  140.800000,   -6.666667)
  -> max |Δpos| = (0, 0)  BİREBİR AYNI

DEĞİŞKEN dt (eski döngü) — aynı toplam süre, iki kare bölünmesi:
  60 FPS (600x)    pos=(  393.120000,  580.000000)  vel=(  140.800000,   -6.666667)
  15 FPS (150x4)   pos=(  386.080000,  580.000000)  vel=(  140.800000,  -26.666387)
  -> |Δpos| = (7.0400, 0.0000)  IRAKSADI

Özet: sabit adım 0 px ıraksar, değişken dt 7.0 px ıraksar (aynı 10 sn).
```

## Build

```bash
npm run build
```

`tsc` (tip kontrolü, `noEmit`) + `vite build` (üretim derlemesi). İkisi de hatasız
geçmeli.

## Dosya yapısı

```
src/
  vec.ts        # Vec2 + vec/add/scale + lerp (enterpolasyon)
  world.ts      # Body (prev), createBody, World.snapshot/step/collideWalls
  sim.ts        # Accumulator (EPS'li), runFixed, runVariable
  demo.ts       # Tarayıcı demosu: rAF döngüsü + kontroller + HUD
  bench-cli.ts  # Deterministik bench (vite-node)
test/
  sim.test.ts   # Determinizm + divergence + lerp testleri
index.html      # Canvas + kontroller
```

## Lisans

MIT
