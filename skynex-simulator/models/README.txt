Optional aircraft models.

Put a .glb here (forward = -Z, propeller node named "prop"), then list it in
index.json next to this file, e.g.:

  {"EAGLE": "eagle-eye-mini.glb", "RAVEN": "rq-11b-raven.glb"}

Only files listed there are loaded, so nothing 404s when they are absent.
Models load when the app is served over http; over file:// drag a .glb onto the
page instead (or use the single-file build, which bakes index.json in).
