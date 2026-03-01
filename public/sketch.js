let liveVideo = null;
let liveReady = false;

let fileVideo = null;
let fileReady = false;
let DEMO_VISUAL = false; // Preview with synthetic values when true; use real audio when false.

let activeSource = "file";

let liveAudio = {
  ctx: null,
  source: null,
  analyser: null,
  freq: null,
  stream: null,
  ready: false,
};

let fileAudio = {
  ctx: null,
  source: null,
  analyser: null,
  freq: null,
  silentGain: null,
  ready: false,
};

let lastSent = 0;
const INTERVAL = 100;
let recording = true;

let appendCount = 0;
let lastAppendError = "";
let lastAppendAt = "-";
let initError = "";
let visualFeat = {
  noise: 0,
  threshold: 60,
  low: 0,
  mid: 0,
  high: 0,
};

const VIDEO_PATH = "/City_Sound/subway.mp4";

function setup() {
  createCanvas(800, 450);
  pixelDensity(1);
}

function getSourceState(sourceKey = activeSource) {
  if (sourceKey === "live") {
    return {
      video: liveVideo,
      ready: liveReady,
      audio: liveAudio,
      label: "live camera",
      recordSource: "live_cam",
    };
  }

  return {
    video: fileVideo,
    ready: fileReady,
    audio: fileAudio,
    label: "subway.mp4",
    recordSource: "subway_mp4",
  };
}

function audioFeatures(sourceKey = activeSource) {
  const state = getSourceState(sourceKey);
  const audio = state.audio;

  if (!audio.ready || !audio.analyser || !audio.freq) {
    return { noise: 0, threshold: 60, low: 0, mid: 0, high: 0 };
  }

  audio.analyser.getByteFrequencyData(audio.freq);

  let mean = 0;
  for (let i = 0; i < audio.freq.length; i++) mean += audio.freq[i];
  mean /= audio.freq.length;

  const low = bandEnergy(audio, audio.freq, 20, 200);
  const mid = bandEnergy(audio, audio.freq, 200, 2000);
  const high = bandEnergy(audio, audio.freq, 2000, 8000);

  const energy = mean / 255;
  const sumBands = low + mid + high + 1e-6;
  const hiss = high / sumBands;
  const noise = clamp(0.6 * energy + 0.4 * hiss, 0, 1);

  return {
    noise,
    threshold: 60 + noise * 140,
    low: low * 255,
    mid: mid * 255,
    high: high * 255,
  };
}

function bandEnergy(audio, spec, fromHz, toHz) {
  if (!audio.ctx) return 0;

  const nyq = audio.ctx.sampleRate / 2;
  const n = spec.length;
  const from = clamp(Math.floor((fromHz / nyq) * n), 0, n - 1);
  const to = clamp(Math.floor((toHz / nyq) * n), 0, n - 1);

  if (to <= from) return 0;

  let sum = 0;
  for (let i = from; i <= to; i++) sum += spec[i];
  return sum / (to - from + 1) / 255;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothFeatures(next) {
  visualFeat.noise = lerp(visualFeat.noise, next.noise ?? 0, 0.14);
  visualFeat.threshold = lerp(visualFeat.threshold, next.threshold ?? 60, 0.12);
  visualFeat.low = lerp(visualFeat.low, next.low ?? 0, 0.16);
  visualFeat.mid = lerp(visualFeat.mid, next.mid ?? 0, 0.18);
  visualFeat.high = lerp(visualFeat.high, next.high ?? 0, 0.2);
  return { ...visualFeat };
}

function setInitError(message) {
  if (!message || initError) return;
  initError = message;
}

async function ensureLiveVideo() {
  if (liveVideo) return;

  liveVideo = createCapture(VIDEO, () => {
    liveReady = true;
  });
  liveVideo.size(width, height);
  liveVideo.hide();
  liveVideo.elt.playsInline = true;
  liveVideo.elt.setAttribute("playsinline", "true");
}

async function ensureFileVideo() {
  if (fileVideo) return;

  fileVideo = createVideo([VIDEO_PATH]);
  fileVideo.size(width, height);
  fileVideo.hide();
  fileVideo.volume(1);
  fileVideo.elt.loop = true;
  fileVideo.elt.playsInline = true;
  fileVideo.elt.setAttribute("playsinline", "true");
  fileVideo.elt.preload = "auto";

  await new Promise((resolve, reject) => {
    if (fileVideo.elt.readyState >= 2) {
      fileReady = true;
      resolve();
      return;
    }

    const onReady = () => {
      fileReady = true;
      resolve();
    };
    const onError = () => reject(new Error("failed to load subway.mp4"));

    fileVideo.elt.addEventListener("loadeddata", onReady, { once: true });
    fileVideo.elt.addEventListener("error", onError, { once: true });
  });
}

async function ensureLiveAudio() {
  if (liveAudio.ready) {
    if (liveAudio.ctx && liveAudio.ctx.state === "suspended") {
      await liveAudio.ctx.resume();
    }
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    liveAudio.ctx = new AudioCtx();
    if (liveAudio.ctx.state === "suspended") await liveAudio.ctx.resume();

    liveAudio.stream = stream;
    liveAudio.source = liveAudio.ctx.createMediaStreamSource(stream);
    liveAudio.analyser = liveAudio.ctx.createAnalyser();
    liveAudio.analyser.fftSize = 2048;
    liveAudio.analyser.smoothingTimeConstant = 0.85;
    liveAudio.source.connect(liveAudio.analyser);
    liveAudio.freq = new Uint8Array(liveAudio.analyser.frequencyBinCount);
    liveAudio.ready = true;
  } catch (e) {
    lastAppendError = `live audio unavailable: ${e?.message || "permission denied"}`;
  }
}

async function ensureFileAudio() {
  if (!fileVideo || !fileReady) return;

  if (fileAudio.ready) {
    if (fileAudio.ctx && fileAudio.ctx.state === "suspended") {
      await fileAudio.ctx.resume();
    }
    return;
  }

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    fileAudio.ctx = new AudioCtx();
    if (fileAudio.ctx.state === "suspended") await fileAudio.ctx.resume();

    fileAudio.source = fileAudio.ctx.createMediaElementSource(fileVideo.elt);
    fileAudio.analyser = fileAudio.ctx.createAnalyser();
    fileAudio.analyser.fftSize = 2048;
    fileAudio.analyser.smoothingTimeConstant = 0.85;
    fileAudio.silentGain = fileAudio.ctx.createGain();
    fileAudio.silentGain.gain.value = 0;

    fileAudio.source.connect(fileAudio.analyser);
    fileAudio.analyser.connect(fileAudio.silentGain);
    fileAudio.silentGain.connect(fileAudio.ctx.destination);
    fileAudio.freq = new Uint8Array(fileAudio.analyser.frequencyBinCount);
    fileAudio.ready = true;
  } catch (e) {
    lastAppendError = `file audio unavailable: ${e?.message || "audio init failed"}`;
  }
}

