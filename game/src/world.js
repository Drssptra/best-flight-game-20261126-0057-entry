// The game's rules and state, with no drawing and no browser in it: the
// plane's flight model, the ring course, terrain and water collisions,
// scoring, the clock, hull and levels. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound.
import { COURSE, HULL, PLANE, SCORE } from './config.js';
import { buildCourse, terrainHeight } from './terrain.js';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_OVER = 4;
export const EVENT_LEVEL = 8;
export const EVENT_LAND = 16;
export const EVENT_WARN = 32;

const DEG = Math.PI / 180;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createWorld(seed) {
  const state = {
    level: 1,
    score: 0,
    hull: HULL,
    timeLeft: 0,
    elapsed: 0,
    ringsPassed: 0,
    ringsTotal: 0,
    course: null,
    plane: {
      x: 0, y: 0, z: 0,
      heading: 0, pitch: 0, bank: 0,
      speed: 0, throttle: 0.55,
      verticalSpeed: 0, grounded: true,
    },
    // Smoothed camera chase values, kept here so the renderer only reads.
    camera: { x: 0, y: 12, z: -30, heading: 0, pitch: 0, bank: 0 },
    nextRing: 0,
    invulnerable: 0,
    landed: false,
    finished: false,
    shake: 0,
    flash: 0,
    message: '',
    messageTimer: 0,
    lowTerrain: false,
    stalling: false,
  };

  function resetLevel(level) {
    const course = buildCourse(level, seed);
    state.course = course;
    state.level = level;
    state.ringsTotal = course.rings.length;
    state.ringsPassed = 0;
    state.nextRing = 0;
    state.timeLeft = course.timeLimit;
    state.landed = false;
    state.finished = false;
    const runway = course.startRunway;
    const p = state.plane;
    p.x = runway.x;
    p.y = 1.2;
    p.z = runway.z + 30;
    p.heading = 0;
    p.pitch = 0;
    p.bank = 0;
    p.speed = 0;
    p.throttle = 0.55;
    p.verticalSpeed = 0;
    p.grounded = true;
    state.camera.x = p.x;
    state.camera.y = 10;
    state.camera.z = p.z - 30;
    state.camera.heading = 0;
    state.camera.pitch = 0;
    state.camera.bank = 0;
    state.invulnerable = 0;
    state.message = level === 1 ? '' : `LEVEL ${level} — FLY THE RINGS`;
    state.messageTimer = level === 1 ? 0 : 2.5;
  }

  function reset() {
    state.score = 0;
    state.hull = HULL;
    state.elapsed = 0;
    state.flash = 0;
    state.shake = 0;
    resetLevel(1);
  }

  function respawn() {
    const p = state.plane;
    const course = state.course;
    const ring = state.nextRing > 0 ? course.rings[state.nextRing - 1] : null;
    if (ring) {
      p.x = ring.x;
      p.y = ring.y + 25;
      p.z = ring.z - 120;
    } else {
      p.x = course.startRunway.x;
      p.y = 90;
      p.z = course.startRunway.z + 120;
    }
    p.heading = 0;
    p.pitch = 0;
    p.bank = 0;
    p.speed = 72;
    p.throttle = 0.6;
    p.verticalSpeed = 0;
    p.grounded = false;
    state.camera.x = p.x;
    state.camera.y = p.y + 8;
    state.camera.z = p.z - 30;
    state.invulnerable = 3;
    state.message = 'BACK IN THE AIR';
    state.messageTimer = 1.6;
  }

  /**
   * One fixed step. `control` is { roll, pitch, throttleDelta } with roll and
   * pitch in [-1, 1]. With `harmless` set (the title screen's backdrop) the
   * plane taxis and lifts off on its own and nothing can hurt it.
   */
  function step(dt, control, harmless) {
    let events = 0;
    const p = state.plane;
    const course = state.course;
    state.elapsed += dt;
    if (state.invulnerable > 0) state.invulnerable = Math.max(0, state.invulnerable - dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.4);
    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
      if (state.messageTimer <= 0) state.message = '';
    }

    if (!harmless && !state.finished) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.hull = 0;
        return EVENT_OVER;
      }
    }

    // --- flight model -------------------------------------------------
    const targetBank = control.roll * PLANE.maxBank;
    const bankRate = PLANE.rollRate * dt;
    p.bank += clamp(targetBank - p.bank, -bankRate, bankRate);
    const targetPitch = control.pitch * PLANE.maxPitch;
    const pitchRate = PLANE.pitchRate * dt;
    p.pitch += clamp(targetPitch - p.pitch, -pitchRate, pitchRate);
    if (control.throttleDelta !== 0) {
      p.throttle = clamp(p.throttle + control.throttleDelta * dt, 0, 1);
    }
    const targetSpeed = PLANE.minSpeed + p.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    const speedRate = PLANE.accel * dt;
    p.speed += clamp(targetSpeed - p.speed, -speedRate, speedRate);

    // The nose turns with the bank; a level plane flies straight.
    p.heading += (p.bank * DEG) * PLANE.turnRate * dt * (p.speed / PLANE.maxSpeed + 0.25);

    const pitchRad = p.pitch * DEG;
    const headingRad = p.heading * DEG;
    let verticalSpeed = p.speed * Math.sin(pitchRad);
    // Below stall speed the wing quits and the nose drops.
    state.stalling = p.speed < PLANE.stallSpeed && !p.grounded;
    if (state.stalling) verticalSpeed -= (PLANE.stallSpeed - p.speed) * 0.55;
    p.verticalSpeed = verticalSpeed;

    const forwardX = Math.sin(headingRad) * Math.cos(pitchRad);
    const forwardZ = Math.cos(headingRad) * Math.cos(pitchRad);
    p.x += forwardX * p.speed * dt;
    p.z += forwardZ * p.speed * dt;
    p.y += verticalSpeed * dt;

    // The ground holds the plane on the runway until it is fast enough.
    const ground = terrainHeight(p.x, p.z, course);
    if (p.grounded) {
      p.y = Math.max(ground + 1.2, 1.2);
      if (p.speed > 62 && p.pitch > 4) {
        p.grounded = false;
        if (!harmless) {
          state.message = 'AIRBORNE';
          state.messageTimer = 1.4;
        }
      }
    } else if (p.y < ground + PLANE.clearance) {
      // --- terrain or water ------------------------------------------------
      if (harmless || state.invulnerable > 0) {
        p.y = ground + PLANE.clearance;
        p.pitch = Math.max(p.pitch, 6);
      } else {
        state.hull -= 1;
        state.shake = 1;
        state.flash = 1;
        events |= EVENT_CRASH;
        if (state.hull <= 0) return events | EVENT_OVER;
        respawn();
        return events;
      }
    }

    // --- rings ----------------------------------------------------------
    const ring = course.rings[state.nextRing];
    if (ring && !state.finished) {
      const prevZ = p.z - forwardZ * p.speed * dt;
      const crossed = prevZ < ring.z && p.z >= ring.z;
      if (crossed) {
        const dx = p.x - ring.x;
        const dy = p.y - ring.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < ring.radius) {
          ring.passed = true;
          const centre = 1 - dist / ring.radius;
          const bonus = Math.round(centre * SCORE.centreBonus);
          state.score += SCORE.ring + bonus;
          state.ringsPassed += 1;
          state.nextRing += 1;
          state.timeLeft += COURSE.timePerRing;
          state.message = bonus >= 40 ? `RING! CENTRE +${SCORE.ring + bonus}` : `RING! +${SCORE.ring + bonus}`;
          state.messageTimer = 1.4;
          events |= EVENT_RING;
        } else {
          // Flew past the ring: it stays lit, and the next one lights up.
          state.nextRing += 1;
          state.message = 'RING MISSED';
          state.messageTimer = 1.2;
        }
      }
    }

    // --- landing on the far runway ---------------------------------------
    const runway = course.endRunway;
    const half = runway.length / 2;
    const cz = runway.z + half;
    if (!state.landed && !p.grounded && !state.finished
      && Math.abs(p.x - runway.x) < runway.width / 2 - 4
      && p.z > cz - half && p.z < cz + half
      && p.y < terrainHeight(p.x, p.z, course) + 6 && p.speed < 95) {
      state.landed = true;
      state.score += SCORE.landing;
      state.message = `TOUCHDOWN! +${SCORE.landing}`;
      state.messageTimer = 2;
      p.grounded = true;
      p.pitch = 0;
      events |= EVENT_LAND;
    }

    // --- level complete ---------------------------------------------------
    if (!state.finished && state.nextRing >= course.rings.length && p.z > course.finishZ + 120) {
      state.finished = true;
      const timeBonus = Math.round(state.timeLeft) * SCORE.timeBonusPerSecond;
      state.score += SCORE.levelClear + timeBonus;
      events |= EVENT_LEVEL;
    }

    // --- warnings ---------------------------------------------------------
    const aheadGround = terrainHeight(p.x + forwardX * 90, p.z + forwardZ * 90, course);
    state.lowTerrain = !p.grounded && p.y - aheadGround < 26 && p.verticalSpeed <= 2;

    // --- chase camera ------------------------------------------------------
    const cam = state.camera;
    const camDist = 30;
    const camHeight = 9;
    const targetCamX = p.x - forwardX * camDist;
    const targetCamY = p.y + camHeight - Math.sin(pitchRad) * 6;
    const targetCamZ = p.z - forwardZ * camDist;
    const follow = Math.min(1, dt * 4.5);
    cam.x += (targetCamX - cam.x) * follow;
    cam.y += (targetCamY - cam.y) * follow;
    cam.z += (targetCamZ - cam.z) * follow;
    cam.heading += (p.heading - cam.heading) * Math.min(1, dt * 3.2);
    cam.pitch += (p.pitch * 0.55 - cam.pitch) * Math.min(1, dt * 3.2);
    cam.bank += (p.bank * 0.3 - cam.bank) * Math.min(1, dt * 3.2);

    return events;
  }

  reset();
  return { state, reset, resetLevel, step };
}
