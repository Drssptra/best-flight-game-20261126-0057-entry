// The world the plane flies over: an island archipelago over a sea, a
// winding course of rings, and a runway at each end of the course. All of it
// is a pure function of the seed and the level, so a screenshot seed replays
// the same islands every time.
import { COURSE, PLANE } from './config.js';
import { createRandom, fbm, smoothstep, valueNoise } from './random.js';

const NOISE_SEED = 1337;

/**
 * The course centreline: the x of the course at a given z, interpolated
 * between ring positions, so the terrain can be flattened under the flight
 * path and the renderer knows where the runway sits.
 */
function courseXAt(z, rings) {
  if (rings.length === 0) return 0;
  if (z <= rings[0].z) return rings[0].x;
  for (let i = 1; i < rings.length; i += 1) {
    if (z <= rings[i].z) {
      const a = rings[i - 1];
      const b = rings[i];
      const t = (z - a.z) / (b.z - a.z);
      return a.x + (b.x - a.x) * t;
    }
  }
  return rings[rings.length - 1].x;
}

/** Build one level's course: rings, runways and the scenery that goes with it. */
export function buildCourse(level, seed) {
  const random = createRandom(seed * 7919 + level * 104729);
  const ringCount = COURSE.baseRings + COURSE.ringsPerLevel * (level - 1);
  const radius = Math.max(COURSE.minRingRadius, COURSE.ringRadius - COURSE.ringShrinkPerLevel * (level - 1));
  const rings = [];
  // The course wanders with a slow noise so it reads as a real route, never
  // a straight line, and its height rises and falls gently.
  const wanderPhase = random() * 100;
  const heightPhase = random() * 100;
  for (let i = 0; i < ringCount; i += 1) {
    const z = 420 + i * COURSE.ringSpacing;
    const x = valueNoise(wanderPhase, i * 0.55, 77) * COURSE.wander;
    const y = 95 + valueNoise(heightPhase, i * 0.42, 55) * 55;
    rings.push({ x, y, z, radius, passed: false, best: 0 });
  }
  const last = rings[rings.length - 1];
  const finishZ = last.z + 520;
  const startRunway = { x: 0, z: 0, length: 300, width: 46, heading: 0 };
  const endRunway = { x: last.x, z: finishZ, length: 300, width: 46, heading: 0 };
  const timeLimit = COURSE.timeBase + ringCount * COURSE.timePerRing;

  // Distant peaks far beyond the terrain grid, for the horizon's depth.
  const peaks = [];
  for (let i = 0; i < 10; i += 1) {
    peaks.push({
      x: (random() - 0.5) * 5200,
      z: 1400 + random() * 2200,
      height: 260 + random() * 420,
      width: 500 + random() * 700,
    });
  }
  // Clouds drift over the course at flying height and above.
  const clouds = [];
  for (let i = 0; i < 34; i += 1) {
    clouds.push({
      x: (random() - 0.5) * 2600,
      y: 210 + random() * 260,
      z: -300 + random() * (finishZ + 900),
      scale: 60 + random() * 130,
      drift: 2 + random() * 4,
    });
  }
  return { level, rings, radius, startRunway, endRunway, finishZ, timeLimit, peaks, clouds, seed };
}

/** Terrain height in metres at (x, z); sea level is 0, land rises above it. */
export function terrainHeight(x, z, course) {
  // Large-scale noise decides where the islands are.
  const island = fbm(x * 0.00042, z * 0.00042, NOISE_SEED, 3);
  const land = smoothstep(0.02, 0.3, island);
  // Small-scale noise gives the islands their hills.
  const hills = fbm(x * 0.0021, z * 0.0021, NOISE_SEED + 7, 3);
  let height = land * (14 + 150 * Math.max(0, hills * 0.5 + 0.5));
  // Keep the flight corridor flyable: flatten the ground under the course
  // so no ring ever sits inside a hill.
  if (course) {
    const cx = courseXAt(z, course.rings);
    const dist = Math.abs(x - cx);
    const flat = 0.3 + 0.7 * smoothstep(90, 320, dist);
    height *= flat;
    // The runways sit on flat reclaimed ground at the water's edge.
    for (const runway of [course.startRunway, course.endRunway]) {
      const dz = Math.abs(z - runway.z - runway.length / 2);
      const dx = Math.abs(x - runway.x);
      if (dz < runway.length / 2 + 60 && dx < runway.width / 2 + 70) {
        const near = smoothstep(1, 0, Math.max(dz / (runway.length / 2 + 60), dx / (runway.width / 2 + 70)));
        height *= 1 - 0.95 * near;
      }
    }
  }
  return height;
}

/** What the ground looks like at a height, for the renderer's colouring. */
export function groundKind(height) {
  if (height < 1.5) return 'water';
  if (height < 7) return 'sand';
  if (height < 95) return 'grass';
  if (height < 150) return 'rock';
  return 'snow';
}

/** The runway the plane starts on, and the one at the far end. */
export function runwayCorners(runway) {
  const hw = runway.width / 2;
  const half = runway.length / 2;
  const cz = runway.z + half;
  return [
    { x: runway.x - hw, y: 0.6, z: cz - half },
    { x: runway.x + hw, y: 0.6, z: cz - half },
    { x: runway.x + hw, y: 0.6, z: cz + half },
    { x: runway.x - hw, y: 0.6, z: cz + half },
  ];
}

export { PLANE };
