# stealth-game

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Mzikky/stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Mzikky/stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Nightshade — The Quiet Gallery.** A complete top-down stealth game that plays offline in a desktop browser from static files. You are Wren, a thief with three galleries to rob and no wish to be seen: sneak past patrolling guards and their vision cones, hide in the bushes, toss a coin to pull a guard away, steal the relic, and reach the green EXIT unseen.

- Guards patrol, wait, look around, grow suspicious, and chase — an eye meter shows how close the nearest guard is to raising the alarm.
- Sneak (Shift) to move slower, quieter, and harder to spot; walking is heard nearby; shadows and bushes hide you.
- Three hand-built galleries (The Quiet Gallery, The Vault Wing, The Grand Hall), each with loot, a relic, and a ghost bonus for never being spotted.
- WebAudio footsteps, alert stings, and pickup chimes made with oscillators — no audio files, no network requests, no assets beyond the code.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Move with WASD or the arrow keys, hold Shift to sneak, E tosses a distraction coin, P pauses, M mutes.

To hand the game in:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json`. Node 22, no dependencies. Screenshots in `screenshots/` are real renders of the game in headless Chrome (`?shot=start|play|alert|clear` stages each scene).

---

<sub>Entered on [make.fun](https://make.fun/?ref=webf24xb&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
