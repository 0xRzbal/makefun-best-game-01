// Keyboard and pointer input. Held keys give steering/thrust and a hold-to-fire signal; one-shot
// presses (start/restart, pause) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const FORWARD = new Set(['ArrowUp', 'KeyW']);
const BACKWARD = new Set(['ArrowDown', 'KeyS']);
const FIRE = new Set(['Space']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  let left = false;
  let right = false;
  let forward = false;
  let backward = false;
  let keyFire = false;
  let pointerFire = false;
  let actions = 0;
  const pointer = { x: 0, y: 0 };

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (FORWARD.has(event.code)) forward = true;
    else if (BACKWARD.has(event.code)) backward = true;
    else if (FIRE.has(event.code)) keyFire = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (FORWARD.has(event.code)) forward = false;
    else if (BACKWARD.has(event.code)) backward = false;
    else if (FIRE.has(event.code)) keyFire = false;
  });

  window.addEventListener('blur', () => {
    left = right = forward = backward = keyFire = pointerFire = false;
  });

  window.addEventListener('mousemove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  window.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      pointerFire = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      actions |= ACTION_CONFIRM;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) pointerFire = false;
  });
  // Let go if the pointer leaves the window.
  window.addEventListener('pointerleave', () => {
    pointerFire = false;
  });
  target.addEventListener('pointerdown', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });

  return {
    pointer,
    turn() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    thrust() {
      return (forward ? 1 : 0) - (backward ? 1 : 0);
    },
    fire() {
      return keyFire || pointerFire;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
