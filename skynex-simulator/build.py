#!/usr/bin/env python3
"""Build the single-file, fully offline edition of SKYNEX.

Reads index.html + css/app.css + js/{core,app}.js + vendor/* and writes one
self-contained .html next to the project folder, so the demo can be handed over
as a single file that needs no server and no internet.

    python build.py            # writes ../skynex-simulator-flightview.html
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT.parent / "skynex-simulator-flightview.html"
SCRIPTS = [
    "vendor/three.min.js",
    "vendor/GLTFLoader.js",
    "vendor/geotiff.js",
    "js/core.js",
    "js/app.js",
]


def inline_script(path):
    text = path.read_text(encoding="utf-8")
    if "</script" in text.lower():
        raise SystemExit(f"{path} contains '</script' and cannot be inlined safely")
    return "<script>\n" + text + "\n</script>"


def model_manifest():
    path = ROOT / "models" / "index.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    return {k: v for k, v in data.items() if k in ("EAGLE", "RAVEN") and isinstance(v, str)}


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "css/app.css").read_text(encoding="utf-8")

    css_tag = '<link rel="stylesheet" href="css/app.css">'
    if css_tag not in html:
        raise SystemExit("index.html no longer references css/app.css")
    html = html.replace(css_tag, "<style>\n" + css + "\n</style>", 1)

    # a standalone file has no manifest/icons/service worker next to it
    manifest_tag = '<link rel="manifest" href="manifest.webmanifest">'
    html = html.replace(manifest_tag, "", 1)

    for src in SCRIPTS:
        tag = f'<script src="{src}"></script>'
        if tag not in html:
            raise SystemExit(f"index.html no longer references {src}")
        inline = inline_script(ROOT / src)
        if src == "js/app.js":
            # bake the model manifest and tell the app it is not a PWA install
            inline = (
                "<script>window.SKYNEX_MODELS = "
                + json.dumps(model_manifest(), sort_keys=True)
                + "; window.SKYNEX_STANDALONE = true;</script>\n"
                + inline
            )
        html = html.replace(tag, inline, 1)

    left = [m for m in ('src="vendor/', 'src="js/', 'href="css/', "manifest.webmanifest") if m in html]
    if left:
        raise SystemExit(f"build is not self-contained, still references: {left}")

    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB, offline single file)")


if __name__ == "__main__":
    main()
