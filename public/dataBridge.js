// dataBridge.js
// Polls the saved JSON endpoint and exposes the latest persisted feature values on window.FEAT.

window.FEAT = {
  noise: 0,
  threshold: 60,
  low: 0, mid: 0, high: 0
};

// Use fake data first if needed: true = synthetic data, false = real data.
window.USE_FAKE_DATA = false;

function pickLatest(payload) {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload[payload.length - 1] ?? null;
  if (Array.isArray(payload.records)) return payload.records[payload.records.length - 1] ?? null;
  if (payload.record) return payload.record;
  return payload;
}

async function fetchLatest() {
  // realtime first
  try {
    const r1 = await fetch("/api/data", { cache: "no-store" });
    if (r1.ok) {
      const j1 = await r1.json();
      const rec = pickLatest(j1);
      if (rec) return rec;
    }
  } catch (e) {}

  // fallback file
  try {
    const r2 = await fetch("/data/session.json", { cache: "no-store" });
    if (r2.ok) {
      const j2 = await r2.json();
      const rec2 = pickLatest(j2);
      if (rec2) return rec2;
    }
  } catch (e) {}

  return null;
}

// Synthetic data for visual tuning before live input is available.
function fakeData(t) {
  const noise = 0.5 + 0.5 * Math.sin(t * 0.0015);
  const low = 140 + 80 * Math.sin(t * 0.001);
  const mid = 120 + 90 * Math.sin(t * 0.0019);
  const high = 80 + 120 * Math.sin(t * 0.0032);
  return {
    noise,
    threshold: 60 + noise * 140,
    low, mid, high
  };
}

setInterval(async () => {
  if (window.USE_FAKE_DATA) {
    window.FEAT = fakeData(performance.now());
    return;
  }

  const rec = await fetchLatest();
  if (!rec) return;

  window.FEAT = {
    noise: Number(rec.noise ?? 0),
    threshold: Number(rec.threshold ?? 60),
    low: Number(rec.low ?? 0),
    mid: Number(rec.mid ?? 0),
    high: Number(rec.high ?? 0),
  };
}, 100);
