# City Sound Data Visualisation

A small Express + p5.js project that captures audio features from either a live camera/microphone setup or a local video file, stores those features in `data/session.json`, and visualizes the persisted data as a canvas-based graphic system.

## Team Roles

- Yerie - sound side: `input -> analysis -> data`
- Shuran - visual side: `data -> mapping -> render`

## What It Does

- `Live` mode uses the device camera for the image layer and the microphone for audio feature detection.
- `File` mode uses `City_Sound/subway.mp4` for both the image layer and the audio feature source.
- Detected audio features are written to `data/session.json` through the backend.
- The frontend reads the saved JSON back and uses those persisted values to drive the visual output.

The current detected values and the current rendered values are intentionally separated:

- detection path: `sound.js -> capture.js -> /api/append -> data/session.json`
- visualization path: `data/session.json -> /api/data -> dataBridge.js -> sketch.js -> visual.js`

## Tech Stack

- Node.js
- Express
- p5.js
- Web Audio API

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open one of the URLs printed in the terminal, usually:

```text
http://localhost:3000
```

The server also prints local network URLs for testing on mobile devices.

## Controls

- Click or tap the page to initialize media permissions if the browser blocks autoplay/audio startup.
- Use the on-screen `Live` / `File` buttons in the HUD to switch sources.
- Press `F` to toggle fullscreen.
- Press `S` to save the current canvas as a PNG.
- Press `1` for `Live`.
- Press `2` for `File`.

## Mobile Notes

- `Live` mode requires camera and microphone permissions.
- On mobile, the live camera is configured to prefer the rear camera (`facingMode: "environment"`).
- Live camera/mic access requires `HTTPS` or `localhost` in most browsers.

## Data File

Captured feature data is saved to:

```text
data/session.json
```

The backend keeps existing data on restart and reloads it from disk at boot.

Useful endpoints:

- `GET /api/data` returns the saved JSON
- `POST /api/append` appends one feature record
- `POST /api/reset` clears the current session
- `GET /api/stats` returns simple backend stats

## Project Structure

- `app.js`: Express server, static file hosting, and JSON persistence.
- `public/index.html`: App shell and script loading order.
- `public/style.css`: HUD and page styling.
- `public/sound.js`: Audio-analysis helpers built on the Web Audio API.
- `public/capture.js`: Source selection, media initialization, and feature recording.
- `public/dataBridge.js`: Polls saved JSON and exposes the latest persisted feature values.
- `public/sketch.js`: p5 setup, HUD interaction, and render orchestration.
- `public/visual.js`: Main canvas visualization logic.
- `City_Sound/subway.mp4`: Default local media file used in `File` mode.

## Development Notes

- `p5.js` and `p5.sound.min.js` are vendor files and are not meant to be edited.
- The visual layer is canvas-based, so the main generative artwork lives in JavaScript (`visual.js`), while the HUD/interface layer lives in HTML/CSS.
