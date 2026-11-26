// Keyboard and mouse input. Held keys give a steering direction; one-shot
// presses (start or restart, pause, mute) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never
// counted twice. The mouse steers too: where the pointer sits relative to
// the centre of the screen is the bank and pitch the pilot is asking for,
// which is how the game is played with mouse alone.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight', 'Equal', 'NumpadAdd']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight', 'Minus', 'NumpadSubtract']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let throttleUp = false;
  let throttleDown = false;
  let actions = 0;
  // Pointer position in logical-field coordinates; null until the mouse moves.
  let pointer = null;
  let pointerActive = false;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (THROTTLE_UP.has(event.code)) throttleUp = true;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (THROTTLE_UP.has(event.code)) throttleUp = false;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
    throttleUp = false;
    throttleDown = false;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    pointer = {
      x: ((event.clientX - rect.left) / rect.width) * FIELD.width,
      y: ((event.clientY - rect.top) / rect.height) * FIELD.height,
    };
    pointerActive = true;
  });
  target.addEventListener('pointerdown', (event) => {
    actions |= ACTION_CONFIRM;
    const rect = target.getBoundingClientRect();
    pointer = {
      x: ((event.clientX - rect.left) / rect.width) * FIELD.width,
      y: ((event.clientY - rect.top) / rect.height) * FIELD.height,
    };
    pointerActive = true;
  });
  target.addEventListener('pointerleave', () => {
    pointerActive = false;
  });

  return {
    /** Steering in [-1, 1] for roll (left/right) and pitch (climb/descend). */
    control() {
      let roll = (right ? 1 : 0) - (left ? 1 : 0);
      let pitch = (up ? 1 : 0) - (down ? 1 : 0);
      // The mouse takes over only while no steering key is held, so the two
      // never fight: keys win, the pointer fills in the rest.
      if (roll === 0 && pitch === 0 && pointerActive && pointer) {
        const dx = (pointer.x - FIELD.width / 2) / (FIELD.width / 2);
        const dy = (pointer.y - FIELD.height * 0.55) / (FIELD.height * 0.55);
        const dead = 0.08;
        roll = Math.abs(dx) < dead ? 0 : Math.max(-1, Math.min(1, (dx - Math.sign(dx) * dead) / (1 - dead)));
        pitch = Math.abs(dy) < dead ? 0 : Math.max(-1, Math.min(1, -(dy - Math.sign(dy) * dead) / (1 - dead)));
      }
      const throttleDelta = (throttleUp ? 0.55 : 0) - (throttleDown ? 0.55 : 0);
      return { roll, pitch, throttleDelta };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
