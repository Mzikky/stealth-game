// The three galleries. Maps are built from rectangles so every row is exactly 32 tiles:
//   '#' wall   '.' floor   'B' bush (hide in it)   'S' shadow floor (hard to see in)
//   'P' the thief's start   'R' the relic   'E' the exit   'o' loot   'G' a guard post
// A guard's patrol is a loop of tile coordinates; it walks them in order, waits a beat at
// each one, and looks around before moving on. Each patrol's first waypoint is its guard post.

import { COLS, ROWS } from './config.js';

function buildLevel({ name, intro, walls, bushes, shadows, player, relic, exit, loot, guards }) {
  const grid = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row = [];
    for (let c = 0; c < COLS; c += 1) {
      row.push(r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? '#' : '.');
    }
    grid.push(row);
  }
  const rect = (c0, r0, c1, r1, ch) => {
    for (let r = r0; r <= r1; r += 1) for (let c = c0; c <= c1; c += 1) grid[r][c] = ch;
  };
  for (const w of walls) rect(w[0], w[1], w[2], w[3], '#');
  for (const b of bushes) grid[b[1]][b[0]] = 'B';
  for (const s of shadows) grid[s[1]][s[0]] = 'S';
  grid[player[1]][player[0]] = 'P';
  grid[relic[1]][relic[0]] = 'R';
  grid[exit[1]][exit[0]] = 'E';
  for (const l of loot) grid[l[1]][l[0]] = 'o';
  const patrols = [];
  for (const g of guards) {
    grid[g[0][1]][g[0][0]] = 'G';
    patrols.push(g);
  }
  return { name, intro, map: grid.map((row) => row.join('')), patrols };
}

export const LEVELS = [
  buildLevel({
    name: 'The Quiet Gallery',
    intro: 'Two guards, one Moon Opal. Take it, then slip out the south door.',
    walls: [
      [8, 1, 8, 6], [8, 8, 8, 9], [8, 11, 8, 16], // west divider (gaps at rows 7, 10)
      [21, 1, 21, 9], [21, 11, 21, 16], // east divider (gap at row 10)
      [12, 3, 15, 4], [24, 4, 25, 5], [10, 12, 11, 13], [26, 12, 27, 13], // display cases
    ],
    bushes: [[3, 3], [3, 12], [18, 12], [25, 12], [28, 5]],
    shadows: [[12, 9], [13, 9], [14, 9], [27, 15], [28, 15]],
    player: [1, 1],
    relic: [13, 8],
    exit: [29, 16],
    loot: [[3, 8], [14, 1], [26, 8], [12, 12], [26, 12], [5, 15]],
    guards: [
      [[27, 2], [27, 6], [24, 6], [24, 2]],
      [[10, 14], [18, 14], [18, 16], [10, 16]],
    ],
  }),
  buildLevel({
    name: 'The Vault Wing',
    intro: 'Three guards and a longer walk to the Star Sapphire. The bushes are your friends.',
    walls: [
      [8, 1, 8, 6], [8, 8, 8, 17 - 1], // west divider (gap at row 7)
      [21, 1, 21, 9], [21, 11, 21, 16], // east divider (gap at row 10)
      [3, 3, 6, 4], [12, 4, 14, 6], [24, 3, 27, 4], // display cases, upper half
      [16, 8, 17, 9], [10, 13, 12, 14], [25, 13, 28, 14], // cases, lower half
    ],
    bushes: [[5, 8], [19, 8], [3, 12], [18, 13], [24, 12]],
    shadows: [[10, 12], [11, 12], [12, 12], [15, 15], [16, 15]],
    player: [1, 1],
    relic: [25, 8],
    exit: [29, 16],
    loot: [[14, 1], [3, 5], [19, 2], [28, 5], [9, 8], [6, 16], [16, 12], [28, 12]],
    guards: [
      [[27, 2], [27, 6], [24, 6], [24, 2]],
      [[5, 14], [7, 14], [7, 16], [5, 16]],
      [[18, 14], [20, 14], [20, 16], [18, 16]],
    ],
  }),
  buildLevel({
    name: 'The Grand Hall',
    intro: 'Four guards, a wide-open hall and the Crown Diamond. Ghost it if you can.',
    walls: [
      [8, 1, 8, 6], [8, 8, 8, 16], // west divider (gap at row 7)
      [21, 1, 21, 9], [21, 11, 21, 16], // east divider (gap at row 10)
      [12, 3, 13, 4], [16, 5, 17, 6], [12, 8, 13, 9], // pillars, middle band
      [24, 5, 25, 6], [27, 8, 28, 9], // pillars, east band
      [10, 13, 11, 14], [17, 13, 18, 14], [24, 13, 25, 14], // pillars, lower half
    ],
    bushes: [[3, 3], [19, 2], [5, 12], [19, 12], [28, 2]],
    shadows: [[13, 11], [14, 11], [15, 11], [25, 15], [26, 15]],
    player: [1, 1],
    relic: [25, 7],
    exit: [29, 16],
    loot: [[14, 1], [3, 8], [19, 4], [28, 3], [9, 11], [22, 12], [28, 12], [6, 16]],
    guards: [
      [[26, 3], [29, 3], [29, 6], [26, 6]],
      [[5, 13], [7, 13], [7, 16], [5, 16]],
      [[26, 14], [28, 14], [28, 15], [26, 15]],
      [[14, 15], [19, 15], [19, 13], [14, 13]],
    ],
  }),
];
