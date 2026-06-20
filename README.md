# Stopwatch

A sleek, single-page stopwatch with sound effects on start, stop, and reset.
Built with plain HTML, CSS, and JavaScript — no build step, no dependencies.

## Modes

- **Stopwatch** — the classic mode. The timer is visible at all times. Start / Stop / Reset.
- **Game (Guess the Time)** — a blind challenge. Pick a target (e.g. 5 seconds), then everyone
  takes a turn: press **Start** (you hear a chirp), the timer **hides**, and you must press
  **Stop** when you *think* you've hit the target — going purely by sound and feel. On stop, the
  app reveals your time and how far off you were. Closest to the target wins. 🎯

## Features

- **Start / Stop / Reset** buttons (the Start button turns into Stop while running)
- **Sound effects** for each action, generated with the Web Audio API (no audio files) — plus a
  little fanfare when a game round lands dead-on
- **Sound toggle** to mute/unmute
- Centisecond-precision timer (`MM:SS.cc`)
- Black / silver / blue design with an animated glow
- Keyboard shortcuts: **Space** to start/stop, **R** to reset
- Fully responsive and accessible

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy to Vercel

This is a static site, so deployment is zero-config:

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. Framework Preset: **Other**. Leave build & output settings empty.
4. Click **Deploy**.

Or from the CLI:

```bash
npm i -g vercel
vercel
```
