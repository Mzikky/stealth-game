// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Vision cones are painted before the walls, so a wall reads as blocking the light;
// the thief, the guards and the loot are flat canvas shapes, no image assets at all.

import { COLS, FIELD, FONT, GUARD, LIVES, PALETTE, ROWS, TILE } from './config.js';
import { LEVELS } from './levels.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const lootLabel = cachedLabel('Loot ');
  const timeLabel = cachedLabel('');
  const bestLabel = cachedLabel('Best ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function tileChar(state, c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '#';
    return state.grid[r][c];
  }

  function drawFloor(state) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const ch = state.grid[r][c];
        const x = c * TILE;
        const y = r * TILE;
        if (ch === '#') continue;
        context.fillStyle = ch === 'S' ? PALETTE.shadowFloor : (c + r) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(x, y, TILE, TILE);
        if (ch === 'B') {
          context.fillStyle = PALETTE.bush;
          context.beginPath();
          context.arc(x + TILE / 2, y + TILE / 2, 17, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = PALETTE.bushLeaf;
          context.beginPath();
          context.arc(x + 13, y + 14, 6, 0, Math.PI * 2);
          context.arc(x + 27, y + 24, 6, 0, Math.PI * 2);
          context.arc(x + 25, y + 12, 5, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  }

  function drawCone(guard) {
    const color = guard.state === 'chase' ? PALETTE.coneChase
      : guard.state === 'suspicious' || guard.state === 'return' && guard.meter > 0 ? PALETTE.coneSuspicious
      : PALETTE.conePatrol;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    context.arc(guard.x, guard.y, GUARD.viewDistance, guard.angle - GUARD.viewHalfAngle, guard.angle + GUARD.viewHalfAngle);
    context.closePath();
    context.fill();
    context.strokeStyle = PALETTE.coneEdge;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    context.lineTo(guard.x + Math.cos(guard.angle - GUARD.viewHalfAngle) * GUARD.viewDistance,
      guard.y + Math.sin(guard.angle - GUARD.viewHalfAngle) * GUARD.viewDistance);
    context.moveTo(guard.x, guard.y);
    context.lineTo(guard.x + Math.cos(guard.angle + GUARD.viewHalfAngle) * GUARD.viewDistance,
      guard.y + Math.sin(guard.angle + GUARD.viewHalfAngle) * GUARD.viewDistance);
    context.stroke();
  }

  function drawWalls(state) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (state.grid[r][c] !== '#') continue;
        const x = c * TILE;
        const y = r * TILE;
        context.fillStyle = PALETTE.wall;
        context.fillRect(x, y, TILE, TILE);
        context.fillStyle = PALETTE.wallTop;
        context.fillRect(x, y, TILE, 4);
      }
    }
  }

  function drawExit(state) {
    const exit = state.exit;
    const x = exit.x - 17;
    const y = exit.y - 17;
    context.fillStyle = exit.open ? PALETTE.exit : PALETTE.exitLocked;
    context.fillRect(x, y, 34, 34);
    context.fillStyle = '#0a0d14';
    context.fillRect(x + 6, y + 6, 22, 22);
    if (exit.open) {
      context.fillStyle = PALETTE.exit;
      context.beginPath();
      context.arc(exit.x, exit.y, 5 + Math.sin(state.time * 4) * 1.5, 0, Math.PI * 2);
      context.fill();
    }
    text('EXIT', exit.x, y - 8, 13, exit.open ? PALETTE.exit : PALETTE.muted, 'center');
  }

  function drawRelic(state) {
    const relic = state.relic;
    if (relic.taken) return;
    const pulse = 1 + Math.sin(state.time * 3) * 0.12;
    context.save();
    context.translate(relic.x, relic.y);
    context.scale(pulse, pulse);
    context.fillStyle = 'rgba(255, 215, 94, 0.18)';
    context.beginPath();
    context.arc(0, 0, 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.relic;
    context.beginPath();
    context.moveTo(0, -13);
    context.lineTo(10, 0);
    context.lineTo(0, 13);
    context.lineTo(-10, 0);
    context.closePath();
    context.fill();
    context.fillStyle = '#fff6cf';
    context.beginPath();
    context.moveTo(0, -13);
    context.lineTo(10, 0);
    context.lineTo(0, 0);
    context.closePath();
    context.fill();
    context.restore();
    text('RELIC', relic.x, relic.y - 30, 13, PALETTE.relic, 'center');
  }

  function drawLoot(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      context.fillStyle = 'rgba(242, 201, 76, 0.15)';
      context.beginPath();
      context.arc(item.x, item.y, 15, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.arc(item.x, item.y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff3c4';
      context.beginPath();
      context.arc(item.x - 2, item.y - 2, 2.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const coin of state.coins) {
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.arc(coin.x, coin.y, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawGuard(guard) {
    // Detection ring over the guard's head: it fills as the guard grows sure of you.
    if (guard.meter > 0.02) {
      context.strokeStyle = guard.meter >= 0.45 ? PALETTE.warn : PALETTE.loot;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * guard.meter);
      context.stroke();
    }
    context.fillStyle = PALETTE.guardDark;
    context.beginPath();
    context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.guard;
    context.beginPath();
    context.arc(guard.x, guard.y, guard.radius - 3, 0, Math.PI * 2);
    context.fill();
    // The direction the guard is looking.
    context.fillStyle = '#ffd9d6';
    context.beginPath();
    context.arc(guard.x + Math.cos(guard.angle) * (guard.radius - 1), guard.y + Math.sin(guard.angle) * (guard.radius - 1), 4, 0, Math.PI * 2);
    context.fill();
    const mark = guard.state === 'chase' ? '!' : guard.state === 'suspicious' ? '?' : '';
    if (mark) {
      text(mark, guard.x, guard.y - guard.radius - 12, 26, guard.state === 'chase' ? PALETTE.danger : PALETTE.warn, 'center');
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    const hidden = tileChar(state, Math.floor(player.x / TILE), Math.floor(player.y / TILE)) === 'B';
    context.save();
    if (hidden) context.globalAlpha = 0.55;
    context.fillStyle = PALETTE.playerDark;
    context.beginPath();
    context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, player.radius - 3, 0, Math.PI * 2);
    context.fill();
    // Hood point: the way the thief faces.
    context.fillStyle = '#d9fffb';
    context.beginPath();
    context.arc(player.x + player.faceX * (player.radius - 1), player.y + player.faceY * (player.radius - 1), 4, 0, Math.PI * 2);
    context.fill();
    if (player.sneaking) {
      context.strokeStyle = PALETTE.player;
      context.setLineDash([4, 4]);
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }
    context.restore();
  }

  function drawPulses(state) {
    for (const pulse of state.pulses) {
      const progress = pulse.age / pulse.maxAge;
      context.strokeStyle = `rgba(238, 241, 245, ${0.5 * (1 - progress)})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(pulse.x, pulse.y, 8 + progress * pulse.radius, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawHud(state, screen) {
    context.fillStyle = 'rgba(7, 10, 18, 0.72)';
    context.fillRect(0, 0, FIELD.width, 46);
    context.textBaseline = 'top';
    text(`Gallery ${state.levelIndex + 1}/3 · ${state.level.name}`, 16, 12, 20, PALETTE.text, 'left');
    const taken = state.loot.filter((item) => item.taken).length;
    text(lootLabel(`${taken}/${state.loot.length}`), 400, 12, 20, PALETTE.loot, 'left');
    text(state.relic.taken ? '◆ Relic taken' : '◇ Relic', 520, 12, 20, state.relic.taken ? PALETTE.relic : PALETTE.muted, 'left');
    // The eye: how close the nearest guard is to raising the alarm.
    const meter = state.maxMeter;
    const eyeColor = meter >= 1 ? PALETTE.danger : meter >= 0.45 ? PALETTE.warn : PALETTE.muted;
    text('Eye', 700, 12, 20, eyeColor, 'left');
    context.fillStyle = '#0a0d14';
    context.fillRect(748, 16, 150, 14);
    context.fillStyle = eyeColor;
    context.fillRect(748, 16, 150 * meter, 14);
    text(`Coins ${state.coinsLeft}`, 930, 12, 20, PALETTE.text, 'left');
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60);
    text(timeLabel(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`), 1060, 12, 20, PALETTE.text, 'left');
    for (let life = 0; life < LIVES; life += 1) {
      context.fillStyle = life < state.lives ? PALETTE.danger : '#2a3040';
      context.beginPath();
      context.arc(1200 + life * 24, 22, 8, 0, Math.PI * 2);
      context.fill();
    }
    if (state.alarm && screen === SCREEN_PLAY) {
      context.fillStyle = 'rgba(229, 83, 75, 0.85)';
      context.fillRect(0, 46, FIELD.width, 30);
      text('SPOTTED — break line of sight and hide!', FIELD.width / 2, 52, 18, '#ffffff', 'center');
    }
    if (screen === SCREEN_PLAY) {
      context.textBaseline = 'top';
      text('WASD / arrows move · Shift sneak · E toss a coin · P pause · M mute', 16, FIELD.height - 26, 16, PALETTE.muted, 'left');
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(7, 10, 18, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 74, 44, accent || PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.loot, 'center');
  }

  const TITLE_LINES = [
    'You are Wren, a thief with three galleries to rob and no wish to be seen.',
    'Sneak past the guards — their yellow cones are their eyes.',
    'Hold Shift to sneak: slower, quieter, harder to spot.',
    'Hide in the bushes. Toss a coin with E to pull a guard away.',
    'Steal the relic, then reach the green EXIT. Never let the eye fill.',
    '',
  ];
  const PAUSED_LINES = ['The guards will wait for you.'];
  const CAUGHT_LINES = ['', ''];
  const CLEAR_LINES = ['', '', ''];
  const WIN_LINES = ['', '', ''];
  const OVER_LINES = ['', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    for (const guard of state.guards) drawCone(guard);
    drawLoot(state);
    drawRelic(state);
    drawExit(state);
    drawWalls(state);
    drawPulses(state);
    for (const guard of state.guards) drawGuard(guard);
    drawPlayer(state);
    // A soft vignette: the night closes in at the edges.
    const gradient = context.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 300, FIELD.width / 2, FIELD.height / 2, 780);
    gradient.addColorStop(0, 'rgba(7, 10, 18, 0)');
    gradient.addColorStop(1, 'rgba(7, 10, 18, 0.35)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('NIGHTSHADE', TITLE_LINES, 'Press Space or click to begin the heist');
      return;
    }
    drawHud(state, screen);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_CAUGHT) {
      CAUGHT_LINES[0] = `Caught in ${state.level.name}.`;
      CAUGHT_LINES[1] = state.lives > 0 ? `${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left — the gallery resets.` : '';
      drawPanel('Spotted!', CAUGHT_LINES, state.lives > 0 ? 'Press Space to try the gallery again' : 'Press Space', PALETTE.danger);
    } else if (screen === SCREEN_CLEAR) {
      CLEAR_LINES[0] = `${state.level.name} cleared.`;
      CLEAR_LINES[1] = extra.levelScoreLine;
      CLEAR_LINES[2] = extra.ghostLine;
      drawPanel('Clean Getaway', CLEAR_LINES, 'Press Space for the next gallery', PALETTE.ok);
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = 'All three relics are yours. The night was kind.';
      WIN_LINES[1] = extra.scoreLine;
      WIN_LINES[2] = extra.bestLine;
      drawPanel('The Quiet Gallery Bows', WIN_LINES, 'Press Space to play again', PALETTE.relic);
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = extra.scoreLine;
      OVER_LINES[1] = extra.bestLine;
      drawPanel('The Night Catches Up', OVER_LINES, 'Press Space to try again', PALETTE.danger);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
