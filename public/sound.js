// public/sound.js
// Realtime camera + audio (single MediaStream) -> AnalyserNode -> features

class RealtimeCamAudioAnalyser {
  constructor(opts = {}) {
    this.fftSize = opts.fftSize ?? 2048;
    this.smoothing = opts.smoothing ?? 0.85;

    this.thresholdMin = opts.thresholdMin ?? 60;
    this.thresholdMax = opts.thresholdMax ?? 200;
    this.ctx = null;
    this.stream = null;

    this.videoEl = null;   // HTMLVideoElement that plays the stream
    this.source = null;    // MediaStreamSource
    this.analyser = null;  // AnalyserNode
    this.freq = null;      // Uint8Array

    this.ready = false;
    this.audioEnabled = true;

    // smoothed outputs
    this._noise = 0;
    this._thr = 128;
  }

  // Must be called after user gesture (e.g., mousePressed) to avoid autoplay restrictions
  async init() {
    if (this.ready) return;

    // 1) request camera+mic stream, fallback to video-only
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      this.audioEnabled = true;
    } catch (_err) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      this.audioEnabled = false;
    }

    // 2) create a video element to play the stream (for pixels)
    this.videoEl = document.createElement("video");
    this.videoEl.autoplay = true;
    this.videoEl.muted = true;        // avoid feedback (your speakers -> mic)
    this.videoEl.playsInline = true;  // iOS friendly
    this.videoEl.setAttribute("playsinline", "true");
    this.videoEl.srcObject = this.stream;

    // wait until metadata is ready (width/height become available)
    await new Promise((resolve) => {
      this.videoEl.onloadedmetadata = () => resolve();
    });
    try {
      await this.videoEl.play();
    } catch (_e) {
      // On some browsers play() may still require a user gesture.
      // sketch.js startCapture is called from click/touch/key.
    }

    // 3) setup Web Audio analyser (if audio track is available)
    if (this.audioEnabled) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = RealtimeCamAudioAnalyser.sharedCtx ?? new AudioCtx();
      RealtimeCamAudioAnalyser.sharedCtx = this.ctx;

      this.source = this.ctx.createMediaStreamSource(this.stream);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = this.smoothing;

      this.source.connect(this.analyser);

      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    } else {
      this.ctx = null;
      this.source = null;
      this.analyser = null;
      this.freq = null;
    }
    this.ready = true;
  }

  // expose video element for drawing in p5: image(videoEl, ...)
  getVideoElement() {
    return this.videoEl;
  }

  // stop camera/mic when you’re done
  dispose() {
    try { if (this.source) this.source.disconnect(); } catch (e) {}
    try { if (this.analyser) this.analyser.disconnect(); } catch (e) {}

    if (this.stream) {
      // stop all tracks
      this.stream.getTracks().forEach((t) => t.stop());
    }

    this.stream = null;
    this.videoEl = null;
    this.source = null;
    this.analyser = null;
    this.freq = null;
    this.ready = false;
  }

  _lerp(a, b, t) { return a + (b - a) * t; }
  _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  _bandEnergy(spec, fromHz, toHz) {
    const nyq = this.ctx.sampleRate / 2;
    const n = spec.length;
    const from = this._clamp(Math.floor((fromHz / nyq) * n), 0, n - 1);
    const to = this._clamp(Math.floor((toHz / nyq) * n), 0, n - 1);
    if (to <= from) return 0;

    let sum = 0;
    for (let i = from; i <= to; i++) sum += spec[i];
    return sum / (to - from + 1); // 0..255
  }

  update() {
    if (!this.ready) return null;
    if (!this.audioEnabled || !this.analyser || !this.freq) {
      return {
        noise: 0,
        threshold: this.thresholdMin,
        low: 0, mid: 0, high: 0,
      };
    }

    this.analyser.getByteFrequencyData(this.freq);

    // overall energy 0..1
    let mean = 0;
    for (let i = 0; i < this.freq.length; i++) mean += this.freq[i];
    mean /= this.freq.length;       // 0..255
    const energy = mean / 255;

    // bands 0..1
    const lowE = this._bandEnergy(this.freq, 20, 200) / 255;
    const midE = this._bandEnergy(this.freq, 200, 2000) / 255;
    const highE = this._bandEnergy(this.freq, 2000, 8000) / 255;

    const sumBands = lowE + midE + highE + 1e-6;
    const hiss = highE / sumBands;

    // noise proxy
    const noiseRaw = this._clamp(0.6 * energy + 0.4 * hiss, 0, 1);
    this._noise = this._lerp(noiseRaw, this._noise, 0.9);

    // map to threshold
    const thrTarget = this._lerp(this.thresholdMin, this.thresholdMax, this._noise);
    this._thr = this._lerp(thrTarget, this._thr, 0.85);

    // return smoothed features
    return {
      noise: this._noise,       // 0..1
      threshold: this._thr,     // 0..255
      low: lowE * 255,
      mid: midE * 255,
      high: highE * 255,
    };
  }
}
