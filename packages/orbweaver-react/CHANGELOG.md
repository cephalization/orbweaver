# orbweaver-react

## 0.2.0

### Minor Changes

- f067135: Harmonics-based blob refactor, cursor-driven deformation, React bindings, and demo updates

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

### Patch Changes

- Updated dependencies [f067135]
  - orbweaver-core@0.4.0

## 0.1.0

### Minor Changes

- 640f176: Create orbweaver-react package, add affordances to orbweaver-core in support

### Patch Changes

- Updated dependencies [640f176]
  - orbweaver-core@0.3.0
