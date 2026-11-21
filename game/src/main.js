// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between seven screens: title, play, paused, caught, level clear, win and game over.
//
// ?seed=N fixes the random stream. ?shot=start|play|alert|clear (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.

import { BEST_KEY, SCORE, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_ALERT,
  EVENT_CAUGHT,
  EVENT_CLEAR,
  EVENT_LOOT,
  EVENT_RELIC,
  EVENT_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_TOSS, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_CAUGHT,
  SCREEN_CLEAR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
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
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, scene.extra);
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
  let tossPending = false;
  const extra = { levelScoreLine: '', ghostLine: '', scoreLine: '', bestLine: '' };

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function scoreLine() {
    return `Score ${world.state.score}. Best ${best}.`;
  }

  function startRun() {
    world.resetRun();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.level.name}. Steal the relic, then reach the exit.`);
  }

  function startLevel(index) {
    world.loadLevel(index);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.level.name}.`);
  }

  function endRun(won) {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    extra.scoreLine = scoreLine();
    extra.bestLine = best === world.state.score ? 'A new best score.' : `Best ${best}.`;
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    announce(won ? `You win. ${scoreLine()}` : `Game over. ${scoreLine()}`);
  }

  function handleEvents(events) {
    if (events & EVENT_CAUGHT) {
      world.state.score = Math.max(0, world.state.score - SCORE.caughtPenalty);
      world.state.lives -= 1;
      audio.play('caught');
      if (world.state.lives <= 0) {
        endRun(false);
      } else {
        screen = SCREEN_CAUGHT;
        announce(`Spotted! ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left.`);
      }
      return;
    }
    if (events & EVENT_WIN) {
      endRun(true);
      return;
    }
    if (events & EVENT_CLEAR) {
      extra.levelScoreLine = `Loot and relic this gallery: ${world.state.levelScore} points.`;
      extra.ghostLine = world.state.ghost
        ? 'Ghost bonus: never once spotted. +300'
        : 'Spotted once — the ghost bonus slipped away.';
      screen = SCREEN_CLEAR;
      announce(`${world.state.level.name} cleared.`);
      return;
    }
    if (events & EVENT_ALERT) announce('Spotted! Break line of sight and hide!');
    else if (events & EVENT_RELIC) announce('Relic taken. Reach the green exit!');
    else if (events & EVENT_LOOT) announce('Loot pocketed.');
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title's backdrop: the gallery lives, but nothing is seen or stolen.
      world.step(STEP, { mx: 0, my: 0, sneak: false, toss: false }, true);
      return;
    }
    const move = input.move();
    move.toss = tossPending;
    tossPending = false;
    const events = world.step(STEP, move, false);
    const sounds = world.state.sounds;
    for (let i = 0; i < sounds.length; i += 1) audio.play(sounds[i].kind, sounds[i].volume);
    sounds.length = 0;
    handleEvents(events);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_TOSS) tossPending = true;
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startRun();
      else if (screen === SCREEN_CAUGHT) startLevel(world.state.levelIndex);
      else if (screen === SCREEN_CLEAR) startLevel(world.state.levelIndex + 1);
      else if (screen === SCREEN_WIN) startRun();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, extra);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Nightshade. Press Space or click to begin the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
