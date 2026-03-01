// app.js
// Starts the Express server, serves the frontend/media files, and persists detected feature data to data/session.json.
import fs from "fs";
import os from "os";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, "data");
const FILE = path.join(DATA_DIR, "session.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const MEDIA_DIR = path.join(__dirname, "City_Sound");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let buffer = [];
let meta = { createdAt: new Date().toISOString() };

app.use(express.static(PUBLIC_DIR));
app.use("/City_Sound", express.static(MEDIA_DIR));
app.use(express.json({ limit: "1mb" }));
app.get("/", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

function writeToDisk() {
  const payload = { meta, records: buffer };
  fs.writeFileSync(FILE, JSON.stringify(payload, null, 2), "utf-8");
}

function loadFromDisk() {
  if (!fs.existsSync(FILE)) {
    writeToDisk();
    return;
  }

  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    const parsed = JSON.parse(raw);
    buffer = Array.isArray(parsed?.records) ? parsed.records : [];
    meta = parsed?.meta && typeof parsed.meta === "object"
      ? parsed.meta
      : { createdAt: new Date().toISOString() };
  } catch (e) {
    buffer = [];
    meta = { createdAt: new Date().toISOString() };
    writeToDisk();
  }
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getAccessUrls(port) {
  const urls = [`http://localhost:${port}`];
  const nets = os.networkInterfaces();

  for (const group of Object.values(nets)) {
    for (const info of group ?? []) {
      if (info.family !== "IPv4" || info.internal) continue;
      urls.push(`http://${info.address}:${port}`);
    }
  }

  return [...new Set(urls)];
}

// Load an existing session if present; otherwise create the file.
loadFromDisk();

// reset session
app.post("/api/reset", (req, res) => {
  buffer = [];
  meta = { createdAt: new Date().toISOString(), ...req.body };
  writeToDisk();
  res.json({ ok: true, message: "reset" });
});

// append one record
app.post("/api/append", (req, res) => {
  const body = req.body || {};

  // whitelist only feature fields (no raw audio, no personal data)
  const record = {
    ts: new Date().toISOString(),
    t: toNumber(body.t),
    source: String(body.source ?? "unknown"),

    noise: toNumber(body.noise),
    threshold: toNumber(body.threshold),

    low: toNumber(body.low),
    mid: toNumber(body.mid),
    high: toNumber(body.high),
  };

  buffer.push(record);
  writeToDisk();

  res.json({ ok: true, count: buffer.length });
});

// get saved json
app.get("/api/data", (req, res) => {
  if (!fs.existsSync(FILE)) writeToDisk();
  res.sendFile(FILE);
});

app.get("/api/stats", (_req, res) => {
  res.json({
    ok: true,
    count: buffer.length,
    file: FILE,
    exists: fs.existsSync(FILE),
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server is running. Open one of these URLs:");
  for (const url of getAccessUrls(PORT)) {
    console.log(`  ${url}`);
  }
});
