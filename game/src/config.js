// CLOUDGATE — Sky Ring Run. Every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Sea level is y = 0; altitudes are metres, speeds metres per second. */
export const PLANE = {
  /** m/s at full throttle, and the slowest the plane can be pushed to. */
  maxSpeed: 148,
  minSpeed: 38,
  /** m/s^2 the speed chases its throttle target. */
  accel: 14,
  /** Below this speed the wing stops lifting and the nose drops. */
  stallSpeed: 46,
  /** Degrees per second of bank authority and the hardest bank allowed. */
  rollRate: 150,
  maxBank: 62,
  /** Degrees per second the nose chases its pitch target, and the pitch limits. */
  pitchRate: 55,
  maxPitch: 38,
  minPitch: -30,
  /** Heading turns with bank: radians per second at full bank. */
  turnRate: 0.62,
  /** Metres of clearance the plane needs over the terrain. */
  clearance: 3,
};

/** Hull hits before the run ends; each crash costs one. */
export const HULL = 3;

/** Rings per level, their size, and how the course grows. */
export const COURSE = {
  baseRings: 8,
  ringsPerLevel: 2,
  /** Metres between one ring and the next. */
  ringSpacing: 380,
  /** How far the course may wander sideways from the runway line. */
  wander: 260,
  ringRadius: 30,
  ringShrinkPerLevel: 1.5,
  minRingRadius: 22,
  /** Seconds on the clock at level start, and seconds a ring adds. */
  timeBase: 150,
  timePerRing: 6,
};

export const SCORE = {
  ring: 100,
  /** Extra points for threading the centre of a ring. */
  centreBonus: 50,
  landing: 500,
  levelClear: 250,
  timeBonusPerSecond: 5,
};

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'cloudgate.best';

export const PALETTE = {
  backdrop: '#0b1526',
  skyTop: '#2f6fd0',
  skyMid: '#7db3e8',
  skyHorizon: '#cfe6f7',
  sun: '#fff3c4',
  seaDeep: '#0d4d7a',
  seaShallow: '#2f8fc4',
  sand: '#e8d29a',
  grass: '#5da24a',
  grassDark: '#3f7d38',
  rock: '#8a7f74',
  snow: '#f4f8fb',
  haze: '#cfe6f7',
  ringNext: '#ffc233',
  ringDone: '#7ddb8a',
  ringFar: '#e8f2ff',
  runway: '#3a3f47',
  runwayMark: '#f2f5f7',
  panel: 'rgba(10, 22, 40, 0.82)',
  panelEdge: '#2c4a6e',
  text: '#eef4fb',
  muted: '#9db4cc',
  amber: '#ffc233',
  cyan: '#59d6ff',
  danger: '#ff5a4e',
  good: '#7ddb8a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
