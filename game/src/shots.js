// The screenshot scenes behind ?shot=start|play|alert|clear. Each one plays the real rules
// forward from a fresh world, steered by a simple autopilot (follow tile waypoints, sneak near
// guards, wait crouched when a guard grows suspicious), so the frame is what a short game
// really looks like and the same seed always gives the same frame. A caught autopilot retries
// more cautiously; the last resort stages the same real state by hand.

import { STEP, TILE } from './config.js';
import { EVENT_ALERT, EVENT_CAUGHT, EVENT_CLEAR } from './world.js';
import { SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function tilePos(c, r) {
  return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
}

function nearestGuardDist(state) {
  let best = Infinity;
  for (const guard of state.guards) {
    best = Math.min(best, Math.hypot(guard.x - state.player.x, guard.y - state.player.y));
  }
  return best;
}

/**
 * Steer the thief along tile waypoints for up to `seconds`. Returns what happened: whether
 * the route was finished, whether the thief was caught, whether the alarm went off, and
 * whether the gallery was cleared on the way.
 */
function autopilot(world, waypoints, seconds, options) {
  const state = world.state;
  let waypoint = 0;
  let caught = false;
  let alarmed = false;
  let cleared = false;
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    if (waypoint >= waypoints.length) break;
    const target = tilePos(waypoints[waypoint][0], waypoints[waypoint][1]);
    const dx = target.x - state.player.x;
    const dy = target.y - state.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      waypoint += 1;
      continue;
    }
    const near = nearestGuardDist(state);
    const sneak = options.alwaysSneak || near < (options.sneakNear ?? 300);
    let mx = 0;
    let my = 0;
    // Wait, crouched, while a guard is getting suspicious nearby.
    if (!(state.maxMeter > (options.waitMeter ?? 0.35) && near < 260)) {
      mx = dx / dist;
      my = dy / dist;
    }
    const events = world.step(STEP, { mx, my, sneak, toss: false }, false);
    state.sounds.length = 0;
    if (events & EVENT_CAUGHT) {
      caught = true;
      break;
    }
    if (events & EVENT_ALERT) alarmed = true;
    if (events & EVENT_CLEAR) {
      cleared = true;
      break;
    }
    if (options.stopOnAlarm && alarmed) break;
  }
  return { reached: waypoint >= waypoints.length, caught, alarmed, cleared };
}

function clearExtra(world) {
  return {
    levelScoreLine: `Loot and relic this gallery: ${world.state.levelScore} points.`,
    ghostLine: world.state.ghost
      ? 'Ghost bonus: never once spotted. +300'
      : 'Spotted once — the ghost bonus slipped away.',
    scoreLine: '',
    bestLine: '',
  };
}

const EMPTY_EXTRA = { levelScoreLine: '', ghostLine: '', scoreLine: '', bestLine: '' };

/**
 * Set `world` to the named scene (start, play, alert or clear; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    // Sneak down the west gallery and crouch above the patrolling guard, relic in sight.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.resetRun();
      const result = autopilot(
        world,
        [[1, 7], [6, 7], [6, 10], [9, 10], [13, 10], [13, 13]],
        60,
        { alwaysSneak: attempt > 0, waitMeter: attempt > 0 ? 0.2 : 0.35 },
      );
      if (result.reached && !result.caught) break;
      if (attempt === 2) {
        // Last resort: put the thief at the photo spot and let the guards patrol.
        world.resetRun();
        const spot = tilePos(13, 13);
        world.state.player.x = spot.x;
        world.state.player.y = spot.y;
        world.state.player.sneaking = true;
        for (let index = 0; index < 5 / STEP; index += 1) {
          world.step(STEP, { mx: 0, my: 0, sneak: true, toss: false }, true);
          world.state.sounds.length = 0;
        }
      }
    }
    return { screen: SCREEN_PLAY, best: 0, extra: EMPTY_EXTRA };
  }

  if (name === 'alert') {
    // Walk around the display case and straight along the lower guard's patrol line.
    world.resetRun();
    const result = autopilot(
      world,
      [[1, 7], [6, 7], [6, 10], [12, 10], [12, 14], [16, 14]],
      45,
      { sneakNear: 0, waitMeter: 2, stopOnAlarm: true },
    );
    if (!result.alarmed) {
      // Force the alarm through the real rules: a guard that is sure of the thief chases.
      // (1.2, not 1: the meter decays a little in the next step before the check reads it.)
      world.state.guards[0].meter = 1.2;
      for (let index = 0; index < 2 / STEP; index += 1) {
        world.step(STEP, { mx: 0, my: 0, sneak: false, toss: false }, false);
        world.state.sounds.length = 0;
        if (world.state.alarm) break;
      }
    }
    return { screen: SCREEN_PLAY, best: 0, extra: EMPTY_EXTRA };
  }

  if (name === 'clear') {
    // Steal the Moon Opal and slip out the south door of the first gallery.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.resetRun();
      const result = autopilot(
        world,
        [[1, 7], [6, 7], [6, 10], [13, 10], [13, 8], [13, 10], [20, 10], [22, 10], [22, 13], [25, 13], [25, 15], [29, 15], [29, 16]],
        120,
        { alwaysSneak: attempt > 0, waitMeter: 0.25 },
      );
      if (result.cleared) return { screen: SCREEN_CLEAR, best: 0, extra: clearExtra(world) };
      if (!result.caught && attempt === 2) break;
    }
    // Last resort: the relic is taken and the thief stands on the exit; one real step clears it.
    world.resetRun();
    world.state.relic.taken = true;
    world.state.exit.open = true;
    world.state.player.x = world.state.exit.x;
    world.state.player.y = world.state.exit.y;
    world.step(STEP, { mx: 0, my: 0, sneak: false, toss: false }, false);
    world.state.sounds.length = 0;
    return { screen: SCREEN_CLEAR, best: 0, extra: clearExtra(world) };
  }

  // start: the title over a living gallery, guards on patrol.
  world.resetRun();
  for (let index = 0; index < 5 / STEP; index += 1) {
    world.step(STEP, { mx: 0, my: 0, sneak: false, toss: false }, true);
    world.state.sounds.length = 0;
  }
  return { screen: SCREEN_TITLE, best: 0, extra: EMPTY_EXTRA };
}
