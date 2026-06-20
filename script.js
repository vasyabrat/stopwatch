(function () {
  "use strict";

  // ---- Elements ----
  const timeEl = document.getElementById("time");
  const statusEl = document.getElementById("status");
  const startStopBtn = document.getElementById("startStop");
  const resetBtn = document.getElementById("reset");
  const soundBtn = document.getElementById("sound");
  const startLabel = startStopBtn.querySelector(".btn__label");
  const startIcon = startStopBtn.querySelector(".icon");

  const PLAY = '<polygon points="6,4 20,12 6,20" />';
  const PAUSE = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';

  // ---- State ----
  let startTime = 0;       // timestamp the current run began
  let elapsed = 0;         // accumulated ms from previous runs
  let rafId = null;
  let running = false;
  let soundOn = true;

  // ---- Audio (Web Audio API — no files needed) ----
  let audioCtx = null;
  function ctx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }

  // A short, clean beep. Two tones distinguish start vs stop.
  function beep(freq, duration, type) {
    if (!soundOn) return;
    const ac = ctx();
    if (!ac) return;
    if (ac.state === "suspended") ac.resume();

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;

    const now = ac.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function startSound() {
    // rising two-note chirp
    beep(660, 0.12, "sine");
    setTimeout(() => beep(990, 0.16, "sine"), 90);
  }
  function stopSound() {
    // falling two-note chirp
    beep(550, 0.12, "sine");
    setTimeout(() => beep(360, 0.18, "sine"), 90);
  }
  function resetSound() {
    beep(440, 0.08, "triangle");
  }

  // ---- Time formatting ----
  function format(ms) {
    const totalMs = Math.floor(ms);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const centis = Math.floor((totalMs % 1000) / 10);
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    const cc = String(centis).padStart(2, "0");
    return { main: mm + ":" + ss, ms: "." + cc };
  }

  function render(ms) {
    const f = format(ms);
    timeEl.innerHTML = f.main + '<span class="display__ms">' + f.ms + "</span>";
  }

  function tick() {
    const now = performance.now();
    render(elapsed + (now - startTime));
    rafId = requestAnimationFrame(tick);
  }

  // ---- Controls ----
  function start() {
    if (running) return;
    running = true;
    startTime = performance.now();
    rafId = requestAnimationFrame(tick);

    document.body.classList.add("running");
    startStopBtn.classList.add("is-stop");
    startStopBtn.setAttribute("aria-label", "Stop");
    startLabel.textContent = "Stop";
    startIcon.innerHTML = PAUSE;
    statusEl.textContent = "Running";
    startSound();
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    elapsed += performance.now() - startTime;
    render(elapsed);

    document.body.classList.remove("running");
    startStopBtn.classList.remove("is-stop");
    startStopBtn.setAttribute("aria-label", "Start");
    startLabel.textContent = "Resume";
    startIcon.innerHTML = PLAY;
    statusEl.textContent = "Paused";
    stopSound();
  }

  function reset() {
    running = false;
    cancelAnimationFrame(rafId);
    elapsed = 0;
    render(0);

    document.body.classList.remove("running");
    startStopBtn.classList.remove("is-stop");
    startStopBtn.setAttribute("aria-label", "Start");
    startLabel.textContent = "Start";
    startIcon.innerHTML = PLAY;
    statusEl.textContent = "Ready";
    resetSound();
  }

  function toggleStartStop() {
    running ? stop() : start();
  }

  // ---- Wire up ----
  startStopBtn.addEventListener("click", toggleStartStop);
  resetBtn.addEventListener("click", reset);

  soundBtn.addEventListener("click", function () {
    soundOn = !soundOn;
    soundBtn.setAttribute("aria-pressed", String(soundOn));
    soundBtn.querySelector("span").textContent = soundOn ? "Sound on" : "Sound off";
    if (soundOn) beep(880, 0.07, "sine"); // little confirmation blip
  });

  // Keyboard: Space toggles, R resets
  document.addEventListener("keydown", function (e) {
    if (e.code === "Space" && e.target.tagName !== "BUTTON") {
      e.preventDefault();
      toggleStartStop();
    } else if (e.key.toLowerCase() === "r") {
      reset();
    }
  });

  // Initialize
  render(0);
})();
