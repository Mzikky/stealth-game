// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area (32 by 18 tiles of 40 px); the renderer scales it to the window, so no rule below
// depends on the screen size.

export const FIELD = { width: 1280, height: 720 };
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many times the thief can be caught before the night is over. */
export const LIVES = 3;
/** Distraction coins the thief carries into each level. */
export const COINS = 3;

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  sneakSpeed: 100,
  /** How close a chasing guard must get to catch the thief. */
  catchRadius: 26,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 82,
  suspiciousSpeed: 118,
  chaseSpeed: 196,
  /** How far a guard can see, in pixels. */
  viewDistance: 250,
  /** Half of the vision cone's angle, in radians (about 35 degrees each side). */
  viewHalfAngle: 0.61,
  /** Seconds a guard waits at each patrol waypoint, looking around. */
  waitAtWaypoint: 0.9,
  /** Seconds of chasing without seeing the thief before giving up the chase. */
  chaseMemory: 2.5,
  /** How close a guard must be to spot the thief hiding in a bush. */
  bushSpotDistance: 95,
};

/** The detection meter: 0 is unseen, 0.45 is suspicious, 1 is the alarm. */
export const DETECT = {
  suspiciousAt: 0.45,
  /** Base fill per second at point-blank range, walking, in the light. */
  fillPerSecond: 1.15,
  decayPerSecond: 0.5,
  /** Multipliers on how fast the meter fills. */
  sneakFactor: 0.45,
  shadowFactor: 0.55,
  bushFactor: 0.2,
  /** How far the meter's fill falls off with distance (1 at touch, 0.25 at full view range). */
  farFactor: 0.25,
};

/** Noise: walking is heard nearby, sneaking is silent, a tossed coin clinks far. */
export const NOISE = {
  walkRadius: 150,
  walkEvery: 0.35,
  coinRadius: 340,
  coinThrow: 190,
};

export const SCORE = {
  loot: 100,
  relic: 500,
  levelClear: 250,
  ghostBonus: 300,
  caughtPenalty: 100,
};

export const PALETTE = {
  backdrop: '#070a12',
  floorA: '#1a2030',
  floorB: '#161c2a',
  shadowFloor: '#0f1523',
  wall: '#2e3a52',
  wallTop: '#4a5d80',
  bush: '#14301f',
  bushLeaf: '#1f4d2e',
  player: '#4fd1c5',
  playerDark: '#2a8a82',
  guard: '#e5534b',
  guardDark: '#8f2f2a',
  conePatrol: 'rgba(242, 201, 76, 0.10)',
  coneSuspicious: 'rgba(242, 140, 60, 0.16)',
  coneChase: 'rgba(229, 83, 75, 0.22)',
  coneEdge: 'rgba(242, 201, 76, 0.35)',
  relic: '#ffd75e',
  loot: '#f2c94c',
  exit: '#58d68d',
  exitLocked: '#3a5a48',
  text: '#eef1f5',
  muted: '#8b93a3',
  panel: '#1c2333',
  danger: '#e5534b',
  warn: '#f28c3c',
  ok: '#58d68d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nightshade.best';
