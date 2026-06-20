# Stopwatch

A sleek, single-page stopwatch with sound effects on start, stop, and reset.
Built with plain HTML, CSS, and JavaScript — no build step, no dependencies.

## Features

- **Start / Stop / Reset** buttons (the Start button turns into Stop while running)
- **Sound effects** for each action, generated with the Web Audio API (no audio files)
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
