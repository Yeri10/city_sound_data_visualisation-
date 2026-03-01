// sound.js
// Provides the shared audio analysis helpers used to turn live/file audio into feature values.
window.SoundBridge = (() => {
  let sharedCtx = null;

  function createState() {
    return {
      ctx: null,
      source: null,
      analyser: null,
      freq: null,
      silentGain: null,
      stream: null,
      ready: false,
    };
  }

  async function getContext(existingCtx = null) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    sharedCtx = existingCtx ?? sharedCtx ?? new AudioCtx();

    if (sharedCtx.state === "suspended") {
      await sharedCtx.resume();
    }

    return sharedCtx;
  }

  function resetState(state) {
    try {
      state.source?.disconnect();
    } catch (e) {}

    try {
      state.analyser?.disconnect();
    } catch (e) {}

    try {
      state.silentGain?.disconnect();
    } catch (e) {}

    state.source = null;
    state.analyser = null;
    state.freq = null;
    state.silentGain = null;
    state.ready = false;
  }

  function ensureAnalyser(state, ctx) {
    state.ctx = ctx;
    state.analyser = ctx.createAnalyser();
    state.analyser.fftSize = 2048;
    state.analyser.smoothingTimeConstant = 0.85;
    state.freq = new Uint8Array(state.analyser.frequencyBinCount);
  }

  async function attachStream(state, stream) {
    const ctx = await getContext(state.ctx);
    resetState(state);

    state.stream = stream;
    state.source = ctx.createMediaStreamSource(stream);
    ensureAnalyser(state, ctx);
    state.source.connect(state.analyser);
    state.ready = true;
    return state;
  }

  async function attachMediaElement(state, element) {
    const ctx = await getContext(state.ctx);

    if (state.ready && state.source && state.analyser && state.freq) {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      return state;
    }

    resetState(state);

    state.source = ctx.createMediaElementSource(element);
    ensureAnalyser(state, ctx);
    state.silentGain = ctx.createGain();
    state.silentGain.gain.value = 0;

    state.source.connect(state.analyser);
    state.analyser.connect(state.silentGain);
    state.silentGain.connect(ctx.destination);
    state.ready = true;
    return state;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function bandEnergy(state, spec, fromHz, toHz) {
    if (!state.ctx) return 0;

    const nyq = state.ctx.sampleRate / 2;
    const n = spec.length;
    const from = clamp(Math.floor((fromHz / nyq) * n), 0, n - 1);
    const to = clamp(Math.floor((toHz / nyq) * n), 0, n - 1);

    if (to <= from) return 0;

    let sum = 0;
    for (let i = from; i <= to; i++) sum += spec[i];
    return sum / (to - from + 1) / 255;
  }

  function readFeatures(state) {
    if (!state?.ready || !state.analyser || !state.freq) {
      return { noise: 0, threshold: 60, low: 0, mid: 0, high: 0 };
    }

    state.analyser.getByteFrequencyData(state.freq);

    let mean = 0;
    for (let i = 0; i < state.freq.length; i++) mean += state.freq[i];
    mean /= state.freq.length;

    const low = bandEnergy(state, state.freq, 20, 200);
    const mid = bandEnergy(state, state.freq, 200, 2000);
    const high = bandEnergy(state, state.freq, 2000, 8000);

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

  return {
    attachMediaElement,
    attachStream,
    createState,
    readFeatures,
  };
})();
