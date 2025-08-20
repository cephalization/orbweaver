---
"orbweaver-react": minor
"orbweaver-core": minor
"web": minor
---

Harmonics-based blob refactor, cursor-driven deformation, React bindings, and demo updates

Highlights

- orbweaver-core
  - Refactor `BlobModel` to use a harmonics model for shape generation.
    - New `harmonics.ts` with `HARMONIC_PRESETS`, `generateHarmonics`, and typed helpers.
    - New APIs on `Orbweaver`: `setBlobHarmonics(input)` and `setBlobHarmonicParams(params)`.
  - Behavior system enhancements and new cursor deformation:
    - Add `CrosshairBehavior` (gates/scales cursor-driven deformation).
    - Export surface cleaned up and types re‑exported (behaviors, harmonics, renderer types, presets).

- orbweaver-react
  - New declarative React bindings:
    - Behavior component: `CrosshairBehavior`.
- web
  - Demo updated with live controls (harmonics, FPS, behaviors, colors, renderer settings).
  - Click impulse interaction and cursor-follow deformation (via `clientToCell` + `updateCrosshair`).
  - Updated declarative example using `orbweaver-react`.

Notes

- To enable cursor deformation, include `CrosshairBehavior` and call `updateCrosshair(col, row)` on pointer move. Use `CanvasAsciiRenderer.clientToCell` to compute grid coordinates from events.
