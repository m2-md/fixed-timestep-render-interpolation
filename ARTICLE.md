# Metronomlu Fizik: TypeScript'te Sabit Adımlı Oyun Döngüsü ve Render Enterpolasyonu

*Serideki değişken-dt döngüsünü sabit adımlı (fixed timestep), deterministik bir fizik motoruna yükseltiyoruz — fizik her makinede birebir aynı, çizim yine ekran hızında ve pürüzsüz.*

*Tahmini okuma süresi: 13 dakika*

---

Geçen hafta aynı oyunu iki bilgisayarda açtım. Masaüstümde 144 Hz'lik bir monitör var, eski laptopumsa iyi günlerinde 40 FPS zor görüyor. Topu aynı yerden, aynı açıyla fırlattım. İki makinede iki farklı yere düştü.

Bir oyunda bu, kabus demektir.

Çünkü fizik simülasyonunun sonucunun ekranın yenileme hızına bağlı olmaması gerekir. Oyuncunun 60 FPS mi 30 FPS mi gördüğü, topun nereye düşeceğini değiştirmemeli. Ama serideki fizik motorumuzda tam olarak bunu yapıyorduk. Sıfırdan yazdığımız o motorun kalbinde şu döngü atıyordu:

```ts
// canvas-physics-from-scratch projesinden hatırlatma — ESKİ, değişken-dt döngü.
// Bu kod bu yazının projesinde YOK; karşı örnek olarak duruyor.
const dt = Math.min((now - last) / 1000, 1 / 30); // kareler arası süre
last = now;

world.step(dt); // fiziği "geçen kadar" ilerlet
draw();
```

O yazıda `dt`'yi (delta time, kareler arası süre) `Math.min` ile sınırlamıştık ki sekme değiştirip dönünce top duvarın içinden ışınlanmasın. Küçük bir yara bandıydı. Bu yazıda o yara bandını söküp yaranın kendisini kapatıyoruz: fiziği **sabit adımlı** (fixed timestep) hale getirip, çizimi ondan tamamen ayıracağız. Sonunda elimizde her makinede birebir aynı davranan, ama yine de saniyede 144 kare çizebilen bir döngü olacak.

Bunu bir metronomla anlatacağım — çünkü bütün yazı tek bir fikrin etrafında dönüyor. Değişken-dt'li fizik, ruh haline göre tempo tutan bir davulcu gibidir: heyecanlanınca (hızlı makine) hızlanır, yorulunca (yavaş makine) sürükler. Aynı şarkı her seferinde başka çıkar. Biz bu davulcunun eline bir metronom vereceğiz. Metronom saniyede tam 60 kez tıklar — makine ne olursa olsun. Çizim ise metronomdan bağımsız, dansçı gibi kendi hızında akar. İşin bütün inceliği, bu ikisini ayırıp sonra zarifçe birbirine bağlamakta.

### Değişken-dt Tuzağı

Önce derdi tam olarak görelim, çünkü "her makinede farklı oynuyor" cümlesi kulağa muğlak geliyor ama altında sert bir matematik var.

Fizik motorumuz **semi-implicit Euler** (yarı-örtük Euler) entegrasyonu kullanıyordu. İki satır:

```ts
b.vel = add(b.vel, scale(this.gravity, dt)); // hız  += yerçekimi × dt
b.pos = add(b.pos, scale(b.vel, dt));        // konum += (yeni) hız × dt
```

Buradaki sinsilik şu: konum güncellemesi, o karede yeni hesaplanan hızı kullanıyor. Bu, yöntemi kararlı yapan güzel bir detay — ama aynı zamanda `dt`'ye karşı **doğrusal olmayan** (nonlinear) bir davranış demek. Bir `dt`'lik adımı ikiye bölüp iki kez `dt/2` ile adımlarsanız, tek `dt`'lik adımdan farklı bir sonuç alırsınız.

Elle bir bakalım. Tek adım, süre `dt`:

```
v₁ = v₀ + g·dt
x₁ = x₀ + v₁·dt = x₀ + v₀·dt + g·dt²
```

Aynı süreyi iki `dt/2` adımına bölelim:

