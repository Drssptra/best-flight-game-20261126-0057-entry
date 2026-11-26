// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by an
// autopilot that aims at the next ring (its heading and its height, with a
// little throttle sense), so the frame is what a short game really looks like
// and the same seed always gives the same frame.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_LEVEL, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 34;
const END_LIMIT_SECONDS = 600;
const DEG = Math.PI / 180;

/**
 * Steer toward the next ring: bank to match the heading to it, pitch to
 * match its height, and keep the throttle up. `skill` is how far ahead the
 * pilot plans: the play scene's pilot looks far ahead and threads rings;
 * the end scene's plans a moment at a time and is caught out, as a hurried
 * player is.
 */
function autopilot(state, skill) {
  const p = state.plane;
  const course = state.course;
  const ring = course.rings[state.nextRing];
  const target = ring ?? { x: course.endRunway.x, y: 60, z: course.finishZ };
  const dx = target.x - p.x;
  const dz = target.z - p.z;
  const wantedHeading = Math.atan2(dx, dz) / DEG;
  let headingDiff = ((wantedHeading - p.heading + 540) % 360) - 180;
  // A clumsy pilot reacts late and over-corrects.
  headingDiff += (1 - skill) * 26 * Math.sin(state.elapsed * 0.9);
  const roll = Math.max(-1, Math.min(1, headingDiff / 34));
  const dy = target.y - p.y;
  const dist = Math.max(1, Math.sqrt(dx * dx + dz * dz));
  const wantedPitch = Math.atan2(dy, dist) / DEG;
  const pitch = Math.max(-1, Math.min(1, (wantedPitch - p.pitch) / 22));
  const throttleDelta = p.speed < 105 ? 0.6 : p.speed > 128 ? -0.6 : 0;
  return { roll, pitch, throttleDelta };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    // Taxi and lift off down the runway, then hold over the first ring line.
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world.state, 1), true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const skill = name === 'end' ? 0.35 : 1;
  for (let index = 0; index < limit / STEP; index += 1) {
    const events = world.step(STEP, autopilot(world.state, skill), false);
    if (events & EVENT_OVER) break;
    // The play scene ends mid-course, already through a few rings.
    if (name === 'play' && world.state.ringsPassed >= 4 && world.state.plane.z > world.state.course.rings[4].z + 120) break;
  }
  const over = world.state.hull === 0 || world.state.timeLeft <= 0;
  if (name === 'end' && !over) {
    // The clumsy pilot survived: keep flying it into the hills until it does not.
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state, 0.15), false);
      if (events & EVENT_OVER) break;
    }
  }
  const done = world.state.hull === 0 || world.state.timeLeft <= 0;
  return { screen: done ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}

export { FIELD, SCREEN_LEVEL };
