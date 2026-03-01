// public/visual.js
// Opaque Pixel Blocks (IDEA-cover style): hard grid + bold palette + patterns

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function sampleVideoRGB(vid, x, y) {
  const ix = Math.floor(clamp(x, 0, vid.width - 1));
  const iy = Math.floor(clamp(y, 0, vid.height - 1));
  const idx = 4 * (iy * vid.width + ix);
  const p = vid.pixels;
  return { r: p[idx], g: p[idx + 1], b: p[idx + 2] };
}

function luminance(rgb) {
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

function easeInOutCubic(t) {
  if (t < 0.5) return 4 * t * t * t;
  return 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function hash01(x, y, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function flowNoise(x, y, seed = 0, speed = 0.01) {
  return noise(
    x * 0.17 + seed * 11.3,
    y * 0.19 + seed * 7.1,
    frameCount * speed + seed * 3.7
  );
}

// Bold print-style palette: green/pink/blue/yellow + black/white/gray + red accent
function ideaPalette() {
  return [
    { r: 0,   g: 0,   b: 0   }, // black
    { r: 245, g: 245, b: 245 }, // white-ish
    { r: 40,  g: 220, b: 120 }, // neon green
    { r: 255, g: 95,  b: 210 }, // hot pink
    { r: 60,  g: 120, b: 255 }, // vivid blue
    { r: 255, g: 230, b: 70  }, // yellow
    { r: 220, g: 60,  b: 60  }, // red
    { r: 120, g: 120, b: 120 }, // gray
  ];
}

function fillSolid(c) {
  noStroke();
  fill(c.r, c.g, c.b, 255); // fully opaque
}

// --- patterns (all opaque-ish, like print) ---
function patternDots(x, y, w, h, ink, density01) {
  // The base layer is already drawn; this only adds the dot ink.
  push();
  noStroke();
  fill(ink.r, ink.g, ink.b, 255);

  const step = Math.floor(map(1 - density01, 0, 1, 4, 10)); // Higher density means tighter spacing.
  const r = Math.max(1, Math.floor(step * 0.22));

  for (let yy = y + step / 2; yy < y + h; yy += step) {
    for (let xx = x + step / 2; xx < x + w; xx += step) {
      // Add slight print-style randomness to the dot grid without frame-to-frame popping.
      const jx = (hash01(xx, yy, 0.31) - 0.5) * r;
      const jy = (hash01(xx, yy, 1.17) - 0.5) * r;
      circle(xx + jx, yy + jy, r * 2);
    }
  }
  pop();
}

function patternStripes(x, y, w, h, ink, density01, angle = 45) {
  push();
  stroke(ink.r, ink.g, ink.b, 255);
  strokeWeight(Math.floor(map(density01, 0, 1, 1, 3)));

  // Use density to control stripe spacing.
  const gap = map(1 - density01, 0, 1, 6, 16);

  // Rotate the coordinate system before drawing stripes.
  translate(x + w / 2, y + h / 2);
  rotate(radians(angle));
  translate(-w / 2, -h / 2);

  for (let i = -h; i < w + h; i += gap) {
    line(i, 0, i + h, h);
  }
  pop();
}

function patternGrain(x, y, w, h, ink, density01) {
  push();
  noStroke();
  fill(ink.r, ink.g, ink.b, 255);
  const n = Math.floor(map(density01, 0, 1, 30, 140));
  for (let i = 0; i < n; i++) {
    const px = x + hash01(x + i, y, 2.41) * w;
    const py = y + hash01(x, y + i, 3.13) * h;
    rect(px, py, 1, 1);
  }
  pop();
}

// Assign each sampled block to one of the print colors.
function classifyColor(rgb, pal, threshold = 60) {
  const lum = luminance(rgb);
  const thr01 = clamp((threshold - 60) / 140, 0, 1);
  const darkCut = lerp(0.12, 0.30, thr01);
  const lightCut = lerp(0.92, 0.76, thr01);
  const chromaBias = lerp(0.38, 0.62, thr01);

  // Brightness selects black/white/gray; hue bias selects green/pink/blue/yellow.
  if (lum < darkCut) return pal[0];      // black
  if (lum > lightCut) return pal[1];     // white

  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const maxc = Math.max(r, g, b);

  // Strong color bias.
  if (maxc === g && g > chromaBias) return pal[2];         // green
  if (maxc === b && b > chromaBias) return pal[4];         // blue
  if (r > chromaBias + 0.10 && b > chromaBias) return pal[3]; // pink-ish region
  if (r > chromaBias + 0.10 && g > chromaBias) return pal[5]; // yellow-ish

  // Neutral colors fall back to gray.
  return pal[7];
}

/**
 * drawLayeredBlocks(video, features, opts)
 * This keeps the original function name but renders an opaque IDEA-style pixel collage.
 */
function drawLayeredBlocks(vid, a, opts = {}) {
  const pal = ideaPalette();

  const hi01 = clamp(a.high / 255, 0, 1);
  const mid01 = clamp(a.mid / 255, 0, 1);
  const noise01 = clamp(a.noise, 0, 1);
  const threshold = a.threshold ?? 60;
  const noiseWarp = easeInOutCubic(noise01);
  const calmness = 1 - noiseWarp;

  // Keep the size range expressive, but reduce the overall block scale.
  const cell = Math.floor(map(noiseWarp, 0, 1, 30, 5));
  const jitter = map(mid01, 0, 1, 0, cell * 0.55);

  // Increase pink presence as high frequencies rise.
  const pinkBoost = map(hi01, 0, 1, 0.06, 0.22);

  // Higher frequencies make overlay patterns denser.
  const patDensity = clamp(0.25 + hi01 * 0.65, 0, 1);

  background(245); // paper-like white base

  // Load video pixels before sampling.
  if (vid && vid.elt && vid.elt.readyState >= 2) {
    vid.loadPixels();
  }

  // Add a coarse guide grid for a paper / print feel.
  if (opts.showPaperGrid ?? true) {
    push();
    stroke(0, 0, 0, 35);
    strokeWeight(1);
    const g = cell * 2;
    for (let x = 0; x < width; x += g) line(x, 0, x, height);
    for (let y = 0; y < height; y += g) line(0, y, width, y);
    pop();
  }

  // Main block grid.
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let x = gx * cell;
      let y = gy * cell;
      const sizeRoll = flowNoise(gx, gy, 0.17, 0.008);
      const colorRoll = flowNoise(gx, gy, 1.11, 0.006);
      const greenRoll = flowNoise(gx, gy, 2.03, 0.006);
      const monoRoll = flowNoise(gx, gy, 2.91, 0.006);
      const patternRoll = flowNoise(gx, gy, 3.77, 0.01);
      const patternTypeRoll = flowNoise(gx, gy, 4.53, 0.01);
      const barcodeRoll = flowNoise(gx, gy, 5.29, 0.008);
      const widthBias = flowNoise(gx, gy, 17.03, 0.005) < calmness * 0.45 ? 1 : 0;
      const heightBias = flowNoise(gx, gy, 18.19, 0.005) < calmness * 0.35 ? 1 : 0;

      // Add jitter for slight misregistration.
      const jx = (flowNoise(gx, gy, 6.11, 0.012) - 0.5) * jitter;
      const jy = (flowNoise(gx, gy, 7.07, 0.012) - 0.5) * jitter;

      // Use the video sample to choose the base color.
      let base = pal[Math.floor(flowNoise(gx, gy, 19.07, 0.004) * pal.length)];
      if (vid && vid.pixels && flowNoise(gx, gy, 8.21, 0.004) < 0.85) {
        const sx = (x / width) * vid.width;
        const sy = (y / height) * vid.height;
        const rgb = sampleVideoRGB(vid, sx, sy);
        base = classifyColor(rgb, pal, threshold);
      }

      // Make pink slightly more common.
      if (colorRoll < pinkBoost) base = pal[3];

      // Push green a bit harder as well.
      if (greenRoll < 0.10) base = pal[2];

      // Let black/white blocks create a symbolic pixel feel.
      if (monoRoll < 0.12) base = flowNoise(gx, gy, 9.37, 0.004) < 0.55 ? pal[0] : pal[1];

      // Favor rectangular blocks over squares so the layout feels less uniform.
      let wUnits = 1;
      let hUnits = 1;
      const largeChance = 0.04 + calmness * 0.16;
      const wideChance = 0.14 + calmness * 0.22;
      const tallChance = 0.12 + calmness * 0.20;
      const longWideChance = 0.08 + calmness * 0.14;
      const longTallChance = 0.07 + calmness * 0.12;
      const panelChance = 0.05 + calmness * 0.10;
      const microChance = 0.10 + noiseWarp * 0.30;
      const t1 = longWideChance * 0.45;
      const t2 = longWideChance;
      const t3 = t2 + longTallChance * 0.45;
      const t4 = t2 + longTallChance;
      const t5 = t4 + panelChance * 0.5;
      const t6 = t4 + panelChance;
      const t7 = t6 + largeChance * 0.4;
      const t8 = t6 + largeChance;
      const t9 = t8 + wideChance;
      const t10 = t9 + tallChance;

      if (sizeRoll < t1) {
        wUnits = 4 + widthBias;
        hUnits = 1;
      } else if (sizeRoll < t2) {
        wUnits = 3 + widthBias;
        hUnits = 1;
      } else if (sizeRoll < t3) {
        wUnits = 1;
        hUnits = 4 + heightBias;
      } else if (sizeRoll < t4) {
        wUnits = 1;
        hUnits = 3 + heightBias;
      } else if (sizeRoll < t5) {
        wUnits = 3 + widthBias;
        hUnits = 2;
      } else if (sizeRoll < t6) {
        wUnits = 2;
        hUnits = 3 + heightBias;
      } else if (sizeRoll < t7) {
        wUnits = 3 + widthBias;
        hUnits = 3 + heightBias;
      } else if (sizeRoll < t8) {
        wUnits = 2 + widthBias;
        hUnits = 2 + heightBias;
      } else if (sizeRoll < t9) {
        wUnits = 2 + widthBias;
      } else if (sizeRoll < t10) {
        hUnits = 2 + heightBias;
      } else if (sizeRoll > 1 - microChance) {
        wUnits = 0.65;
        hUnits = 0.65;
      }

      let w = cell * wUnits;
      let h = cell * hUnits;

      // Draw the opaque base block.
      fillSolid(base);
      rect(x + jx, y + jy, w, h);

      // Overlay a pattern on some blocks.
      const doPattern = patternRoll < (0.35 + hi01 * 0.35);
      if (doPattern) {
        // Pattern ink usually stays dark, like printed ink.
        const ink = (base === pal[0] || base === pal[7]) ? pal[1] : pal[0];

        const pt = patternTypeRoll;
        if (pt < 0.45) patternDots(x + jx, y + jy, w, h, ink, patDensity);
        else if (pt < 0.80) patternStripes(x + jx, y + jy, w, h, ink, patDensity, 45);
        else patternGrain(x + jx, y + jy, w, h, ink, patDensity);
      }

      // Occasionally add barcode-like black line accents.
      if (barcodeRoll < 0.05) {
        push();
        noStroke();
        fill(0, 0, 0, 255);
        const bx = x + jx + flowNoise(gx, gy, 10.13, 0.01) * (w * 0.4);
        const by = y + jy + flowNoise(gx, gy, 11.07, 0.01) * (h * 0.4);
        const bw = Math.max(2, Math.floor(w * 0.55));
        const bh = Math.max(2, Math.floor(h * 0.12));
        for (let k = 0; k < 6; k++) {
          rect(bx + k * (bw / 8), by + k * 2, bw / 14, bh + k);
        }
        pop();
      }
    }
  }

  // Add a few top-layer sticker-like blocks.
  const stickers = Math.floor(4 + hi01 * 8 + calmness * 4);
  for (let i = 0; i < stickers; i++) {
    const stickerRoll = hash01(i, 0.5, 12.19);
    const stickerUnits = 2 + Math.floor(stickerRoll * (3 + Math.floor(calmness * 4)));
    const s = cell * stickerUnits;
    const x = hash01(i, 1.5, 13.01) * (width - s);
    const y = hash01(i, 2.5, 14.07) * (height - s);

    const c = hash01(i, 3.5, 15.11) < 0.55 ? pal[2] : pal[3]; // green / pink
    fillSolid(c);
    rect(x, y, s, s);

    // Add dots or stripes on top of the sticker blocks.
    const ink = pal[0];
    if (hash01(i, 4.5, 16.09) < 0.6) patternDots(x, y, s, s, ink, 0.65);
    else patternStripes(x, y, s, s, ink, 0.65, 45);
  }

  // No extra overlay text here; the info bar in sketch.js is enough.
}

window.Visual = { drawLayeredBlocks };