```
x₂ = x₀ + v₀·dt + (3/4)·g·dt²
```

`g·dt²` ile `(3/4)·g·dt²`. Aynı fiziksel süre, iki farklı sonuç. Sırf zamanı farklı böldüğümüz için.

İşte 144 Hz monitörümle 40 FPS laptopumun neden ayrıştığı bu. Hızlı makine küçük `dt`'lerle çok kez adımlıyor, yavaş makine büyük `dt`'lerle az kez. Toplam süre aynı olsa bile varış noktası farklı. Bir de üstüne `Math.min(dt, 1/30)` sınırını koyunca: yavaş makinede fizik resmen zamanda geri kalıyor — kare 40 ms sürdü ama fiziğe sadece 33 ms anlattık, 7 ms buharlaştı.

Bir de tünelleme (tunneling) var. `dt` büyürse `konum += hız × dt` topu tek karede kocaman bir sıçratır. Yeterince hızlı bir cisim, ince bir duvarın bir yanından öbür yanına, arayı hiç görmeden atlar — çarpışma testi duvarı ıskalar. Düşük FPS'te bu sık yaşanır. Yara bandımızın (o `Math.min`) tek işi buydu: sıçramayı küçük tutmak. Derdi çözmüyordu, sadık kalırsam saklıyordu.

Peki metronomu nasıl kurarız?

### Metronomu Kurmak: Sabit Adımlı Accumulator

Fikir şaşırtıcı derecede basit. Fiziğe asla "geçen süre kadar ilerle" demeyeceğiz. Hep aynı, sabit bir dilimle ilerleteceğiz: `STEP = 1/60` saniye. Metronomun tık aralığı.

Ama gerçek zaman sabit değil ki. Bir kare 16 ms sürer, ötekisi 22 ms, sonra sekme değişir 400 ms. Bu düzensiz gerçek zamanı, sabit tıklara nasıl çeviririz?

Bir kumbarayla. Buna **accumulator** (biriktirici) deniyor. Her karede geçen gerçek zamanı kumbaraya atarız. İçinde bir tam `STEP` birikmişse, bir tık harcarız. İki `STEP` birikmişse iki tık. Kumbarada `STEP`'ten az kaldıysa, o artığı bir sonraki kareye taşırız — harcamayız.

