// sketch.js
// Handles p5 setup, HUD interaction, and rendering by combining persisted feature data with the visual layer.
let DEMO_VISUAL = false; // Preview with synthetic values when true; use real audio when false.
let autoStartRequested = false;
let drawError = "";
let hudRefs = null;

let visualFeat = {
  noise: 0,
  threshold: 60,
  low: 0,
  mid: 0,
  high: 0,
};

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  initHud();
  requestAutoStart();
}

function requestAutoStart() {
  if (autoStartRequested) return;
  autoStartRequested = true;
  window.setTimeout(() => {
    void window.CaptureBridge.startCapture(width, height);
  }, 0);
}

function initHud() {
  hudRefs = {
    append: document.getElementById("hud-append"),
    appendError: document.getElementById("hud-append-error"),
    buttons: Array.from(document.querySelectorAll(".hud__button[data-source]")),
    error: document.getElementById("hud-error"),
    source: document.getElementById("hud-source"),
    status: document.getElementById("hud-status"),
  };

  for (const button of hudRefs.buttons) {
    button.addEventListener("click", async () => {
      window.CaptureBridge.setActiveSource(button.dataset.source);
      syncHudSourceButtons();
      await window.CaptureBridge.startCapture(width, height);
    });
  }

  syncHudSourceButtons();
}

function syncHudSourceButtons() {
  if (!hudRefs) return;
  const activeSource = window.CaptureBridge.getActiveSource();

  for (const button of hudRefs.buttons) {
    button.classList.toggle("is-active", button.dataset.source === activeSource);
  }
}

function updateHud(state, status, visibleError) {
  if (!hudRefs) return;

  hudRefs.source.textContent = state.label;
  hudRefs.status.textContent = state.ready ? "ready" : "click/tap to initialize";
  hudRefs.append.textContent = `${status.appendCount} | last: ${status.lastAppendAt}`;

  if (status.lastAppendError) {
    hudRefs.appendError.hidden = false;
    hudRefs.appendError.textContent = `append error: ${status.lastAppendError}`;
  } else {
    hudRefs.appendError.hidden = true;
    hudRefs.appendError.textContent = "";
  }

  if (visibleError) {
    hudRefs.error.hidden = false;
    hudRefs.error.textContent = `init error: ${visibleError}`;
  } else {
    hudRefs.error.hidden = true;
    hudRefs.error.textContent = "";
  }

  syncHudSourceButtons();
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function jsonFeatures() {
  const feat = window.FEAT || {};
  return {
    noise: Number(feat.noise ?? 0),
    threshold: Number(feat.threshold ?? 60),
    low: Number(feat.low ?? 0),
    mid: Number(feat.mid ?? 0),
    high: Number(feat.high ?? 0),
  };
}

function smoothFeatures(next) {
  visualFeat.noise = lerp(visualFeat.noise, next.noise ?? 0, 0.14);
  visualFeat.threshold = lerp(visualFeat.threshold, next.threshold ?? 60, 0.12);
  visualFeat.low = lerp(visualFeat.low, next.low ?? 0, 0.16);
  visualFeat.mid = lerp(visualFeat.mid, next.mid ?? 0, 0.18);
  visualFeat.high = lerp(visualFeat.high, next.high ?? 0, 0.2);
  return { ...visualFeat };
}

function draw() {
  background(0);

  try {
    drawError = "";
    const state = window.CaptureBridge.getSourceState();
    const detected = DEMO_VISUAL ? demoFeatures() : window.CaptureBridge.getDetectedFeatures();
    const raw = DEMO_VISUAL ? detected : jsonFeatures();
    const a = smoothFeatures(raw);

    if (state.video && state.video.elt && state.video.elt.readyState >= 2) {
      window.Visual.drawLayeredBlocks(state.video, a, {
        showPaperGrid: true,
      });
    }

    window.CaptureBridge.recordDetected(detected, millis());

    const status = window.CaptureBridge.getStatus();
    const visibleError = status.initError || drawError;
    updateHud(state, status, visibleError);
  } catch (e) {
    drawError = e?.message || "draw failed";
  }
}

async function mousePressed() {
  await window.CaptureBridge.startCapture(width, height);
  return false;
}

async function touchStarted() {
  await window.CaptureBridge.startCapture(width, height);
  return false;
}

async function keyPressed() {
  if (key === "f" || key === "F") {
    const fs = fullscreen();
    fullscreen(!fs);
    return;
  }

  if (key === "s" || key === "S") {
    saveCanvas("city-sound-frame", "png");
    return;
  }

  if (key === "1") window.CaptureBridge.setActiveSource("live");
  if (key === "2") window.CaptureBridge.setActiveSource("file");
  await window.CaptureBridge.startCapture(width, height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  window.CaptureBridge.resizeMedia(width, height);
}

function demoFeatures() {
  const nx = clamp(mouseX / width, 0, 1);
  const hy = clamp(1 - mouseY / height, 0, 1);
  const t = millis() * 0.001;

  const noise = nx;
  const high = hy * 255;
  const mid = (0.5 + 0.5 * Math.sin(t * 2.2)) * 255;
  const low = (0.5 + 0.5 * Math.sin(t * 1.1 + 1.0)) * 255;

  return {
    noise,
    threshold: 60 + noise * 140,
    low,
    mid,
    high,
  };
}
