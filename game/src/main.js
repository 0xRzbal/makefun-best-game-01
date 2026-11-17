// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the run. ?shot=title|play|warp|end (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, HULL, STAR, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_CORE, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_WARP } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* private window: best lasts this visit only */
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const aim = (name === 'play' || name === 'warp') ? { x: world.state.player.x + 190, y: world.state.player.y - 120 } : null;
  const thrust = (name === 'play' || name === 'warp') ? 1 : 0;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, aim, thrust);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let prevCombo = 0;
  const aim = { x: STAR.x + 220, y: STAR.y - 120 };
  let muted = false;

  function announce(message) {
    status.textContent = message;
  }

  function handleMute() {
    muted = !muted;
    audio.setMuted(muted);
    announce(muted ? 'Muted.' : 'Sound on.');
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM') handleMute();
  });

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    prevCombo = 0;
    announce(`Flying. ${HULL} hull.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Hull destroyed. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if ((actions & ACTION_CONFIRM) && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if ((actions & ACTION_PAUSE) && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if ((actions & (ACTION_PAUSE | ACTION_CONFIRM)) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function stepSim() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { turn: 0, thrust: 0, fire: false, tx: 0, ty: 0 });
      return;
    }
    const field = renderer.toField(input.pointer.x, input.pointer.y);
    aim.x = field.x;
    aim.y = field.y;
    const events = world.step(STEP, {
      turn: input.turn(),
      thrust: input.thrust(),
      fire: input.fire(),
      tx: aim.x,
      ty: aim.y,
    });
    if (events & EVENT_OVER) {
      endGame();
      audio.over();
      return;
    }
    if (events & EVENT_WARP) {
      audio.warp();
      announce(`Warp. Orbit ${world.state.level}.`);
    }
    if (events & EVENT_HIT) {
      audio.hit();
      announce(`Hit. ${world.state.player.hull} hull left.`);
    }
    if (events & EVENT_KILL) {
      audio.explosion(48);
      if (world.state.combo > prevCombo && world.state.combo > 1) audio.comboUp(world.state.combo);
    }
    if (events & EVENT_CORE) audio.pickup();
    prevCombo = world.state.combo;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepSim();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const thrust = screen === SCREEN_PLAY ? input.thrust() : 0;
    renderer.draw(world.state, screen, best, screen === SCREEN_PLAY ? aim : null, thrust);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Heliopause. Press Space or click to launch. M toggles sound.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
