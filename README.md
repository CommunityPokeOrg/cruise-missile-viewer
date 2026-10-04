# cruise-missile-viewer

A small static web app that renders a single generic cruise-missile exterior,
procedurally modeled from scratch with three.js primitives and geometry —
no downloaded model assets.

- Lathe-based smooth fuselage profile with nose ogive and tail fairing
- Swept mid-body wings and X-arrangement tail fins (extruded planforms)
- Ventral intake scoop and exhaust detail
- Panel lines, PBR paint/metal materials, environment lighting, soft shadows
- Orbit / pan / zoom via mouse or touch (OrbitControls)

Exterior visualization only — no internals and no functional details.

## Run

It's a static page; serve the folder with any static server, e.g.:

```sh
python3 -m http.server 8000
```

then open `http://localhost:8000`. It is also deployed on GitHub Pages.
