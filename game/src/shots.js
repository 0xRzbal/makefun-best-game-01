// The screenshot scenes behind ?shot=title|play|warp|end. Each plays the real rules forward from a
// fresh world for a fixed number of steps, steered by an autopilot (turn toward the nearest rock or
// away from the star, fire constantly) so the frame is what a real run looks like and the same seed
// always gives the same frame.
import { STAR, STEP, WARP_ENERGY } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 3.2;
const PLAY_SECONDS = 14;
const WARP_SECONDS = 24;
const END_SECONDS = 30;

function autopilot(state) {
  const p = state.player;
  const sx = p.x - STAR.x;
  const sy = p.y - STAR.y;
  const distS = Math.hypot(sx, sy);

  // Nearest asteroid, and the nearest *threatening* one.
  let nearest = null;
  let nearestD = Infinity;
  let threat = null;
  let threatD = Infinity;
  for (let i = 0; i < state.asteroids.length; i += 1) {
    const a = state.asteroids[i];
    if (!a.active) continue;
    const dx = a.x - p.x;
    const dy = a.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < nearestD) {
      nearestD = d;
      nearest = a;
    }
    if (d < threatD) {
      const closing = (dx * (a.vx - p.vx) + dy * (a.vy - p.vy)) / (Math.sqrt(d) || 1);
      if (closing < -30) {
        threatD = d;
        threat = a;
      }
    }
  }

  let desired;
  // 1. Don't fall into the star.
  if (distS < 278 && (sx * p.vx + sy * p.vy) > -60) {
    desired = Math.atan2(-sy, -sx);
  } else if (distS > 430) {
    // 2. Too far out: pull back in toward the star.
    desired = Math.atan2(-sy, -sx);
  } else if (threat && threatD < 150000) {
    // 3. A rock is closing in: flee tangentially away from it.
    const rx = threat.x - p.x;
    const ry = threat.y - p.y;
    const base = Math.atan2(ry, rx);
    const cross = rx * (threat.vy - p.vy) - ry * (threat.vx - p.vx);
    desired = base + (cross > 0 ? -Math.PI / 2 : Math.PI / 2);
  } else if (nearest) {
    // 4. Otherwise fly toward the nearest rock and shoot it.
    desired = Math.atan2(nearest.y - p.y, nearest.x - p.x);
  } else {
    desired = p.angle;
  }

  let diff = desired - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = diff > 0.04 ? 1 : diff < -0.04 ? -1 : 0;
  const target = nearest || { x: STAR.x, y: STAR.y - 200 };
  return { turn, thrust: 1, fire: true, tx: target.x, ty: target.y };
}

function placeRock(world, x, y, r, seed, hazard, vx, vy) {
  const a = world.state.asteroids.find((q) => !q.active);
  if (!a) return;
  a.active = true;
  a.x = x;
  a.y = y;
  a.r = r;
  const n = 8;
  a.verts.length = n;
  for (let i = 0; i < n; i += 1) a.verts[i] = 0.62 + ((seed + i * 13) % 55) / 100;
  a.rot = seed % 7;
  a.vrot = ((seed % 5) - 2) * 0.5;
  a.seed = seed;
  a.hazard = hazard;
  a.vx = vx;
  a.vy = vy;
}

function placeCore(world, x, y, seed) {
  const c = world.state.cores.find((q) => !q.active);
  if (!c) return;
  c.active = true;
  c.x = x;
  c.y = y;
  c.vx = 0;
  c.vy = 0;
  c.r = 11;
  c.seed = seed;
}

function composeAction(world) {
  const s = world.state;
  placeRock(world, 980, 150, 34, 101, 0.7, -60, 90);
  placeRock(world, 330, 520, 44, 222, 0.2, 90, -70);
  placeRock(world, 1020, 500, 28, 333, 0.5, -80, -60);
  placeRock(world, 210, 250, 24, 444, 0.9, 70, 40);
  placeCore(world, 760, 270, 9);
  placeCore(world, 500, 330, 11);
  // A scattering of debris particles for life.
  for (let i = 0; i < 26; i += 1) {
    const p = s.particles.find((q) => !q.active);
    if (!p) break;
    const ang = (i / 26) * Math.PI * 2;
    p.active = true;
    p.x = 880 + Math.cos(ang) * 60;
    p.y = 220 + Math.sin(ang) * 60;
    p.vx = Math.cos(ang) * 80;
    p.vy = Math.sin(ang) * 80;
    p.life = 0.4 + (i % 6) * 0.08;
    p.maxLife = p.life;
    p.size = 2 + (i % 4);
    p.r = 255;
    p.g = 220;
    p.b = 130;
    p.glow = 1;
  }
}
/**
 * Set `world` to the named scene (title, play, warp or end; any other name is title) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'warp' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      if (world.step(STEP, { turn: 0, thrust: 0, fire: false, tx: 0, ty: 0 }) & EVENT_OVER) break;
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  const limit = name === 'warp' ? WARP_SECONDS : name === 'end' ? END_SECONDS : PLAY_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    if (world.step(STEP, autopilot(world.state)) & EVENT_OVER) break;
  }

  if (name !== 'end') composeAction(world);

  if (name === 'warp') {
    // Charge the warp meter and let the next step fire it so the flash shows.
    world.state.energy = WARP_ENERGY;
    world.step(STEP, { turn: 0, thrust: 0, fire: false, tx: STAR.x, ty: STAR.y });
    return { screen: SCREEN_PLAY, best: world.state.score };
  }

  if (name === 'end') {
    // A fatal hit: blow up the ship to close the run.
    world.state.player.hull = 0;
    const p = world.state.player;
    const n = world.state.particles.length;
    for (let i = 0; i < n && i < 60; i += 1) {
      const pt = world.state.particles[i];
      if (pt.active) continue;
      const ang = (i / 60) * Math.PI * 2;
      const sp = 120 + (i % 24) * 18;
      pt.active = true;
      pt.x = p.x;
      pt.y = p.y;
      pt.vx = Math.cos(ang) * sp;
      pt.vy = Math.sin(ang) * sp;
      pt.life = 0.5 + (i % 20) * 0.03;
      pt.maxLife = pt.life;
      pt.size = 3 + (i % 5);
      pt.r = 255;
      pt.g = 170;
      pt.b = 90;
      pt.glow = 1;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }

  return { screen: SCREEN_PLAY, best: world.state.score };
}
