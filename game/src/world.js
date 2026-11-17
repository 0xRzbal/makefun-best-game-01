// The game's rules and state, with no drawing and no browser in it: the pilot's ship, the star's
// gravity, the drifting asteroid field, plasma bolts, harvestable cores, the warp meter, score,
// combo, hull and levels. step() advances one fixed step and returns what happened as bit flags,
// so the caller can react without the world knowing about screens or sound. Nothing here allocates
// after createWorld returns.
import {
  ASTEROID, BOLT, COMBO_WINDOW, CORE, FIELD, GRAV_GM, GRAV_MAX, HULL, INVULN,
  MAX_LEVEL, PARTICLE, PLAYER, REGEN_DELAY, REGEN_INTERVAL, STAR, WARP_ENERGY,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_CORE = 4;
export const EVENT_WARP = 8;
export const EVENT_OVER = 16;
export const EVENT_POOF = 32;

const TWO_PI = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createWorld(random) {
  const asteroids = [];
  for (let i = 0; i < ASTEROID.pool; i += 1) {
    asteroids.push({
      active: false, x: 0, y: 0, vx: 0, vy: 0,
      r: 0, rot: 0, vrot: 0, verts: [], seed: 0, hazard: 0,
    });
  }
  const cores = [];
  for (let i = 0; i < CORE.pool; i += 1) cores.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, seed: 0 });
  const bolts = [];
  for (let i = 0; i < BOLT.pool; i += 1) bolts.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const particles = [];
  for (let i = 0; i < PARTICLE.pool; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, r: 255, g: 255, b: 255, glow: 0 });
  }

  const player = {
    x: STAR.x, y: STAR.y - 240, vx: 220, vy: 0,
    angle: -Math.PI / 2, hull: HULL, invuln: 0, cd: 0,
    regenTimer: 0, lastHit: -99,
  };

  const state = {
    player, asteroids, cores, bolts, particles,
    score: 0, combo: 0, comboTimer: 0,
    level: 1, energy: 0, spawnTimer: 0.6,
    elapsed: 0, warpFlash: 0,
  };

  function reset() {
    player.x = STAR.x;
    player.y = STAR.y - 240;
    player.vx = 220;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.hull = HULL;
    player.invuln = 0;
    player.cd = 0;
    player.regenTimer = 0;
    player.lastHit = -99;
    for (const a of asteroids) a.active = false;
    for (const c of cores) c.active = false;
    for (const b of bolts) b.active = false;
    for (const p of particles) p.active = false;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.level = 1;
    state.energy = 0;
    state.spawnTimer = 0.6;
    state.elapsed = 0;
    state.warpFlash = 0;
  }

  function freeAsteroid() {
    for (let i = 0; i < asteroids.length; i += 1) if (!asteroids[i].active) return asteroids[i];
    return null;
  }

  function spawnAsteroid() {
    const a = freeAsteroid();
    if (!a) return;
    a.active = true;
    const lvl = Math.min(state.level, 20);
    const scale = 1 + 0.07 * (lvl - 1);
    const size = Math.min(1, 1 + 0.05 * (lvl - 1));
    const ang = random.next() * TWO_PI;
    const dist = random.range(520, 640);
    a.x = STAR.x + Math.cos(ang) * dist;
    a.y = STAR.y + Math.sin(ang) * dist;
    const base = random.range(ASTEROID.minR, ASTEROID.maxR) * size;
    a.r = base;
    // Polymorphic rock silhouette.
    const n = 7 + Math.floor(random.next() * 5);
    a.verts.length = n;
    for (let i = 0; i < n; i += 1) a.verts[i] = 0.58 + random.next() * 0.55;
    a.rot = random.next() * TWO_PI;
    a.vrot = random.spread() * ASTEROID.spin;
    a.seed = Math.floor(random.next() * 1e6);
    a.hazard = random.next();
    const dx = STAR.x - a.x;
    const dy = STAR.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = random.range(ASTEROID.speedMin, ASTEROID.speedMax) * scale;
    const px = dx / len;
    const py = dy / len;
    // Mostly inward, with a sideways slip so paths cross.
    const slip = random.spread() * 0.3;
    a.vx = px * speed + (-py) * slip * speed;
    a.vy = py * speed + px * slip * speed;
  }

  function freeCore() {
    for (let i = 0; i < cores.length; i += 1) if (!cores[i].active) return cores[i];
    return null;
  }

  function dropCore(x, y) {
    const c = freeCore();
    if (!c) return;
    c.active = true;
    c.x = x;
    c.y = y;
    c.vx = random.spread() * 70;
    c.vy = random.spread() * 70;
    c.r = 11;
    c.seed = Math.floor(random.next() * 1e6);
  }

  function freeBolt() {
    for (let i = 0; i < bolts.length; i += 1) if (!bolts[i].active) return bolts[i];
    return null;
  }

  function spawnParticle(x, y, vx, vy, life, size, r, g, b, glow) {
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.life = life;
        p.maxLife = life;
        p.size = size;
        p.r = r;
        p.g = g;
        p.b = b;
        p.glow = glow;
        return;
      }
    }
  }

  function burst(x, y, count, mag, r, g, b, glow) {
    for (let i = 0; i < count; i += 1) {
      const a = random.next() * TWO_PI;
      const sp = random.range(0.15, 1) * mag;
      spawnParticle(
        x, y,
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        random.range(0.3, 0.9), random.range(2, 5.5),
        r, g, b, glow,
      );
    }
  }

  function gravityAccel(x, y, cap) {
    const dx = STAR.x - x;
    const dy = STAR.y - y;
    const d2 = dx * dx + dy * dy || 1;
    let a = GRAV_GM / d2;
    if (a > cap) a = cap;
    const d = Math.sqrt(d2);
    return { ax: (dx / d) * a, ay: (dy / d) * a };
  }

  function damagePlayer(firstHit = false) {
    if (player.invuln > 0) return 0;
    player.hull -= 1;
    player.invuln = INVULN;
    player.lastHit = state.elapsed;
    player.regenTimer = 0;
    let events = EVENT_HIT;
    // Knockback away from the star.
    const dx = player.x - STAR.x;
    const dy = player.y - STAR.y;
    const d = Math.hypot(dx, dy) || 1;
    player.vx += (dx / d) * 420;
    player.vy += (dy / d) * 420;
    if (player.hull <= 0) {
      events |= EVENT_OVER;
    }
    return events;
  }

  function fireBolt(tx, ty) {
    const b = freeBolt();
    if (!b) return;
    b.active = true;
    b.x = player.x + Math.cos(player.angle) * (PLAYER.radius + 8);
    b.y = player.y + Math.sin(player.angle) * (PLAYER.radius + 8);
    let dx = tx - b.x;
    let dy = ty - b.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    b.vx = dx * PLAYER.boltSpeed;
    b.vy = dy * PLAYER.boltSpeed;
    b.life = PLAYER.boltLife;
    // Muzzle flash.
    spawnParticle(b.x, b.y, dx * 160, dy * 160, 0.16, 4, 200, 240, 255, 1);
  }

  function destroyAsteroid(a) {
    a.active = false;
    let events = EVENT_KILL;
    state.combo = Math.min(state.combo + 1, 9);
    state.comboTimer = COMBO_WINDOW;
    state.score += 100 * state.combo;
    const hue = a.hazard;
    burst(a.x, a.y, Math.min(26, 10 + Math.floor(a.r / 4)), 150 + a.r * 2.2, 255, 120 + 60 * (1 - hue), 90, 1);
    if (random.next() < Math.min(0.72, 0.42 + 0.03 * state.level)) dropCore(a.x, a.y);
    return events;
  }

  function step(dt, input) {
    if (state.warpFlash > 0) state.warpFlash = Math.max(0, state.warpFlash - dt);
    state.elapsed += dt;

    // --- player ---
    player.angle += input.turn * PLAYER.rotSpeed * dt;
    let g = gravityAccel(player.x, player.y, GRAV_MAX);
    player.vx += g.ax * dt;
    player.vy += g.ay * dt;
    const fwd = Math.cos(player.angle);
    const fwy = Math.sin(player.angle);
    player.vx += fwd * PLAYER.thrust * input.thrust * dt;
    player.vy += fwy * PLAYER.thrust * input.thrust * dt;
    const drag = Math.exp(-PLAYER.drag * dt);
    player.vx *= drag;
    player.vy *= drag;
    const sp = Math.hypot(player.vx, player.vy);
    if (sp > PLAYER.maxSpeed) {
      const k = PLAYER.maxSpeed / sp;
      player.vx *= k;
      player.vy *= k;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    const margin = 26;
    const hw = FIELD.width / 2 - margin;
    const hh = FIELD.height / 2 - margin;
    if (player.x < STAR.x - hw) { player.x = STAR.x - hw; player.vx = Math.abs(player.vx); }
    if (player.x > STAR.x + hw) { player.x = STAR.x + hw; player.vx = -Math.abs(player.vx); }
    if (player.y < STAR.y - hh) { player.y = STAR.y - hh; player.vy = Math.abs(player.vy); }
    if (player.y > STAR.y + hh) { player.y = STAR.y + hh; player.vy = -Math.abs(player.vy); }

    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
    player.cd = Math.max(0, player.cd - dt);

    // --- fire ---
    if (input.fire && player.cd <= 0) {
      fireBolt(input.tx, input.ty);
      player.cd = PLAYER.fireCd;
    }

    let events = 0;

    // --- star collision (burns you) ---
    const pdx = player.x - STAR.x;
    const pdy = player.y - STAR.y;
    const pd = Math.hypot(pdx, pdy);
    if (pd < STAR.r + PLAYER.radius + 6) {
      if (pd > 0.001) {
        const nx = pdx / pd;
        const ny = pdy / pd;
        player.x = STAR.x + nx * (STAR.r + PLAYER.radius + 10);
        player.y = STAR.y + ny * (STAR.r + PLAYER.radius + 10);
      }
      player.vx += pdx / (pd + 0.001) * 360;
      player.vy += pdy / (pd + 0.001) * 360;
      if (player.invuln <= 0) {
        burst(player.x, player.y, 14, 200, 255, 140, 80, 0.8);
        events |= damagePlayer();
        if (events & EVENT_OVER) return events;
      }
    }

    // --- regen ---
    if (player.hull < HULL && state.elapsed - player.lastHit > REGEN_DELAY) {
      player.regenTimer += dt;
      if (player.regenTimer >= REGEN_INTERVAL) {
        player.regenTimer = 0;
        player.hull += 1;
      }
    }

    // --- spawning ---
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnAsteroid();
      const interval = Math.max(0.34, ASTEROID.spawnIntervalBase * Math.pow(ASTEROID.spawnIntervalScale, state.level - 1));
      state.spawnTimer += interval;
    }

    // --- asteroids ---
    for (let i = 0; i < asteroids.length; i += 1) {
      const a = asteroids[i];
      if (!a.active) continue;
      g = gravityAccel(a.x, a.y, 900);
      a.vx += g.ax * dt;
      a.vy += g.ay * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.vrot * dt;
      const adx = a.x - STAR.x;
      const ady = a.y - STAR.y;
      const ad = Math.hypot(adx, ady);
      if (ad < STAR.r + a.r * 0.3) {
        a.active = false;
        events |= EVENT_POOF;
        continue;
      }
      if (ad > 760) {
        a.active = false;
        continue;
      }
      // collision with player
      if (player.invuln <= 0) {
        const dx = a.x - player.x;
        const dy = a.y - player.y;
        const rr = a.r + PLAYER.radius;
        if (dx * dx + dy * dy < rr * rr) {
          a.active = false;
          burst(a.x, a.y, 12, 160, 255, 120, 90, 0.8);
          events |= damagePlayer();
          if (events & EVENT_OVER) return events;
        }
      }
    }

    // --- bolts ---
    for (let i = 0; i < bolts.length; i += 1) {
      const b = bolts[i];
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        continue;
      }
      for (let j = 0; j < asteroids.length; j += 1) {
        const a = asteroids[j];
        if (!a.active) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = a.r + PLAYER.boltR;
        if (dx * dx + dy * dy < rr * rr) {
          b.active = false;
          events |= destroyAsteroid(a);
          break;
        }
      }
    }

    // --- cores ---
    for (let i = 0; i < cores.length; i += 1) {
      const c = cores[i];
      if (!c.active) continue;
      g = gravityAccel(c.x, c.y, 420);
      c.vx += g.ax * dt;
      c.vy += g.ay * dt;
      const dx = player.x - c.x;
      const dy = player.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < CORE.magnetRange) {
        const pull = (1 - d / CORE.magnetRange) * CORE.magnetPower;
        c.vx += (dx / (d + 0.001)) * pull * dt;
        c.vy += (dy / (d + 0.001)) * pull * dt;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      const cdx = c.x - STAR.x;
      const cdy = c.y - STAR.y;
      const cd = Math.hypot(cdx, cdy);
      if (cd > 760) {
        c.active = false;
        continue;
      }
      if (cd < STAR.r + 4) {
        c.active = false; // burned up before you could grab it
        continue;
      }
      if (d < c.r + PLAYER.radius) {
        c.active = false;
        state.energy = Math.min(WARP_ENERGY, state.energy + CORE.value);
        state.score += 150 * state.combo;
        events |= EVENT_CORE;
        burst(c.x, c.y, 12, 140, 255, 240, 140, 0.9);
      }
    }

    // --- warp ---
    if (state.energy >= WARP_ENERGY && state.level < MAX_LEVEL) {
      state.level += 1;
      state.energy = 0;
      state.combo = 0;
      state.comboTimer = 0;
      state.spawnTimer = 0.8;
      state.warpFlash = 1.6;
      if (player.hull < HULL) player.hull += 1;
      for (let i = 0; i < asteroids.length; i += 1) {
        if (asteroids[i].active && random.next() < 0.65) asteroids[i].active = false;
      }
      events |= EVENT_WARP;
    }

    // --- combo decay ---
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // --- particles ---
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-2.6 * dt);
      p.vy *= Math.exp(-2.6 * dt);
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }

    return events;
  }

  reset();
  return { state, reset, step };
}
