// Vectors: the alphabet of physics. In a 2D world everything is two numbers.
export type Vec2 = { x: number; y: number };

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => vec(a.x + b.x, a.y + b.y);
export const scale = (a: Vec2, s: number): Vec2 => vec(a.x * s, a.y * s);

// Linear interpolation between two points by ratio t (0..1).
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 =>
  vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
