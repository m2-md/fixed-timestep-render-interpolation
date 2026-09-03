import { type Vec2, vec, add, scale } from "./vec";

export interface Body {
  pos: Vec2; // current (curr) position
  prev: Vec2; // position at previous tick — for interpolation
  vel: Vec2;
  radius: number;
  bounciness: number;
}

// prev starts identical to pos: prevents interpolation snap on the first frame.
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

  // Called before step: prev = curr. The "past" endpoint of interpolation.
  snapshot() {
    for (const b of this.bodies) {
      b.prev.x = b.pos.x;
      b.prev.y = b.pos.y;
    }
  }

  // Single FIXED step — dt is identical (STEP) on every call.
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
