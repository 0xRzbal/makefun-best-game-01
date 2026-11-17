// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with deep space. All art is
// procedural: a pulsing star with rotating corona, a parallax starfield, tinted nebulae,
// polymorphic asteroids, glowing bolts and cores, particle bursts and a neon HUD.
import { FIELD, FONT, LEVEL_COLORS, STAR, WARP_ENERGY } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const TWO_PI = Math.PI * 2;

function rgba(r, g, b, a) {
  return `rgba(${r},${g},${b},${a})`;
}

function hueFrom(level) {
  return LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length];
}

export function createRenderer(canvas, rng) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const bestLabel = { value: -1, text: '' };
  const scoreLabel = { value: -1, text: '' };
  const levelLabel = { value: -1, text: '' };
  let shake = 0;

  // Deterministic background field, generated once with a fixed seed.
  const stars = [];
  {
    let seed = 987654321;
    function rnd() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (let i = 0; i < 170; i += 1) {
      stars.push({
        x: rnd() * FIELD.width,
        y: rnd() * FIELD.height,
        r: 0.4 + rnd() * 1.7,
        p: rnd() * TWO_PI,
        layer: rnd() < 0.5 ? 0 : 1,
        a: 0.3 + rnd() * 0.7,
      });
    }
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(str, x, y, size, color, align, weight = '') {
    if (!fonts.has(size + weight)) fonts.set(size + weight, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(size + weight);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(str, x, y);
  }

  function drawStarfield(t, level) {
    const tint = hueFrom(level);
    // Deep space base gradient.
    const bg = context.createRadialGradient(STAR.x, STAR.y, 0, STAR.x, STAR.y, 520);
    bg.addColorStop(0, '#1a1530');
    bg.addColorStop(0.45, '#0b0a18');
    bg.addColorStop(1, '#04040a');
    context.fillStyle = bg;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // Nebulae.
    for (let i = 0; i < 3; i += 1) {
      const nx = 180 + i * 380 + Math.sin(t * 0.1 + i * 2.1) * 30;
      const ny = 140 + i * 120 + Math.cos(t * 0.09 + i) * 24;
      const nb = context.createRadialGradient(nx, ny, 0, nx, ny, 300);
      nb.addColorStop(0, rgba(parseInt(tint.nebula.split(',')[0], 10), parseInt(tint.nebula.split(',')[1], 10), parseInt(tint.nebula.split(',')[2], 10), 0.05));
      nb.addColorStop(1, rgba(0, 0, 0, 0));
      context.fillStyle = nb;
      context.fillRect(nx - 300, ny - 300, 600, 600);
    }

    // Twinkling stars (two parallax layers).
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      const tw = 0.55 + 0.45 * Math.sin(t * (1.2 + s.p) + s.p);
      context.fillStyle = rgba(200, 220, 255, s.a * tw * 0.9);
      context.beginPath();
      context.arc(s.x, s.y, s.r * (s.layer + 0.6), 0, TWO_PI);
      context.fill();
    }
  }

  function drawOrbitRings(t) {
    context.save();
    context.strokeStyle = rgba(140, 170, 255, 0.08);
    context.lineWidth = 1;
    for (let i = 0; i < 3; i += 1) {
      const rr = 190 + i * 110;
      context.beginPath();
      context.arc(STAR.x, STAR.y, rr, 0, TWO_PI);
      context.stroke();
    }
    context.restore();
  }

  function drawStar(t, level) {
    const { x, y, r } = STAR;
    const pulse = 1 + 0.045 * Math.sin(t * 2.4);
    // Wide halo.
    const halo = context.createRadialGradient(x, y, r * 0.4, x, y, r * 4.6);
    halo.addColorStop(0, rgba(255, 214, 150, 0.5));
    halo.addColorStop(0.32, rgba(255, 152, 70, 0.22));
    halo.addColorStop(1, rgba(255, 120, 50, 0));
    context.fillStyle = halo;
    context.beginPath();
    context.arc(x, y, r * 4.6, 0, TWO_PI);
    context.fill();

    // Rotating corona rays.
    context.save();
    context.translate(x, y);
    context.rotate(t * 0.18);
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = rgba(255, 180, 90, 0.14);
    for (let i = 0; i < 12; i += 1) {
      context.save();
      context.rotate((i / 12) * TWO_PI + Math.sin(t * 0.5 + i) * 0.05);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(r * 2.1, -r * 0.34);
      context.lineTo(r * 2.4, 0);
      context.lineTo(r * 2.1, r * 0.34);
      context.closePath();
      context.fill();
      context.restore();
    }
    context.restore();

    // Pulsing disc.
    const disc = context.createRadialGradient(x, y, 0, x, y, r * pulse);
    disc.addColorStop(0, '#fffbe8');
    disc.addColorStop(0.35, '#ffd970');
    disc.addColorStop(0.8, '#ff8a3d');
    disc.addColorStop(1, 'rgba(255,120,50,0)');
    context.fillStyle = disc;
    context.beginPath();
    context.arc(x, y, r * pulse, 0, TWO_PI);
    context.fill();

    // White-hot core.
    context.fillStyle = 'rgba(255,255,240,0.95)';
    context.beginPath();
    context.arc(x, y, r * 0.38 * pulse, 0, TWO_PI);
    context.fill();
  }

  function drawAsteroid(a, t, level) {
    const tint = hueFrom(level).hazard.split(',');
    context.save();
    context.translate(a.x, a.y);
    context.rotate(a.rot);
    const n = a.verts.length;
    context.beginPath();
    for (let i = 0; i < n; i += 1) {
      const ang = (i / n) * TWO_PI;
      const rr = a.r * a.verts[i];
      const px = Math.cos(ang) * rr;
      const py = Math.sin(ang) * rr;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    const base = 'rgba(' + (34 + a.seed % 14) + ',' + (30 + (a.seed >> 4) % 14) + ',' + (52 + (a.seed >> 8) % 18) + ',0.96)';
    context.fillStyle = base;
    context.fill();
    context.lineWidth = 2;
    // Rim light on the side facing the star.
    const towardStar = Math.atan2(STAR.y - a.y, STAR.x - a.x) - a.rot;
    const lit = rgba(parseInt(tint[0], 10), parseInt(tint[1], 10), parseInt(tint[2], 10), 0.55);
    context.strokeStyle = lit;
    context.stroke();
    // A couple of facet cracks.
    context.strokeStyle = 'rgba(0,0,0,0.35)';
    context.lineWidth = 1.2;
    for (let i = 0; i < 3; i += 1) {
      const i0 = (a.seed + i * 7) % n;
      const i1 = (i0 + 1 + (a.seed >> 3) % (n - 1)) % n;
      const a0 = (i0 / n) * TWO_PI;
      const a1 = (i1 / n) * TWO_PI;
      context.beginPath();
      context.moveTo(Math.cos(a0) * a.r * a.verts[i0] * 0.5, Math.sin(a0) * a.r * a.verts[i0] * 0.5);
      context.lineTo(Math.cos(a1) * a.r * a.verts[i1] * 0.75, Math.sin(a1) * a.r * a.verts[i1] * 0.75);
      context.stroke();
    }
    context.restore();
  }

  function drawCore(c, t) {
    const pulse = 1 + 0.12 * Math.sin(t * 5 + c.seed);
    context.save();
    context.translate(c.x, c.y);
    const halo = context.createRadialGradient(0, 0, 0, 0, 0, c.r * 3.2);
    halo.addColorStop(0, rgba(255, 240, 170, 0.5));
    halo.addColorStop(1, rgba(255, 200, 90, 0));
    context.fillStyle = halo;
    context.beginPath();
    context.arc(0, 0, c.r * 3.2, 0, TWO_PI);
    context.fill();
    const orb = context.createRadialGradient(0, 0, 0, 0, 0, c.r * pulse);
    orb.addColorStop(0, '#fff8e0');
    orb.addColorStop(0.6, '#ffe08a');
    orb.addColorStop(1, 'rgba(255,190,80,0)');
    context.fillStyle = orb;
    context.beginPath();
    context.arc(0, 0, c.r * pulse, 0, TWO_PI);
    context.fill();
    context.restore();
  }

  function drawBolt(b) {
    const t0 = b.x - b.vx * 0.02;
    const t1 = b.y - b.vy * 0.02;
    context.save();
    context.globalCompositeOperation = 'lighter';
    const grad = context.createLinearGradient(t0, t1, b.x, b.y);
    grad.addColorStop(0, rgba(120, 200, 255, 0.05));
    grad.addColorStop(1, rgba(190, 235, 255, 0.95));
    context.strokeStyle = grad;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(t0, t1);
    context.lineTo(b.x, b.y);
    context.stroke();
    context.fillStyle = 'rgba(225,248,255,1)';
    context.beginPath();
    context.arc(b.x, b.y, 3, 0, TWO_PI);
    context.fill();
    context.restore();
  }

  function drawParticle(p) {
    const k = p.life / p.maxLife;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = rgba(p.r, p.g, p.b, k * 0.9);
    context.beginPath();
    context.arc(p.x, p.y, p.size * k, 0, TWO_PI);
    context.fill();
    context.restore();
  }

  function drawShip(t, p, thrust) {
    context.save();
    context.translate(p.x, p.y);
    context.rotate(p.angle);
    // Engine flame.
    if (thrust > 0) {
      const flick = 0.7 + 0.3 * Math.sin(t * 40);
      const len = 26 * flick * thrust;
      const flame = context.createLinearGradient(-8, 0, -8 - len, 0);
      flame.addColorStop(0, 'rgba(140,220,255,0.9)');
      flame.addColorStop(1, 'rgba(60,120,255,0)');
      context.fillStyle = flame;
      context.beginPath();
      context.moveTo(-8, -5);
      context.lineTo(-8 - len, 0);
      context.lineTo(-8, 5);
      context.closePath();
      context.fill();
    }
    // Hull.
    const grad = context.createLinearGradient(0, -14, 0, 14);
    grad.addColorStop(0, '#eafcff');
    grad.addColorStop(1, '#63cff0');
    context.fillStyle = grad;
    context.beginPath();
    context.moveTo(16, 0);
    context.lineTo(-8, -9);
    context.lineTo(-4, 0);
    context.lineTo(-8, 9);
    context.closePath();
    context.fill();
    context.fillStyle = 'rgba(10,20,40,0.55)';
    context.beginPath();
    context.moveTo(4, 0);
    context.lineTo(-8, -5);
    context.lineTo(-4, 0);
    context.lineTo(-8, 5);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(180,240,255,0.85)';
    context.lineWidth = 1.4;
    context.stroke();
    context.restore();

    // Invulnerability shield.
    if (p.invuln > 0) {
      const k = Math.floor(p.invuln * 12) % 2 === 0 ? 0.5 : 0.15;
      context.save();
      context.strokeStyle = rgba(120, 220, 255, k);
      context.lineWidth = 2;
      context.beginPath();
      context.arc(p.x, p.y, 22 + 1.5 * Math.sin(t * 20), 0, TWO_PI);
      context.stroke();
      context.restore();
    }
  }

  function drawCrosshair(aim) {
    if (!aim) return;
    context.save();
    context.strokeStyle = 'rgba(150,230,255,0.9)';
    context.lineWidth = 1.6;
    const x = aim.x;
    const y = aim.y;
    context.beginPath();
    context.arc(x, y, 10, 0, TWO_PI);
    context.stroke();
    context.beginPath();
    context.moveTo(x - 14, y);
    context.lineTo(x - 4, y);
    context.moveTo(x + 4, y);
    context.lineTo(x + 14, y);
    context.moveTo(x, y - 14);
    context.lineTo(x, y - 4);
    context.moveTo(x, y + 4);
    context.lineTo(x, y + 14);
    context.stroke();
    context.restore();
  }

  function drawHud(state, best, aim, t) {
    const tint = hueFrom(state.level);
    // Score (top-left).
    if (scoreLabel.value !== state.score) {
      scoreLabel.value = state.score;
      scoreLabel.text = String(state.score);
    }
    text(scoreLabel.text, 26, 26, 34, '#dff6ff', 'left', '700');
    text('SCORE', 26, 58, 13, 'rgba(150,200,230,0.75)', 'left');
    if (state.combo > 1) {
      text(`×${state.combo}`, 26, 82, 22, '#ffd970', 'left', '700');
      // Combo timer bar.
      const w = 74 * (state.comboTimer / 3);
      context.fillStyle = 'rgba(255,217,112,0.85)';
      context.fillRect(70, 86, Math.max(0, w), 3);
    }

    // Level + name (top-centre).
    if (levelLabel.value !== state.level) {
      levelLabel.value = state.level;
      levelLabel.text = `ORBIT ${state.level}`;
    }
    text(levelLabel.text, FIELD.width / 2, 26, 24, '#dff6ff', 'center', '700');
    text(tint.name, FIELD.width / 2, 52, 15, `rgba(${tint.nebula},0.9)`, 'center');

    // Warp meter (below).
    const warpW = 230;
    const warpX = FIELD.width / 2 - warpW / 2;
    const frac = Math.min(1, state.energy / WARP_ENERGY);
    context.fillStyle = 'rgba(255,255,255,0.09)';
    context.fillRect(warpX, 70, warpW, 10);
    const wg = context.createLinearGradient(warpX, 0, warpX + warpW, 0);
    wg.addColorStop(0, `rgba(${tint.nebula},0.9)`);
    wg.addColorStop(1, 'rgba(255,230,150,0.95)');
    context.fillStyle = wg;
    context.fillRect(warpX, 70, Math.max(0, warpW * frac), 10);
    context.strokeStyle = 'rgba(255,255,255,0.2)';
    context.lineWidth = 1;
    context.strokeRect(warpX, 70, warpW, 10);
    text('WARP', warpX + warpW + 12, 80, 13, 'rgba(160,210,235,0.8)', 'left');

    // Hull pips (top-right).
    const pipR = 9;
    const pipY = 30;
    for (let i = 0; i < 3; i += 1) {
      const px = FIELD.width - 34 - i * 26;
      const on = i < state.player.hull;
      context.save();
      context.beginPath();
      context.arc(px, pipY, pipR, Math.PI * 0.25, Math.PI * 1.75);
      context.closePath();
      context.fillStyle = on ? 'rgba(120,230,255,0.95)' : 'rgba(120,160,190,0.25)';
      context.fill();
      context.strokeStyle = on ? 'rgba(220,250,255,0.9)' : 'rgba(120,160,190,0.35)';
      context.lineWidth = 2;
      context.stroke();
      context.restore();
    }
    text('HULL', FIELD.width - 34 - 3 * 26 - 12, pipY + 4, 12, 'rgba(150,200,230,0.75)', 'right');
    text('M to mute', FIELD.width - 22, FIELD.height - 18, 12, 'rgba(120,160,190,0.5)', 'right');

    drawCrosshair(aim);
  }

  function panel(title, lines, prompt, accent) {
    const width = 660;
    const top = 170;
    const line = 32;
    const bottom = 84;
    const height = top + lines.length * line + bottom;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(8,10,22,0.82)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = `rgba(${accent},0.45)`;
    context.lineWidth = 1.5;
    context.strokeRect(x, y, width, height);
    text(title, FIELD.width / 2, y + 84, 44, '#eaf6ff', 'center', '700');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + top + i * line, 20, 'rgba(190,212,235,0.92)', 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 44, 22, '#ffd970', 'center', '700');
  }

  const TITLE_LINES = [
    'Harvest plasma from a living star while the rockfield closes in.',
    '← → / A D  rotate    ↑ / W  thrust    mouse or Space  fire',
    'Fill the WARP meter to ride the pulse deeper into the corona.',
    '',
  ];
  const OVER_LINES = ['', ''];

  function drawWarpFlash(state, t) {
    const k = state.warpFlash / 1.6;
    context.save();
    context.globalCompositeOperation = 'lighter';
    const g = context.createRadialGradient(STAR.x, STAR.y, 0, STAR.x, STAR.y, 700);
    g.addColorStop(0, rgba(255, 255, 255, 0.5 * k));
    g.addColorStop(0.5, rgba(160, 200, 255, 0.2 * k));
    g.addColorStop(1, rgba(0, 0, 0, 0));
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.restore();
  }

  function draw(state, screen, best, aim, thrust = 0) {
    const t = performance.now() / 1000;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#04040a';
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Screen shake: a decaying random offset on the playfield when damaged.
    const sx = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
    const sy = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx, view.y + sy);
    shake *= 0.86;
    if (shake < 0.2) shake = 0;

    const level = Math.max(1, state.level);
    drawStarfield(t, level);
    drawOrbitRings(t);
    drawStar(t, level);

    // Behind the ship: particles, asteroids, cores, bolts.
    for (let i = 0; i < state.asteroids.length; i += 1) {
      const a = state.asteroids[i];
      if (a.active) drawAsteroid(a, t, level);
    }
    for (let i = 0; i < state.cores.length; i += 1) {
      const c = state.cores[i];
      if (c.active) drawCore(c, t);
    }
    for (let i = 0; i < state.particles.length; i += 1) {
      const p = state.particles[i];
      if (p.active) drawParticle(p);
    }
    for (let i = 0; i < state.bolts.length; i += 1) {
      const b = state.bolts[i];
      if (b.active) drawBolt(b);
    }

    if (screen === SCREEN_TITLE) {
      // A gentle idle ship drift for the title backdrop.
      context.save();
      drawShip(t, state.player, 0);
      TITLE_LINES[3] = best > 0 ? `Best score  ${best}` : '';
      panel('HELIOPAUSE', TITLE_LINES, 'Press Space or click to launch', '255,200,120');
      return;
    }

    drawShip(t, state.player, thrust);
    drawHud(state, best, aim, t);

    if (screen === SCREEN_PAUSED) {
      panel('PAUSED', ['The star waits for you.'], 'Press P to resume', '140,200,255');
      return;
    }
    if (screen === SCREEN_OVER) {
      OVER_LINES[0] = `Final score  ${state.score}`;
      OVER_LINES[1] = best > 0 ? `Best  ${best}` : '';
      drawWarpFlash(state, t);
      panel('HULL DESTROYED', OVER_LINES, 'Press Space or click to fly again', '255,110,110');
      return;
    }
    if (state.warpFlash > 0) {
      drawWarpFlash(state, t);
      text('WARP', FIELD.width / 2, FIELD.height / 2 - 40, 60, 'rgba(255,255,255,0.9)', 'center', '700');
    }
  }

  resize();
  window.addEventListener('resize', resize);

  function toField(clientX, clientY) {
    return {
      x: (clientX - view.x) / view.scale,
      y: (clientY - view.y) / view.scale,
    };
  }

  return {
    draw,
    toField,
    addShake(mag) {
      shake = Math.min(38, shake + mag);
    },
  };
}
