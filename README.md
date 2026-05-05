# Treasure Crew Co-op v0.3

A mobile-first multiplayer web prototype for the glossy toy-boat cooperative cockpit game. Two players join a room code, choose seats, complete asymmetric cockpit minigames, build the owner's manual, and now launch a real co-op treasure-hunt communication round.

This v0.3 update adds the first true social gameplay mode: **Captain reads the treasure map clue while Engineer taps the GPS grid coordinate.**

## New in v0.3

- Interactive **Treasure Hunt Mode**
- Captain-only map clue panel
- Engineer GPS coordinate tapping grid
- Wrong-coordinate penalties
- Hazard squares that damage hull/power more severely
- Treasure success reward reveal
- Failed hunt state with relaunch option
- Event overlay button to launch the treasure round
- Live multiplayer sync for treasure guesses
- Updated logs and success feedback for treasure actions
- Kept v0.2 guided mission flow and manual unlocks
- Still no external npm packages required

## Existing features

- Room-code multiplayer
- Captain and Engineer seats
- Seat swapping during gameplay
- Guided mission banner
- Breaker panel with red warning lights
- Blank gauges/meters, GPS screen, shifter, wheel, radio handset, and coil cord
- Captain minigames: word search and letter-bank word building
- Engineer minigames: liquid sorting, connect-the-dots, and matching repairs
- Owner's manual reveal overlays
- Pirate event tease for the next build

## Install

No external packages are required. This command is optional but safe:

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3001
```

Open the same URL in two browser tabs or on two devices. Create a room on one device, then join with the room code on the other.

## Production run

```bash
npm start
```

## Hosting

Use a Node-capable host because multiplayer sync requires a persistent server process.

Good options:

- Render
- Railway
- Fly.io
- DigitalOcean App Platform
- VPS / self-hosted Node server

Suggested settings:

```text
Build command: npm install
Start command: npm start
Node version: 20+
```

## Files

```text
server.js            Node static server + room server + mission + treasure engine
public/index.html    App shell
public/app.js        Multiplayer client, rendering, task UI, treasure mode, overlays
public/styles.css    Glossy toy cockpit visual system
GAME_DESIGN.md       Current game design direction and next features
```

## v0.3 test path

1. Create a room.
2. Join from a second tab or device.
3. Claim Captain and Engineer.
4. Press **Start Voyage**.
5. Complete one Captain task and one Engineer task.
6. Add the owner’s manual page.
7. When the treasure event appears, press **Launch Treasure Round**.
8. Captain reads the clue aloud.
9. Engineer taps the GPS coordinate.
10. Correct guesses unlock treasure; wrong guesses damage the boat.

## Next recommended build

**v0.4 — Pirate Attack Mode**

Add a timed arcade event where both players defend the boat through rapid symbol matching, repair prompts, breaker callouts, and playful pirate pressure.
