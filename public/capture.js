// capture.js
// Owns source selection, media initialization, feature recording, and append-status state for live/file capture.
window.CaptureBridge = (() => {
  const VIDEO_PATH = "/City_Sound/subway.mp4";
  const INTERVAL = 100;

  let activeSource = "live";
  let recording = true;

  let liveVideo = null;
  let liveReady = false;
  let fileVideo = null;
  let fileReady = false;

  let liveAudio = window.SoundBridge.createState();
  let fileAudio = window.SoundBridge.createState();

  let lastSent = 0;
  let appendCount = 0;
  let lastAppendError = "";
  let lastAppendAt = "-";
  let initError = "";

  function getStatus() {
    return {
      appendCount,
      initError,
      lastAppendAt,
      lastAppendError,
    };
  }

  function setInitError(message) {
    if (!message || initError) return;
    initError = message;
  }

  function setActiveSource(source) {
    if (source === "live" || source === "file") {
      activeSource = source;
    }
  }

  function getActiveSource() {
    return activeSource;
  }

  function getSourceState(sourceKey = activeSource) {
    if (sourceKey === "live") {
      return {
        audio: liveAudio,
        label: "live camera",
        ready: liveReady,
        recordSource: "live_cam",
        video: liveVideo,
      };
    }

    return {
      audio: fileAudio,
      label: "subway.mp4",
      ready: fileReady,
      recordSource: "subway_mp4",
      video: fileVideo,
    };
  }

  function getDetectedFeatures() {
    const state = getSourceState();
    return window.SoundBridge.readFeatures(state.audio);
  }

  function resizeMedia(canvasWidth, canvasHeight) {
    if (liveVideo) liveVideo.size(canvasWidth, canvasHeight);
    if (fileVideo) fileVideo.size(canvasWidth, canvasHeight);
  }

  function needsSecureMediaContext() {
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    return !window.isSecureContext && !isLocalHost;
  }

  async function ensureLiveVideo(canvasWidth, canvasHeight) {
    if (liveVideo) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("camera API unavailable on this device/browser");
    }
    if (needsSecureMediaContext()) {
      throw new Error("live camera on mobile requires HTTPS or localhost");
    }

    liveVideo = createCapture({
      video: {
        facingMode: "environment",
      },
      audio: false,
    }, () => {
      liveReady = true;
    });
    liveVideo.size(canvasWidth, canvasHeight);
    liveVideo.hide();
    liveVideo.elt.playsInline = true;
    liveVideo.elt.setAttribute("playsinline", "true");
    liveVideo.elt.setAttribute("webkit-playsinline", "true");
  }

  async function ensureFileVideo(canvasWidth, canvasHeight) {
    if (fileVideo) return;

    fileVideo = createVideo([VIDEO_PATH]);
    fileVideo.size(canvasWidth, canvasHeight);
    fileVideo.hide();
    fileVideo.volume(1);
    fileVideo.elt.loop = true;
    fileVideo.elt.playsInline = true;
    fileVideo.elt.setAttribute("playsinline", "true");
    fileVideo.elt.setAttribute("webkit-playsinline", "true");
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
    if (liveAudio.ready) return;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("microphone API unavailable on this device/browser");
      }
      if (needsSecureMediaContext()) {
        throw new Error("live microphone on mobile requires HTTPS or localhost");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      await window.SoundBridge.attachStream(liveAudio, stream);
    } catch (e) {
      lastAppendError = `live audio unavailable: ${e?.message || "permission denied"}`;
    }
  }

  async function ensureFileAudio() {
    if (!fileVideo || !fileReady) return;
    if (fileAudio.ready) return;

    try {
      await window.SoundBridge.attachMediaElement(fileAudio, fileVideo.elt);
    } catch (e) {
      lastAppendError = `file audio unavailable: ${e?.message || "audio init failed"}`;
    }
  }

  async function startCapture(canvasWidth, canvasHeight) {
    initError = "";

    try {
      await userStartAudio();
    } catch (e) {
      // Some browsers block audio autoplay until a tap; keep trying the selected source anyway.
      console.error(e);
    }

    if (activeSource === "live") {
      try {
        await ensureLiveVideo(canvasWidth, canvasHeight);
      } catch (e) {
        setInitError(e?.message || "live camera init failed");
        console.error(e);
      }

      try {
        await ensureLiveAudio();
      } catch (e) {
        setInitError(e?.message || "live audio init failed");
        console.error(e);
      }

      return;
    }

    try {
      await ensureFileVideo(canvasWidth, canvasHeight);
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
      await ensureFileAudio();
    } catch (e) {
      setInitError(e?.message || "file audio init failed");
      console.error(e);
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

  function recordDetected(detected, nowMs) {
    const state = getSourceState();
    if (!recording || !state.ready || nowMs - lastSent <= INTERVAL) return;

    lastSent = nowMs;
    void appendRecord({
      t: Number((nowMs / 1000).toFixed(3)),
      source: state.recordSource,
      noise: detected.noise,
      threshold: detected.threshold,
      low: detected.low,
      mid: detected.mid,
      high: detected.high,
    });
  }

  return {
    getActiveSource,
    getDetectedFeatures,
    getSourceState,
    getStatus,
    recordDetected,
    resizeMedia,
    setActiveSource,
    startCapture,
  };
})();
