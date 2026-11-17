// Heliopause — central tuning numbers. The playfield is a fixed 1280x720 logical area; the
// renderer scales it to the window, so no rule here depends on the screen size.

export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const STAR = { x: 640, y: 360, r: 92 };

export const PLAYER = {
  radius: 13,
  thrust: 1000,
  rotSpeed: 4.7,
  drag: 0.88,
  maxSpeed: 2700,
  fireCd: 0.15,
  boltSpeed: 1380,
  boltLife: 0.8,
  boltR: 6,
};

export const HULL = 3;
export const INVULN = 1.3;
export const REGEN_DELAY = 2.8;
export const REGEN_INTERVAL = 3.6;

export const GRAV_GM = 2.4e7;
export const GRAV_MAX = 3000;

export const COMBO_WINDOW = 3;

export const ASTEROID = {
  pool: 44,
  minR: 16,
  maxR: 52,
  spawnIntervalBase: 1.6,
  spawnIntervalScale: 0.9,
  speedMin: 55,
  speedMax: 170,
  sizePerLevel: 2.4,
  spin: 2.2,
};

export const CORE = {
  pool: 24,
  value: 22,
  magnetRange: 200,
  magnetPower: 1500,
  drift: 64,
};

export const BOLT = { pool: 48 };
export const PARTICLE = { pool: 340 };

/** Plasma energy needed to charge a warp to the next orbit. */
export const WARP_ENERGY = 100;
export const MAX_LEVEL = 30;

/** Each orbit has a name, a nebula tint and a hazard tint; the list cycles. */
export const LEVEL_COLORS = [
  { name: 'HELIOS', nebula: '255,146,64', hazard: '255,120,90' },
  { name: 'PULSAR', nebula: '112,158,255', hazard: '120,150,255' },
  { name: 'TRISTAR', nebula: '190,140,255', hazard: '210,150,255' },
  { name: 'EMBER', nebula: '255,110,110', hazard: '255,110,110' },
  { name: 'VERDANT', nebula: '96,224,160', hazard: '120,230,180' },
  { name: 'VOID', nebula: '96,180,255', hazard: '130,200,255' },
];

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'heliopause.best';

/** Font stack for all in-game text (system fonts, no downloads). */
export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
