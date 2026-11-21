// The game's rules and state, with no drawing and no browser in it: the thief, the guards
// and their vision cones, detection, noise, loot, the relic and the exit. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound. Sounds the step produced are queued on state.sounds
// for the caller to play. Nothing here allocates after createWorld returns.

import { COLS, DETECT, FIELD, GUARD, LIVES, COINS, NOISE, PLAYER, ROWS, SCORE, TILE } from './config.js';
import { LEVELS } from './levels.js';

export const EVENT_LOOT = 1;
export const EVENT_RELIC = 2;
export const EVENT_ALERT = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_CLEAR = 16;
export const EVENT_WIN = 32;

const TAU = Math.PI * 2;

function tileCenter(c, r) {
  return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
}

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    grid: [],
    player: { x: 0, y: 0, radius: PLAYER.radius, faceX: 0, faceY: 1, sneaking: false, moving: false },
    guards: [],
    loot: [],
    relic: { x: 0, y: 0, taken: false },
    exit: { x: 0, y: 0, open: false },
    coins: [],
    pulses: [],
    sounds: [],
    lives: LIVES,
    score: 0,
    levelScore: 0,
    coinsLeft: COINS,
    time: 0,
    levelTime: 0,
    ghost: true,
    alarm: false,
    maxMeter: 0,
    status: 'playing',
  };

  function tileAt(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '#';
    return state.grid[r][c];
  }

  function isWall(c, r) {
    return tileAt(c, r) === '#';
  }

  function tileOf(x, y) {
    return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
  }

  function inBush(x, y) {
    const t = tileOf(x, y);
    return tileAt(t.c, t.r) === 'B';
  }

  function inShadow(x, y) {
    const t = tileOf(x, y);
    return tileAt(t.c, t.r) === 'S';
  }

  /** True when a wall blocks the straight line from (x0,y0) to (x1,y1). */
  function blocked(x0, y0, x1, y1) {
    const minC = Math.max(0, Math.floor(Math.min(x0, x1) / TILE));
    const maxC = Math.min(COLS - 1, Math.floor(Math.max(x0, x1) / TILE));
    const minR = Math.max(0, Math.floor(Math.min(y0, y1) / TILE));
    const maxR = Math.min(ROWS - 1, Math.floor(Math.max(y0, y1) / TILE));
    const dx = x1 - x0;
    const dy = y1 - y0;
    for (let r = minR; r <= maxR; r += 1) {
      for (let c = minC; c <= maxC; c += 1) {
        if (!isWall(c, r)) continue;
        // Segment vs axis-aligned tile, slab test.
        const left = c * TILE;
        const right = left + TILE;
        const top = r * TILE;
        const bottom = top + TILE;
        let t0 = 0;
        let t1 = 1;
        if (dx === 0) {
          if (x0 < left || x0 > right) continue;
        } else {
          const inv = 1 / dx;
          let ta = (left - x0) * inv;
          let tb = (right - x0) * inv;
          if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
          if (t0 > t1) continue;
        }
        if (dy === 0) {
          if (y0 < top || y0 > bottom) continue;
        } else {
          const inv = 1 / dy;
          let ta = (top - y0) * inv;
          let tb = (bottom - y0) * inv;
          if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
          if (t0 > t1) continue;
        }
        return true;
      }
    }
    return false;
  }

  /** Move a circle by (dx, dy), sliding along walls, one axis at a time. */
  function moveCircle(body, dx, dy) {
    const radius = body.radius;
    let x = body.x + dx;
    let y = body.y;
    if (circleHitsWall(x, y, radius)) x = body.x;
    y = body.y + dy;
    if (circleHitsWall(x, y, radius)) y = body.y;
    body.x = x;
    body.y = y;
  }

  function circleHitsWall(x, y, radius) {
    const minC = Math.floor((x - radius) / TILE);
    const maxC = Math.floor((x + radius) / TILE);
    const minR = Math.floor((y - radius) / TILE);
    const maxR = Math.floor((y + radius) / TILE);
    for (let r = minR; r <= maxR; r += 1) {
      for (let c = minC; c <= maxC; c += 1) {
        if (!isWall(c, r)) continue;
        const nearestX = Math.max(c * TILE, Math.min(x, c * TILE + TILE));
        const nearestY = Math.max(r * TILE, Math.min(y, r * TILE + TILE));
        const ddx = x - nearestX;
        const ddy = y - nearestY;
        if (ddx * ddx + ddy * ddy < radius * radius) return true;
      }
    }
    return false;
  }

  function makeGuard(waypoints) {
    const start = tileCenter(waypoints[0][0], waypoints[0][1]);
    const next = tileCenter(waypoints[1][0], waypoints[1][1]);
    return {
      x: start.x,
      y: start.y,
      radius: GUARD.radius,
      angle: Math.atan2(next.y - start.y, next.x - start.x),
      state: 'patrol',
      waypoints,
      waypointIndex: 1,
      wait: 0,
      scanBase: 0,
      meter: 0,
      lastSeenX: start.x,
      lastSeenY: start.y,
      investigateX: start.x,
      investigateY: start.y,
      loseTimer: 0,
      stepTimer: random() * 0.4,
      moving: false,
    };
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.grid = level.map.map((row) => row.split(''));
    state.guards = [];
    state.loot = [];
    state.coins = [];
    state.pulses = [];
    state.coinsLeft = COINS;
    state.levelTime = 0;
    state.levelScore = 0;
    state.ghost = true;
    state.alarm = false;
    state.maxMeter = 0;
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const ch = state.grid[r][c];
        const at = tileCenter(c, r);
        if (ch === 'P') {
          state.player.x = at.x;
          state.player.y = at.y;
          state.player.faceX = 0;
          state.player.faceY = 1;
        } else if (ch === 'R') {
          state.relic = { x: at.x, y: at.y, taken: false };
        } else if (ch === 'E') {
          state.exit = { x: at.x, y: at.y, open: false };
        } else if (ch === 'o') {
          state.loot.push({ x: at.x, y: at.y, taken: false });
        }
      }
    }
    for (const patrol of level.patrols) state.guards.push(makeGuard(patrol));
    state.status = 'playing';
  }

  function resetRun() {
    state.lives = LIVES;
    state.score = 0;
    state.time = 0;
    loadLevel(0);
  }

  /** How visible the thief is to this guard right now: 0 means not seen at all. */
  function visibility(guard) {
    const player = state.player;
    const dx = player.x - guard.x;
    const dy = player.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GUARD.viewDistance) return 0;
    const toPlayer = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(toPlayer, guard.angle)) > GUARD.viewHalfAngle) return 0;
    if (blocked(guard.x, guard.y, player.x, player.y)) return 0;
    const hidden = inBush(player.x, player.y);
    if (hidden && dist > GUARD.bushSpotDistance) return DETECT.bushFactor * 0.2;
    let factor = 1 - (1 - DETECT.farFactor) * (dist / GUARD.viewDistance);
    if (player.sneaking) factor *= DETECT.sneakFactor;
    if (inShadow(player.x, player.y)) factor *= DETECT.shadowFactor;
    if (hidden) factor *= DETECT.bushFactor;
    return factor;
  }

  function alertGuards() {
    state.alarm = true;
    state.ghost = false;
    for (const guard of state.guards) {
      if (guard.state === 'chase') continue;
      guard.state = 'suspicious';
      guard.meter = Math.max(guard.meter, 0.6);
      guard.investigateX = state.player.x;
      guard.investigateY = state.player.y;
      guard.wait = 0;
    }
  }

  function stepGuard(guard, dt, harmless) {
    const player = state.player;
    let seen = 0;
    if (!harmless) {
      seen = visibility(guard);
      if (seen > 0) {
        guard.meter = Math.min(1, guard.meter + DETECT.fillPerSecond * seen * dt);
        guard.lastSeenX = player.x;
        guard.lastSeenY = player.y;
      } else {
        guard.meter = Math.max(0, guard.meter - DETECT.decayPerSecond * dt);
      }
      if (guard.meter >= 1 && guard.state !== 'chase') {
        guard.state = 'chase';
        guard.loseTimer = 0;
        state.sounds.push({ kind: 'alert' });
        alertGuards();
        return EVENT_ALERT;
      }
      if (guard.meter >= DETECT.suspiciousAt && guard.state === 'patrol') {
        guard.state = 'suspicious';
        guard.investigateX = guard.lastSeenX;
        guard.investigateY = guard.lastSeenY;
        guard.wait = 0;
      }
    }

    let targetX = guard.x;
    let targetY = guard.y;
    let speed = 0;
    guard.moving = false;

    if (guard.state === 'patrol') {
      if (guard.wait > 0) {
        guard.wait -= dt;
        guard.angle = guard.scanBase + Math.sin((GUARD.waitAtWaypoint - guard.wait) * 2.4) * 0.6;
      } else {
        const wp = tileCenter(guard.waypoints[guard.waypointIndex][0], guard.waypoints[guard.waypointIndex][1]);
        targetX = wp.x;
        targetY = wp.y;
        speed = GUARD.patrolSpeed;
        if (Math.hypot(wp.x - guard.x, wp.y - guard.y) < 6) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          guard.wait = GUARD.waitAtWaypoint;
          guard.scanBase = guard.angle;
        }
      }
      // A guard that half-sees the thief turns to look.
      if (seen > 0 && guard.meter > 0.2) {
        guard.angle = Math.atan2(player.y - guard.y, player.x - guard.x);
      }
    } else if (guard.state === 'suspicious') {
      targetX = guard.investigateX;
      targetY = guard.investigateY;
      speed = GUARD.suspiciousSpeed;
      if (Math.hypot(targetX - guard.x, targetY - guard.y) < 8) {
        guard.wait += dt;
        guard.angle = guard.scanBase + Math.sin(guard.wait * 2.2) * 0.9;
        if (guard.wait > 2.2) {
          guard.state = 'return';
          guard.wait = 0;
        }
      } else {
        guard.scanBase = guard.angle;
      }
    } else if (guard.state === 'chase') {
      targetX = player.x;
      targetY = player.y;
      speed = GUARD.chaseSpeed;
      if (seen > 0) guard.loseTimer = 0;
      else guard.loseTimer += dt;
      if (guard.loseTimer > GUARD.chaseMemory) {
        guard.state = 'suspicious';
        guard.investigateX = guard.lastSeenX;
        guard.investigateY = guard.lastSeenY;
        guard.wait = 0;
      }
      if (Math.hypot(player.x - guard.x, player.y - guard.y) < PLAYER.catchRadius + guard.radius - 4) {
        return EVENT_CAUGHT;
      }
    } else if (guard.state === 'return') {
      // Walk back to the nearest waypoint, then resume the patrol.
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < guard.waypoints.length; i += 1) {
        const wp = tileCenter(guard.waypoints[i][0], guard.waypoints[i][1]);
        const d = Math.hypot(wp.x - guard.x, wp.y - guard.y);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      const wp = tileCenter(guard.waypoints[best][0], guard.waypoints[best][1]);
      targetX = wp.x;
      targetY = wp.y;
      speed = GUARD.patrolSpeed;
      if (bestDist < 8) {
        guard.state = 'patrol';
        guard.waypointIndex = (best + 1) % guard.waypoints.length;
        guard.wait = GUARD.waitAtWaypoint;
        guard.scanBase = guard.angle;
      }
    }

    if (speed > 0) {
      const dx = targetX - guard.x;
      const dy = targetY - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        const step = Math.min(dist, speed * dt);
        const nx = (dx / dist) * step;
        const ny = (dy / dist) * step;
        moveCircle(guard, nx, ny);
        guard.angle = Math.atan2(dy, dx);
        guard.moving = true;
        guard.stepTimer -= dt;
        if (guard.stepTimer <= 0) {
          guard.stepTimer = 0.45;
          const pd = Math.hypot(player.x - guard.x, player.y - guard.y);
          state.sounds.push({ kind: 'step', volume: Math.max(0, 1 - pd / 520) });
        }
      }
    }
    return 0;
  }

  let noiseTimer = 0;
  let playerStepTimer = 0;

  /**
   * One fixed step. `input` is { mx, my, sneak, toss }. With `harmless` set (the title
   * screen's backdrop) the guards patrol but nothing is seen, stolen or caught.
   */
  function step(dt, input, harmless) {
    let events = 0;
    const player = state.player;
    state.time += dt;
    state.levelTime += dt;

    // --- the thief moves ---
    const mag = Math.hypot(input.mx, input.my);
    const nx = mag > 0 ? input.mx / mag : 0;
    const ny = mag > 0 ? input.my / mag : 0;
    player.moving = mag > 0;
    player.sneaking = !!input.sneak;
    if (mag > 0) {
      player.faceX = nx;
      player.faceY = ny;
      const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      moveCircle(player, nx * speed * dt, ny * speed * dt);
      playerStepTimer -= dt;
      if (playerStepTimer <= 0) {
        playerStepTimer = player.sneaking ? 0.5 : 0.32;
        state.sounds.push({ kind: 'step', volume: player.sneaking ? 0.08 : 0.22 });
      }
      // Walking is heard nearby; sneaking is silent.
      if (!player.sneaking && !harmless) {
        noiseTimer -= dt;
        if (noiseTimer <= 0) {
          noiseTimer = NOISE.walkEvery;
          state.pulses.push({ x: player.x, y: player.y, age: 0, maxAge: 0.7, radius: NOISE.walkRadius });
          for (const guard of state.guards) {
            const d = Math.hypot(guard.x - player.x, guard.y - player.y);
            if (d < NOISE.walkRadius && guard.state === 'patrol') {
              guard.state = 'suspicious';
              guard.meter = Math.max(guard.meter, 0.3);
              guard.investigateX = player.x;
              guard.investigateY = player.y;
              guard.wait = 0;
            }
          }
        }
      }
    }

    // --- toss a distraction coin ---
    if (input.toss && state.coinsLeft > 0 && !harmless) {
      state.coinsLeft -= 1;
      let cx = player.x + player.faceX * NOISE.coinThrow;
      let cy = player.y + player.faceY * NOISE.coinThrow;
      cx = Math.max(TILE, Math.min(FIELD.width - TILE, cx));
      cy = Math.max(TILE, Math.min(FIELD.height - TILE, cy));
      state.coins.push({ x: cx, y: cy, age: 0 });
      state.pulses.push({ x: cx, y: cy, age: 0, maxAge: 0.9, radius: NOISE.coinRadius });
      state.sounds.push({ kind: 'coin' });
      for (const guard of state.guards) {
        const d = Math.hypot(guard.x - cx, guard.y - cy);
        if (d < NOISE.coinRadius && guard.state !== 'chase') {
          guard.state = 'suspicious';
          guard.meter = Math.max(guard.meter, 0.35);
          guard.investigateX = cx;
          guard.investigateY = cy;
          guard.wait = 0;
        }
      }
    }

    // --- the guards move and watch ---
    for (const guard of state.guards) {
      const e = stepGuard(guard, dt, harmless);
      if (e & EVENT_CAUGHT) {
        events |= EVENT_CAUGHT;
        break;
      }
      events |= e;
    }
    state.maxMeter = 0;
    for (const guard of state.guards) state.maxMeter = Math.max(state.maxMeter, guard.meter);
    state.alarm = state.guards.some((g) => g.state === 'chase');

    // --- pickups and the exit (not in the title backdrop) ---
    if (!harmless && !(events & EVENT_CAUGHT)) {
      for (const item of state.loot) {
        if (!item.taken && Math.hypot(item.x - player.x, item.y - player.y) < 28) {
          item.taken = true;
          state.score += SCORE.loot;
          state.levelScore += SCORE.loot;
          state.sounds.push({ kind: 'pickup' });
          events |= EVENT_LOOT;
        }
      }
      if (!state.relic.taken && Math.hypot(state.relic.x - player.x, state.relic.y - player.y) < 30) {
        state.relic.taken = true;
        state.exit.open = true;
        state.score += SCORE.relic;
        state.levelScore += SCORE.relic;
        state.sounds.push({ kind: 'relic' });
        events |= EVENT_RELIC;
      }
      if (state.exit.open) {
        const t = tileOf(player.x, player.y);
        const et = tileOf(state.exit.x, state.exit.y);
        if (t.c === et.c && t.r === et.r) {
          state.score += SCORE.levelClear;
          state.levelScore += SCORE.levelClear;
          if (state.ghost) {
            state.score += SCORE.ghostBonus;
            state.levelScore += SCORE.ghostBonus;
          }
          state.sounds.push({ kind: 'clear' });
          events |= state.levelIndex >= LEVELS.length - 1 ? EVENT_WIN : EVENT_CLEAR;
        }
      }
    }

    // --- fading pulses and coins ---
    for (let i = state.pulses.length - 1; i >= 0; i -= 1) {
      state.pulses[i].age += dt;
      if (state.pulses[i].age > state.pulses[i].maxAge) state.pulses.splice(i, 1);
    }
    for (let i = state.coins.length - 1; i >= 0; i -= 1) {
      state.coins[i].age += dt;
      if (state.coins[i].age > 6) state.coins.splice(i, 1);
    }
    return events;
  }

  resetRun();
  return { state, loadLevel, resetRun, step, tileCenter };
}
