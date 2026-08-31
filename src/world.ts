import { type Vec2, vec, add, scale } from "./vec";

export interface Body {
  pos: Vec2; // şimdiki (curr) konum
  prev: Vec2; // bir önceki tık'taki konum — enterpolasyon için
  vel: Vec2;
  radius: number;
  bounciness: number;
}

// prev, pos ile aynı başlar: ilk karede enterpolasyon sıçratmaz.
export function createBody(
  x: number,
  y: number,
  radius: number,
  bounciness: number,
): Body {
  return {
    pos: vec(x, y),
    prev: vec(x, y),
    vel: vec(),
    radius,
    bounciness,
  };
}

export class World {
  bodies: Body[] = [];
  gravity: Vec2;

  constructor(
    public width: number,
    public height: number,
    gravityY = 900,
  ) {
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
