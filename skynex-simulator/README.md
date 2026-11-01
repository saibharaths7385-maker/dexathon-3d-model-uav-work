# SKYNEX UAV Environmental Simulation

Open `index.html` (works offline; libraries in `vendor/`).

**Flight View Size 50% / 75% / 100%** (lobby header and dashboard header):
- 50% / 75%: the flight view is that share of the screen height; scroll the centre column for the charts below.
- 100%: the flight view fills the whole screen under the header. The ⛶ button also goes browser full screen.

Pick a UAV and scenario in the lobby, press Start (or a card's Open button). Data is the built-in demo mission (labelled DEMO SIMULATION).

## Running

- Quick look: open `index.html` directly (works offline; libraries are in `vendor/`).
- Recommended for the demo: serve the folder so `.glb` models and real-data loaders work —
  `cd skynex-simulator && python -m http.server 8000`, then open http://localhost:8000

The app is the demo path; live telemetry comes from the ⚙ panel (Laptop 1 over WebSocket, or manual sliders).

## Single-file build

`python build.py` inlines the CSS, `js/app.js` and the three vendor libraries into one
self-contained `../skynex-simulator-flightview.html` (~1 MB) that runs from `file://` with no
server and no internet. Rebuild it after editing the project files — never hand-edit the
single-file HTML.

## Models

Drop `eagle-eye-mini.glb` / `rq-11b-raven.glb` into `models/` and list them in
`models/index.json`, e.g. `{"EAGLE": "eagle-eye-mini.glb", "RAVEN": "rq-11b-raven.glb"}`.
Nothing is probed that is not listed, so a missing model never spams the console with 404s.

## Files

index.html, css/app.css, js/app.js, build.py, vendor/ (three.js r128 MIT, GLTFLoader, geotiff 2.1.3), models/.
