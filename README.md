# Stopwatch

A sleek, single-page stopwatch with sound effects on start, stop, and reset.
Built with plain HTML, CSS, and JavaScript — no build step, no dependencies.

## Solo modes

- **Stopwatch** — the classic mode. The timer is visible at all times. Start / Stop / Reset.
- **Game (Guess the Time)** — a blind challenge. Pick a target (e.g. 5 seconds), then everyone
  takes a turn: press **Start** (you hear a chirp), the timer **hides**, and you must press
  **Stop** when you *think* you've hit the target — going purely by sound and feel. On stop, the
  app reveals your time and how far off you were. Closest to the target wins. 🎯

## Online multiplayer (lobbies, up to 10 players)

Tap **🎮 Play online with friends**. One person **creates a game** and gets a 4-letter **code**;
everyone else **joins** with that code from their own phone (up to 10 players). Two game styles:

- **🕵️ Impostor** — when the host starts, everyone is secretly given the **same number** — except
  one random player, the **impostor**, who gets nothing. Players take turns one-by-one pressing the
  blind stopwatch (the timer is **never shown**, even after). Since the crew are all aiming for the
  same secret number, the impostor — who doesn't know it — tends to sound *off*. After everyone has
  gone, the group **votes** on who the impostor was, and the app reveals the answer.
- **🎯 Closest Wins** — the host sets a target time; everyone takes a blind turn aiming for it. At
  the end, all times are revealed and ranked — **closest to the target wins**. 👑

> **Privacy note:** secret numbers are stored per-player and each phone can only read its own role.
> This is a casual party game, so it runs on an honor system — don't go digging in the browser
> console. The host's device assigns roles, so for a perfectly fair game the host shouldn't peek.
> Heads-up: if the host closes their tab, the game ends for everyone.

## Features

- **Start / Stop / Reset** buttons (the Start button turns into Stop while running)
- **Sound effects** for each action, generated with the Web Audio API (no audio files) — plus a
  little fanfare when a game round lands dead-on
- **Sound toggle** to mute/unmute
- Centisecond-precision timer (`MM:SS.cc`)
- Black / silver / blue design with an animated glow
- Keyboard shortcuts: **Space** to start/stop, **R** to reset
- Fully responsive and accessible

## Online multiplayer setup (one-time, free)

The solo modes work with zero setup. Online play needs a free
[Firebase](https://console.firebase.google.com) project for the realtime lobbies:

1. Create a Firebase project.
2. **Build → Realtime Database → Create database** (start in *locked* mode).
3. **Build → Authentication → Sign-in method → enable Anonymous**.
4. **Project settings → Your apps → Web app (`</>`)** → register the app and copy the config.
5. Paste those values into [`firebase-config.js`](firebase-config.js) (replace the placeholders).
6. In **Realtime Database → Rules**, paste the contents of
   [`database.rules.json`](database.rules.json) and **Publish**.

That's it — refresh the page and "Play online" is live. The Firebase free (Spark) plan is plenty
for a game like this.

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
