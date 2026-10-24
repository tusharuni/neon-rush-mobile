# NEON RUSH — Mobile Edition

A one-thumb neon arcade dodger, built mobile-first: pilot a glowing orb
through an endless asteroid storm, chain near-misses, and chase your best
score. All game art is drawn in code — no asset downloads.

## Play it

- **Online:** https://asteroid-orb-dash.lovable.app
- **On your phone:** open that link in your mobile browser, or add it to your
  home screen for a full-screen game.

## Run it yourself

Requires Node.js and bun (or npm):

```sh
bun install
bun run dev
```

Then open the local address Vite prints. Production build:

```sh
bun run build
```

## How it hooks you

- **Near-miss combo:** grazing an asteroid builds your combo multiplier, up to
  x10, with a decaying combo bar.
- **Rising speed:** the storm gets faster every 10 seconds.
- **Coins and shop:** collect coins and spend them on orb trails and skins —
  saved in your browser.
- **Power-ups:** shield, coin magnet, and slow-mo.
- **Daily missions:** three fresh missions every day.
- **Best score:** your best is saved, and the game-over screen tells you
  exactly how many points you were from beating it.

## Project layout

- `src/game/engine.ts` — the game loop, asteroids, collisions, combo logic.
- `src/game/audio.ts` — synthesized WebAudio sound effects (no audio files).
- `src/game/storage.ts` — best score, coins, shop, and mission persistence.
- `src/routes/index.tsx` — the game screen and HUD.
- `src/components/ui/` — standard UI primitives (shadcn-style).

## Notes

- The favicon from the original Lovable project is not included here (binary
  files are left out of this export); the game runs fine without it.
- The desktop edition lives in its own repo:
  https://github.com/tusharuni/neon-rush-desktop

## License

Free to play and share. Have fun.
