(function () {
  "use strict";

  // ---- Elements ----
  const timeWrap = document.querySelector(".display__time");
  const timeMainEl = document.getElementById("timeMain");
  const timeMsEl = document.getElementById("timeMs");
  const statusEl = document.getElementById("status");
  const titleEl = document.getElementById("title");
  const startStopBtn = document.getElementById("startStop");
  const resetBtn = document.getElementById("reset");
  const soundBtn = document.getElementById("sound");
  const startLabel = startStopBtn.querySelector(".btn__label");
  const startIcon = startStopBtn.querySelector(".icon");

  const modesEl = document.querySelector(".modes");
  const modeStopwatchBtn = document.getElementById("modeStopwatch");
  const modeGameBtn = document.getElementById("modeGame");
  const targetWrap = document.getElementById("target");
  const targetInput = document.getElementById("targetInput");
  const resultEl = document.getElementById("result");

  const PLAY = '<polygon points="6,4 20,12 6,20" />';
  const PAUSE = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';

  function showMask() {
    timeWrap.classList.add("is-hidden");
    timeMainEl.textContent = "•• ••";
    timeMsEl.textContent = "";
  }

  // ---- State ----
  let startTime = 0;       // timestamp the current run began
  let elapsed = 0;         // accumulated ms from previous runs
  let rafId = null;
  let running = false;
  let soundOn = true;
  let gameMode = false;    // false = stopwatch, true = blind game

  // ---- Audio (Web Audio API — no files needed) ----
  let audioCtx = null;
  function ctx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }

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
    beep(660, 0.12, "sine");
    setTimeout(() => beep(990, 0.16, "sine"), 90);
  }
  function stopSound() {
    beep(550, 0.12, "sine");
    setTimeout(() => beep(360, 0.18, "sine"), 90);
  }
  function resetSound() {
    beep(440, 0.08, "triangle");
  }
  // Little fanfare when a game round lands very close
  function winSound() {
    beep(784, 0.1, "sine");
    setTimeout(() => beep(988, 0.1, "sine"), 100);
    setTimeout(() => beep(1319, 0.2, "sine"), 210);
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
    // Update text nodes only (no innerHTML churn) so the running clock never jitters.
    if (timeMainEl.textContent !== f.main) timeMainEl.textContent = f.main;
    timeMsEl.textContent = f.ms;
  }

  function tick() {
    const now = performance.now();
    render(elapsed + (now - startTime));
    rafId = requestAnimationFrame(tick);
  }

  // ---- Game-mode result ----
  function showResult(ms) {
    // Use the same centisecond value the display shows, so they never disagree.
    const seconds = Math.floor(ms / 10) / 100;
    const target = parseFloat(targetInput.value);

    if (isNaN(target) || target <= 0) {
      resultEl.className = "result";
      resultEl.innerHTML = "You hit <strong>" + seconds.toFixed(2) + "s</strong>";
      resultEl.hidden = false;
      return;
    }

    const diff = Math.abs(seconds - target);
    const sign = seconds >= target ? "+" : "−";
    let cls = "is-far";
    let msg;

    if (diff < 0.05) {
      cls = "is-perfect";
      msg = "🎯 Perfect! Bang on " + target.toFixed(2) + "s";
      winSound();
    } else {
      if (diff <= 0.5) cls = "is-close";
      msg =
        '<span class="result__off">' + sign + diff.toFixed(2) + "s</span> off — you hit " +
        "<strong>" + seconds.toFixed(2) + "s</strong>";
    }

    resultEl.className = "result " + cls;
    resultEl.innerHTML = msg;
    resultEl.hidden = false;
  }

  // ---- Controls ----
  function start() {
    if (running) return;
    running = true;
    startTime = performance.now();

    document.body.classList.add("running");
    startStopBtn.classList.add("is-stop");
    startStopBtn.setAttribute("aria-label", "Stop");
    startLabel.textContent = "Stop";
    startIcon.innerHTML = PAUSE;
    startSound();

    if (gameMode) {
      // Blind round: hide the time, rely on sound/feel.
      resultEl.hidden = true;
      showMask();
      statusEl.textContent = "Listening…";
    } else {
      statusEl.textContent = "Running";
      rafId = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    elapsed += performance.now() - startTime;

    document.body.classList.remove("running");
    startStopBtn.classList.remove("is-stop");
    startStopBtn.setAttribute("aria-label", "Start");
    startIcon.innerHTML = PLAY;
    stopSound();

    if (gameMode) {
      timeWrap.classList.remove("is-hidden");
      render(elapsed);              // reveal the hidden time
      startLabel.textContent = "Start";
      statusEl.textContent = "Result";
      showResult(elapsed);
      elapsed = 0;                  // each game round is independent
    } else {
      render(elapsed);
      startLabel.textContent = "Resume";
      statusEl.textContent = "Paused";
    }
  }

  function reset() {
    running = false;
    cancelAnimationFrame(rafId);
    elapsed = 0;
    timeWrap.classList.remove("is-hidden");
    render(0);
    resultEl.hidden = true;

    document.body.classList.remove("running");
    startStopBtn.classList.remove("is-stop");
    startStopBtn.setAttribute("aria-label", "Start");
    startLabel.textContent = "Start";
    startIcon.innerHTML = PLAY;
    statusEl.textContent = gameMode ? "Set a target, then go blind" : "Ready";
    resetSound();
  }

  function toggleStartStop() {
    running ? stop() : start();
  }

  // ---- Mode switching ----
  function setMode(toGame) {
    if (gameMode === toGame) return;
    gameMode = toGame;

    // Stop anything in flight and clear the board.
    running = false;
    cancelAnimationFrame(rafId);
    elapsed = 0;
    timeWrap.classList.remove("is-hidden");
    render(0);
    resultEl.hidden = true;
    document.body.classList.remove("running");
    startStopBtn.classList.remove("is-stop");
    startStopBtn.setAttribute("aria-label", "Start");
    startLabel.textContent = "Start";
    startIcon.innerHTML = PLAY;

    modesEl.classList.toggle("game", toGame);
    modeGameBtn.classList.toggle("is-active", toGame);
    modeStopwatchBtn.classList.toggle("is-active", !toGame);
    modeGameBtn.setAttribute("aria-selected", String(toGame));
    modeStopwatchBtn.setAttribute("aria-selected", String(!toGame));
    targetWrap.hidden = !toGame;
    titleEl.textContent = toGame ? "GUESS THE TIME" : "STOPWATCH";
    statusEl.textContent = toGame ? "Set a target, then go blind" : "Ready";
  }

  // ---- Wire up ----
  startStopBtn.addEventListener("click", toggleStartStop);
  resetBtn.addEventListener("click", reset);
  modeStopwatchBtn.addEventListener("click", () => setMode(false));
  modeGameBtn.addEventListener("click", () => setMode(true));

  soundBtn.addEventListener("click", function () {
    soundOn = !soundOn;
    soundBtn.setAttribute("aria-pressed", String(soundOn));
    soundBtn.querySelector("span").textContent = soundOn ? "Sound on" : "Sound off";
    if (soundOn) beep(880, 0.07, "sine");
  });

  // Keyboard: Space toggles, R resets
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT") return; // don't hijack the target field
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