async function startCapture() {
  initError = "";

  try {
    await userStartAudio();
  } catch (e) {
    initError = e?.message || "capture init failed";
    console.error(e);
    return;
  }

  try {
    await ensureLiveVideo();
  } catch (e) {
    setInitError(e?.message || "live camera init failed");
    console.error(e);
  }

  try {
    await ensureFileVideo();
  } catch (e) {
    setInitError(e?.message || "subway.mp4 init failed");
    console.error(e);
  }

  if (fileVideo && fileReady && fileVideo.elt) {
    try {
      await fileVideo.elt.play();
    } catch (e) {
      setInitError(e?.message || "subway.mp4 play failed");
      console.error(e);
    }
  }

  try {
    await ensureLiveAudio();
  } catch (e) {
    setInitError(e?.message || "live audio init failed");
    console.error(e);
  }

  try {
    await ensureFileAudio();
  } catch (e) {
    setInitError(e?.message || "file audio init failed");
    console.error(e);
  }
}

function draw() {
  background(0);

  try {
    const state = getSourceState();

    // Use one feature shape in both modes: demo first, then switch to live audio.
    const raw = DEMO_VISUAL ? demoFeatures() : audioFeatures(activeSource);
    const a = smoothFeatures(raw);

    // ---- VISUAL (only when video is ready) ----
    if (state.video && state.video.elt && state.video.elt.readyState >= 2) {
      // Render the opaque block collage.
      window.Visual.drawLayeredBlocks(state.video, a, {
        showPaperGrid: true,  // Set to false for a cleaner background.
      });

      // Refresh ready flags once the source can render.
      if (activeSource === "live") liveReady = true;
      if (activeSource === "file") fileReady = true;
    }

    // ---- RECORD (same `a` as visual) ----
    if (recording && state.ready && millis() - lastSent > INTERVAL) {
      lastSent = millis();

      appendRecord({
        t: Number((millis() / 1000).toFixed(3)),
        source: state.recordSource,
        noise: a.noise,
        threshold: a.threshold,
        low: a.low,
        mid: a.mid,
        high: a.high,
      });
    }

    fill(0, 180);
    noStroke();
    rect(0, 0, width, 82);
    fill(255);
    textSize(14);
    text(`source: ${state.label} | press 1 = live, 2 = file`, 12, 22);
    text(`status: ${state.ready ? "ready" : "click/tap to initialize"}`, 12, 42);
    text(`append ok: ${appendCount} | last: ${lastAppendAt}`, 12, 62);

    if (lastAppendError) {
      fill(255, 120, 120);
      text(`append error: ${lastAppendError}`, 280, 62);
    }

    if (initError) {
      fill(255, 120, 120);
      text(`init error: ${initError}`, 12, 104);
    }
  } catch (e) {
    initError = e?.message || "draw failed";
  }
}

async function mousePressed() {
  await startCapture();
}

async function touchStarted() {
  await startCapture();
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

  if (key === "1") activeSource = "live";
  if (key === "2") activeSource = "file";
  await startCapture();
}

function windowResized() {
  if (fullscreen()) {
    resizeCanvas(windowWidth, windowHeight);
  }
}

async function appendRecord(record) {
  try {
    const res = await fetch("/api/append", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });

    if (!res.ok) {
      lastAppendError = `HTTP ${res.status}`;
      return;
    }

    const data = await res.json();
    appendCount = Number(data.count ?? appendCount + 1);
    lastAppendAt = new Date().toLocaleTimeString();

    if (
      !String(lastAppendError).startsWith("live audio unavailable") &&
      !String(lastAppendError).startsWith("file audio unavailable")
    ) {
      lastAppendError = "";
    }
  } catch (e) {
    lastAppendError = e?.message || "network error";
    console.error("append failed", e);
  }
}

function demoFeatures() {
  // Mouse X drives noise, mouse Y drives highs, and time drives mids/lows.
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
    low, mid, high,
  };
}
