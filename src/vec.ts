// Vektörler: fiziğin alfabesi. 2D dünyada her şey iki sayıdır.
export type Vec2 = { x: number; y: number };

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => vec(a.x + b.x, a.y + b.y);
export const scale = (a: Vec2, s: number): Vec2 => vec(a.x * s, a.y * s);

// İki nokta arasında t oranında (0..1) düz enterpolasyon.
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 =>
  vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