```ts
// Metronomun İLK hali — ölüm sarmalı koruması henüz yok, snapshot da yok.
// Öğretim basamağı: repoda bu sürüm yok, nihai kod src/sim.ts + src/demo.ts.
const STEP = 1 / 60; // metronomun tık aralığı — fizik saniyede 60 kez ilerler
let acc = 0;         // kumbara: harcanmayı bekleyen gerçek zaman
let last = performance.now();

function frame(now: number) {
  const frameTime = (now - last) / 1000; // bu kare kaç saniye sürdü
  last = now;

  acc += frameTime; // gerçek zamanı kumbaraya at

  while (acc >= STEP) {
    world.step(STEP); // her tık TAM olarak aynı büyüklükte
    acc -= STEP;
  }

  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

Dikkat edin: `world.step`'e artık `frameTime` gitmiyor, hep `STEP` gidiyor. Fizik, kaç kez çağrıldığını umursar ama her çağrıda aynı sabit dilimle çalışır. Hızlı makine bir karede belki tek tık atar, yavaş makine üç tık — ama attıkları tıkların her biri birebir aynı `step(STEP)` hesabıdır. On saniyelik bir simülasyon, iki makinede de tam 600 tık eder. Sıra aynı, dilim aynı, sonuç aynı.

Bir önceki bölümdeki `dt/2` sorunu buharlaştı: artık `dt/2` diye bir şey yok. Sadece `STEP` var, hep `STEP`.

`requestAnimationFrame`'in burada ne yaptığını hatırlatayım — daha önce event loop üzerine yazarken değinmiştim: tarayıcı bir sonraki kareyi boyamadan hemen önce bizim `frame`'imizi çağırır, `now`'a da yüksek çözünürlüklü zaman damgasını verir. Yani gerçek zamanı bize tarayıcı sayıyor; bizim işimiz onu doğru bölmek.

### Ölüm Sarmalı ve Onu Kırpmak

Yukarıdaki `while` döngüsüne uzun uzun bakın. İçinde bir bomba var.

Ya bir kare çok uzun sürerse? Kullanıcı sekmeyi değiştirdi, dizüstü uykuya daldı, ya da tarayıcı bir an takıldı. `frameTime` birden 3 saniye geldi diyelim. Kumbaraya 3 saniye attık; `while` döngüsü bunu boşaltmak için 180 tık atmak zorunda. Ama 180 tık atmak da zaman alır — diyelim 50 ms. O 50 ms boyunca yeni gerçek zaman biriktiği için, döngü bitmeden kumbaraya yenisi doluyor. Döngü asla kapanamaz, sayfa donar, fan öter.

Buna **spiral of death** (ölüm sarmalı) deniyor: metronom senden ödeyemeyeceğin kadar çok tık talep eder, sen yetişmeye çalıştıkça borç büyür, büyüdükçe daha çok yetişmen gerekir. Klasik bir sonsuz düşüş.

Çözüm iki kademeli. Önce dev tek sıçramaları en baştan kırpıyoruz — bu, fizik yazısındaki `Math.min` refleksinin doğru yeri. Sonra da kare başına atılacak tık sayısına bir tavan koyuyoruz. Tavana dayandıysak, ödeyemediğimiz borcu **silme** kararı alıyoruz: oyun bir an ağır çeker (slow-motion), ama donmaz.

```ts
// İkinci basamak: kırpma + tık tavanı eklendi, snapshot hâlâ yok.
// Tam hali src/demo.ts'te (STEP orada `let`, çünkü kaydırıcı değiştiriyor).
const STEP = 1 / 60;
const MAX_STEPS = 5;    // kare başına en fazla 5 tık
const MAX_FRAME = 0.25; // tek kareyi 250 ms'de sınırla

let acc = 0;
let last = performance.now();

