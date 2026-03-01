# Sound Module Handoff

## 1. Scope

- I am responsible for capturing camera/microphone input, extracting audio features, and outputting structured data.
- You are responsible for consuming that data and mapping it to real-time visuals.

Recommended collaboration boundary:

- Sound side: `input -> analysis -> data`
- Visual side: `data -> mapping -> rendering`

## 2. Current Output

- The sound module currently emits one feature record roughly every `100ms`.
- Data is available from:
  - `data/session.json`
  - `GET /api/data`
  - `GET /api/stats`
- The backend receives individual records through:
  - `POST /api/append`

## 3. Record Format

```json
{
  "ts": "2026-02-27T20:42:46.670Z",
  "t": 12.314,
  "source": "live_cam",
  "noise": 0.38,
  "threshold": 113.2,
  "low": 45.2,
  "mid": 88.6,
  "high": 23.4
}
```

## 4. Field Meanings

`ts`

- English: ISO timestamp when the record was saved

`t`

- English: relative elapsed time in seconds

`source`

- English: source label, currently `live_cam`

`noise`

- English: overall noise intensity, expected range `0..1`

`threshold`

- English: threshold derived from sound intensity, roughly `60..200`

`low`

- English: low-frequency energy, roughly `0..255`

`mid`

- English: mid-frequency energy, roughly `0..255`

`high`

- English: high-frequency energy, roughly `0..255`

## 5. Suggested Mapping

`noise`

- English: can drive particle density, distortion amount, blur, or global jitter

`threshold`

- English: can drive binarization threshold, edge cutoff, or shader thresholds

`low`

- English: good for scale, expansion, and heavier motion accents

`mid`

- English: good for body motion, deformation, and line thickness

`high`

- English: good for flicker, grain, noise, and sharp detail changes

## 6. Integration Notes

- The update interval is `100ms`, not every render frame.
- Visual smoothing is recommended; do not hard-map raw values directly.
- If microphone permission is unavailable, audio-derived values may temporarily stay near `0`.
- The visual side should depend on the output fields, not on the sound module internals.

## 7. Recommended Next Step

1. Start by reading `data/session.json` or consuming real-time data with the same shape.
2. Use only these fields first:
   - `noise`
   - `low`
   - `mid`
   - `high`
3. Build a minimal reactive visual prototype first.
4. After validating the feel of the data, decide whether the sound-side parameters need adjustment.

## 8. How To Request Changes

Useful feedback requests:

- "This value is too jumpy; I need it to be more stable."
- "This range is too small; the visual response is too weak."
- "I need faster updates."
- "I need a stronger dedicated bass driver."
- "I need clearer beat/transient detection."

## 9. Current Collaboration Goal

- First establish a stable data contract.
- I will keep the output fields stable.
- You build the visual mapping on top of those fields.
- If the mapping does not feel right, we adjust the parameters together afterward.
