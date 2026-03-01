# City Sound Data Visualisation

A small Express + p5.js project that captures audio features from either a live camera/microphone setup or a local video file, stores those features in `data/session.json`, and visualizes the persisted data as a canvas-based graphic system.

## Team Roles

- Yerie - sound side: `input -> analysis -> data`
- Shuran - visual side: `data -> mapping -> render`

## Conceptual Explanation

Urban space is not only constructed visually, but sonically.
While cities are often documented through photography and mapping, their acoustic structure remains less visible.

This project translates urban sound into a modular graphic system.
Instead of representing sound as waveform or frequency bars, the system reconstructs it as spatial fragmentation, structural instability, and emotional chromatic activation.

Noise controls spatial resolution, mid-frequency energy destabilises the grid, and high-frequency intensity activates a conceptual pink layer — representing psychological tension embedded in contemporary urban environments.

Through this translation, the city is no longer seen as a physical landscape, but as a dynamic data-driven surface.


## What It Does

- `Live` mode uses the device camera for the image layer and the microphone for audio feature detection.
- `File` mode uses `City_Sound/subway.mp4` for both the image layer and the audio feature source.
- Detected audio features are written to `data/session.json` through the backend.
- The frontend reads the saved JSON back and uses those persisted values to drive the visual output.

The current detected values and the current rendered values are intentionally separated:

- detection path: `sound.js -> capture.js -> /api/append -> data/session.json`
- visualization path: `data/session.json -> /api/data -> dataBridge.js -> sketch.js -> visual.js`

## Comparison chart of fixed parameters
<img width="2198" height="837" alt="73a21b8699d63b9fc023a2b6ceadc3f5" src="https://github.com/user-attachments/assets/fef4f6be-6094-43f9-b063-123489a1c82f" />

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