function frame(now: number) {
  let frameTime = (now - last) / 1000;
  last = now;

  if (frameTime > MAX_FRAME) frameTime = MAX_FRAME; // 1) dev sıçramayı kırp
  acc += frameTime;

  let steps = 0;
  while (acc >= STEP && steps < MAX_STEPS) {         // 2) tık tavanı
    world.step(STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === MAX_STEPS) acc = 0; // 3) tavana dayandıysak borcu sil, sarmalı kır

  draw();
  requestAnimationFrame(frame);
}
```

`if (steps === MAX_STEPS) acc = 0` satırı bilinçli bir teslimiyet. Diyor ki: "Bu makine gerçek zamanı yakalayamıyor; yakalamaya çalışıp donmaktansa, kaybettiğim zamanı unutayım." Sonuç, düşük FPS'te oyunun bir kısır döngüye girmek yerine hafifçe yavaşlaması. Kötü bir seçenekler arasından en iyisi.

Bu üç satırın hangi değerlerle ayarlanacağı biraz da oyununuza bağlı. `MAX_STEPS = 5`, 60 Hz fizikte kareye 83 ms'lik bir catch-up bütçesi demek — çoğu oyun için bol. Çok ağır fizikte 3'e çekebilir, çok hafifte 10 yapabilirsiniz. Sihirli sayı yok; ölçüp karar veriyorsunuz.

### Update ile Render'ı Ayırmak

Şu ana kadar metronomu düzgün çalıştırdık. Ama bir sorun var ve gözle görünür.

Fizik saniyede 60 kez ilerliyor. Ekranınız 144 Hz ise, saniyede 144 kez çiziyorsunuz — ama fizik o kadar sık güncellenmiyor. Bazı karelerde `while` döngüsü hiç tık atmaz (kumbarada henüz `STEP` dolmamıştır). O karede topu tam olarak bir önceki tıktaki yerinde çizersiniz. Sonraki karede yine aynı yerde. Sonra birden bir tık atılır, top zıplar. Çiz-çiz-**zıpla**, çiz-çiz-**zıpla**.

Buna **temporal aliasing** (zamansal örtüşme) deniyor; gözünüz bunu mikro-takılma (micro-stutter) olarak görür. İşin cilvesi şu: fiziği düzgün, deterministik yaptık ama görüntü daha kötü titriyor. Çünkü çizim, fiziğin ayrık tıklarına hapsoldu.

Çözümün kilit cümlesi şu: **update sabit hızda, render ekran hızında — ve render, iki fizik tık'ı arasını tahmin eder.** Fizik metronoma göre yürür, çizim dansçı gibi akıcı hareket eder; dansçının ara pozlarını biz uyduracağız.

Bunun için tek ihtiyacımız, kumbarada kalan artık. Döngü bittiğinde `acc` içinde `STEP`'ten az bir zaman kalır — bir sonraki tıka "ne kadar yaklaştığımız". Bunu orana çevirelim:

```ts
const alpha = acc / STEP; // 0..1 arası: son tık ile bir sonraki tık arasındaki oran
```

`alpha = 0` demek "tam bir tık üzerindeyiz". `alpha = 0.5` demek "iki tık arasının tam ortasındayız". Bu tek sayı, pürüzsüzlüğün anahtarı.

### Render Enterpolasyonu: İki Tik Arasını Çizmek

`alpha`'yı elde ettik. Şimdi onu kullanmak için bir şeye daha ihtiyacımız var: her cismin hem **şimdiki** (curr) hem de **bir önceki tık'taki** (prev) konumu. İkisi arasında `alpha` kadar enterpolasyon yapıp topu tam oraya çizeceğiz.

Bunun için motora küçük bir dokunuş: her tık'tan hemen önce, mevcut konumu `prev`'e kopyala.

```ts
// src/world.ts — dosyada ayrıca bir `createBody` yardımcısı var (prev = pos ile başlar)
export interface Body {
  pos: Vec2; // şimdiki (curr) konum
  prev: Vec2; // bir önceki tık'taki konum — enterpolasyon için
  vel: Vec2;
  radius: number;
  bounciness: number;
}

export class World {
  bodies: Body[] = [];
  gravity: Vec2;

  constructor(public width: number, public height: number, gravityY = 900) {
    this.gravity = vec(0, gravityY);
  }

  add(b: Body): Body {
    this.bodies.push(b);
    return b;
  }

  // Adımdan ÖNCE çağrılır: prev = curr. Enterpolasyonun "geçmiş" ucu.
  snapshot() {
    for (const b of this.bodies) {
      b.prev.x = b.pos.x;
      b.prev.y = b.pos.y;
    }
  }

  // Tek SABİT adım — dt her çağrıda aynı (STEP) gelir.
  step(dt: number) {
    for (const b of this.bodies) {
      b.vel = add(b.vel, scale(this.gravity, dt)); // semi-implicit Euler
      b.pos = add(b.pos, scale(b.vel, dt));
      this.collideWalls(b);
    }
  }

  private collideWalls(b: Body) {
    if (b.pos.x - b.radius < 0) {
      b.pos.x = b.radius;
      b.vel.x = -b.vel.x * b.bounciness;
    }
    if (b.pos.x + b.radius > this.width) {
      b.pos.x = this.width - b.radius;
      b.vel.x = -b.vel.x * b.bounciness;
    }
    if (b.pos.y - b.radius < 0) {
      b.pos.y = b.radius;
      b.vel.y = -b.vel.y * b.bounciness;
    }
    if (b.pos.y + b.radius > this.height) {
      b.pos.y = this.height - b.radius;
      b.vel.y = -b.vel.y * b.bounciness;
    }
  }
}
```

Fark ettiyseniz `step` neredeyse aynı — fizik yazısından kopyaladık, tek eklediğimiz `snapshot` ve `prev` alanı. Motorun fizik matematiğine dokunmadık; sadece "çizime yardım eden bir hafıza" verdik.

Şimdi döngüyü `snapshot` ile tamamlayalım. Her tık'tan hemen önce `prev`'i tazeliyoruz:

```ts
// src/demo.ts — döngünün nihai gövdesi (yorumlar makale için eklendi)
while (acc >= STEP && steps < MAX_STEPS) {
  world.snapshot();      // prev = curr  (adımdan ÖNCE)
  world.step(STEP);      // curr = curr + STEP kadar ilerle
  acc -= STEP;
  steps++;
}
```

Döngü bitince `prev` son tık'ın başındaki konumu, `pos` da sonundaki konumu tutuyor. `alpha` da ikisi arasında neredeyiz. Geriye tek şey kaldı: çizimde `pos`'u değil, `prev` ile `pos` arasında `alpha` kadar enterpolasyonu çizmek.

Enterpolasyon için minik bir yardımcı — vektör kütüphanemize `lerp` (linear interpolation, doğrusal enterpolasyon) ekliyoruz:

```ts
// İki nokta arasında t oranında (0..1) düz enterpolasyon.
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 =>
  vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
```

Ve çizim, enterpolasyonu açıp kapatabildiğimiz haliyle:

```ts
// src/demo.ts — render()'ın özü (renk atama aşağıdaki tam blokta)
function render(alpha: number) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const b of world.bodies) {
    // KAPALI: doğrudan pos → top fizik tık'larına hapsolur, titrer (jitter)
    // AÇIK:  prev ile pos arasında alpha kadar → iki tık arası pürüzsüz
    const p = interpolate ? lerp(b.prev, b.pos, alpha) : b.pos;

    ctx.beginPath();
    ctx.arc(p.x, p.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

Burada bir tereddüdümü paylaşayım, çünkü ilk yazdığımda kafam karışmıştı. Enterpolasyon, geleceği tahmin etmez — geçmişi çizer. `prev` ile `pos` arasını gösterdiğimiz için, ekrandaki top en son hesaplanmış fizik durumunun **bir tık gerisindedir**. Yani `alpha` bize bir tık'lık (≈16 ms) gecikme ekler. Kulağa kötü geliyor ama gözle fark edilmez ve karşılığında kusursuz pürüzsüzlük alırsınız. Alternatif, geleceği extrapolate etmek (dışdeğerleme): çarpışma anlarında topu duvarın içine tahmin edip geri zıplatır, ki bu çok daha çirkin. Çoğu oyun enterpolasyonu seçer. Ben de.

Bu farkı gerçekten *görmek* için demoyu açın. İçinde bir "fizik Hz" kaydırıcısı var: fiziği bilerek saniyede 4 tık'a düşürün. Enterpolasyon kapalıyken top saniyede 4 kez ışınlanır — kaba, kırık kırık. Açtığınız an, aynı 4 tık'ın arasını 60 FPS'le doldurur, top kayarcasına akar. Fizik ikisinde de birebir aynı; değişen tek şey, gözünüzün gördüğü.

### Canvas'a Bağlamak

Parçaları tek bir çalışan döngüde birleştirelim. Bu, demonun kalbi — bir zıplayan top, bir de "düşük FPS simüle et" ve "enterpolasyon aç/kapa" düğmeleri:

```ts
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
```

Geriye üç kontrolü bağlamak kaldı: enterpolasyon aç/kapa, düşük FPS simülasyonu ve "Fizik Hz" kaydırıcısı. Kaydırıcı `STEP`'i çalışma anında değiştirir — makalenin görsel iddiasının kanıtı bu. Bir de köşeye canlı FPS + tık/kare sayacı:

```ts
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
```

`slowMotion` numarası basit ama etkili: `setTimeout(..., 90)` ile bir sonraki kareyi bilerek geciktiririz, `frameTime` şişer, fizik kumbarası her karede birkaç tık birden boşaltmak zorunda kalır. Tam da düşük FPS'te olan şey. Bu modda enterpolasyon kapalıyken jitter'ın nasıl belirginleştiğini, açıkken nasıl yumuşadığını canlı görürsünüz.

Vite ile tek sayfa proje olarak çalışır; `npm run dev` deyip tarayıcıda açmanız yeterli, arka planda bir Node sunucu süreci gerekmez.

### Determinizmi Test Etmek

Şimdi en başta verdiğimiz sözü kanıtlayalım: aynı girdi, kare zamanlamasından bağımsız, birebir aynı durum.

Bunu tarayıcıda test edemeyiz — `requestAnimationFrame` ve gerçek zaman deterministik değil. Bu yüzden döngünün mantığını, rAF'tan arınmış saf bir fonksiyona çıkarıyoruz. Accumulator'a bir dizi "kare süresi" veriyoruz, o da fiziği ilerletip son durumu döndürüyor. Testte de aynı toplam zamanı **farklı kare parçalarına** bölüp besliyoruz:

```ts
import { World } from "./world";

export interface StepperOpts {
  step?: number; // sabit fizik adımı (saniye)
  maxSteps?: number; // kare başına en fazla tık — ölüm sarmalı koruması
  maxFrame?: number; // tek karenin üst sınırı (saniye)
}

const EPS = 1e-9; // kayan nokta payı: acc == step sınırında tık'ı kaçırmamak için

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

// Serideki ESKİ yaklaşım — karşılaştırma için: değişken dt ile doğrudan adımla.
export function runVariable(
  makeWorld: () => World,
  frames: number[],
  maxFrame = 1,
): World {
  const world = makeWorld();
  for (const ft of frames) world.step(Math.min(ft, maxFrame));
  return world;
}
```

O `EPS` satırı, gece yarısı beni bir saat uğraştıran bir hatanın kalıntısı. `acc += 4*STEP` yapıp `STEP`'i dört kez çıkarınca, kayan nokta hatası yüzünden `acc` bazen `STEP`'in kıl payı altında kalıyor ve döngü bir tık'ı kaçırıyordu — 600 tık yerine 599. Bu da testi kırdı. Çözüm, karşılaştırmaya minicik bir tolerans (`- EPS`) eklemek. Küçük bir ayrıntı; ama bu ayrıntıyı bilmezseniz "neden bazen bir kare eksik?" diye günlerce dövünürsünüz.

Şimdi asıl kanıt. Aynı 10 saniyeyi üç farklı FPS senaryosuyla besliyoruz ve sabit-adım durumunun **birebir** aynı çıkmasını bekliyoruz. Yanında da değişken-dt sürümünün ıraksadığını gösteriyoruz:

```ts
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
  const framesA = Array(600).fill(STEP);     // 60 FPS
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

  it("alpha=0 önceki durumu verir", () => expect(lerp(a, b, 0)).toEqual(vec(0, 0)));
  it("alpha=1 şimdiki durumu verir", () => expect(lerp(a, b, 1)).toEqual(vec(10, 20)));
  it("alpha=0.5 tam ortayı verir", () => expect(lerp(a, b, 0.5)).toEqual(vec(5, 10)));
});
```

İlk test, `toEqual` ile ekranın yüzüne "durumlar birebir aynı" diye yazıyor: 60 FPS'te, 15 FPS'te, 30 FPS'te — hepsinde topun konumu ve hızı bit bit özdeş. İkinci test tam tersini kanıtlıyor: aynı 0.8 saniyelik serbest düşüşü değişken-dt ile farklı `dt`'lere bölünce sonuç *tutmuyor* (topu ilk duvar temasından önce ölçüyoruz — sekip zemine oturduktan sonra iki senaryo da aynı noktada dinlenir, asıl fark uçuş sırasında `g·dt²`'de saklıdır). Demek ki baştaki iki-laptop hikâyesi bir his değil, `expect(...).not.toEqual(...)` ile ölçülebilen bir gerçek.

Küçük bir dürüstlük notu: bu determinizm garantisi, ölüm sarmalı korumasına dayanmadığınız sürece geçerli. Bir kare `MAX_STEPS` tavanına dayanıp `acc = 0` ile borç silinirse, o an biraz zaman düşersiniz ve farklı bölünmeler ayrışabilir. Testte kareleri bilerek tavanın altında tuttum. Gerçek oyunda da öyle olur — tavana ancak makine gerçekten boğulunca dayanılır, ki o zaman zaten "birebir aynı fizik"ten çok "donma" derdindesinizdir.

### Özetle:

1. Değişken-dt'li `world.step(dt)`, semi-implicit Euler'in doğrusal olmama özelliği yüzünden makineye/FPS'e göre farklı sonuç verir — ve düşük FPS'te tünellemeye yol açar.
2. Çözüm bir metronom: gerçek zamanı bir `accumulator`'da biriktir, `while (acc >= STEP)` ile sabit `STEP` dilimleriyle N kez adımla.
3. Ölüm sarmalını (spiral of death) iki kademede kır: tek kareyi `MAX_FRAME` ile kırp, tık sayısını `MAX_STEPS` ile sınırla, tavana dayanınca borcu sil.
4. Update'i (sabit hız) render'dan (ekran hızı) ayır — yoksa çizim fizik tık'larına hapsolur ve titrer.
5. `alpha = acc / STEP`, iki tık arasında neredeyiz sorusunun cevabı; `lerp(prev, pos, alpha)` ile pürüzsüz çizim verir.
6. Enterpolasyon geçmişi çizer (bir tık gecikme ekler), extrapolasyon geleceği tahmin eder (çarpışmada çirkinleşir) — oyunlarda genelde enterpolasyon kazanır.
7. Determinizm test edilebilir bir özelliktir: aynı toplam zamanı farklı kare parçalarına böl, sabit-adım durumu `toEqual`, değişken-dt `not.toEqual`.

Kodun tamamı — motor, döngü, demo ve testler — GitHub'da; `npm install && npm run dev` ile demo, `npm test` ile determinizm kanıtı dakikada ayağa kalkıyor.

Bu yazıyı yazarken tuhaf bulduğum şey şu oldu: fizik motorunu "doğru" yapan hamle (sabit adım), görüntüyü bir an için daha *kötü* yaptı — sonra o kötülüğü kapatmak için ayrı bir katman (enterpolasyon) yazmak zorunda kaldık. Sanki iki adım ileri bir adım geri gittik. Ama gerçekte olan buydu: doğruluk ile pürüzsüzlüğü aynı sayıya (`dt`) bağlamıştık, o düğümü çözünce ikisini de tek tek kazanabildik. Belki iyi mimari çoğu zaman böyledir — birbirine yapışmış iki derdi ayırmak, sonra her birini kendi diliyle çözmek.

Metronom tıklıyor, top akıyor. Ve artık aynı oyun her makinede aynı oynuyor. ⚙️🧠

---

### 🚀 Serinin ve Konunun Devamı
Web oyun mimarisinde determinizm, bellek ve performans serisindeki diğer bölümler:
- 📌 **[Aynı Canvas, İki Ayrı Boyut: devicePixelRatio ile Bulanıklığı Bitirmek](https://medium.com/@mkare)** — *Retina ve HiDPI ekranlarda bulanıklığı yok edip keskin tuval oluşturma rehberi.*
- 📌 **[Çöpü Değil, Bardağı Geri Ver: Canvas'ta Nesne Havuzları ve Sıfır-Ayırmalı Döngü](https://medium.com/@mkare)** — *Garbage Collector baskısını sıfıra indirerek 60/120 FPS akıcılığı sabitleme.*
- 📌 **[Temiz Oda: Canvas Oyununu Test Edilebilir Yapan Şey Test Değil, Mimari](https://medium.com/@mkare)** — *Render katmanından ayrılmış saf oyun motorunu Vitest ile headless test etme.*

---

### 👋 Yazar Hakkında
Ben **Mustafa Morbel** — 14 yılı aşkın süredir modern web teknolojileri, oyun döngüleri, fizik motorları ve yapay zekâ sistemleri üzerine mühendislik yapıyorum.

* Deterministik testleri ve çalışan demoyu incelemek için **[GitHub (@mkare)](https://github.com/mkare)** profilimi ziyaret edebilirsiniz.
* Teknik yazılar, mimari paylaşımlar ve tartışmalar için **[LinkedIn](https://linkedin.com/in/mustafamorbel)** ve **[X / Twitter (@mustafamorbel)](https://x.com/mustafamorbel)** üzerinden takibe alabilirsiniz.
* Farklı ekran yenileme hızlarında karşılaştığınız fizik anomalilerini yorumlarda paylaşmayı, faydalı bulduysanız 👏 alkış bırakmayı unutmayın!
