# orbweaver-core

## 0.4.0

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

## 0.3.0

### Minor Changes

- 640f176: Create orbweaver-react package, add affordances to orbweaver-core in support

## 0.2.4

### Patch Changes

- 6504c52: Add configurable FPS property to Orbweaver instance

## 0.2.3

### Patch Changes

- 9eb1677: Customizable glyphs in the CanvasAsciiRenderer

## 0.2.2

### Patch Changes

- 3600b1d: Add impulse method to orbweaver instances

## 0.2.1

### Patch Changes

- 6b25b13: Customizable CanvasAsciiRenderer colors

## 0.2.0

### Minor Changes

- 166bfb6: Improved extensibility of Behaviors and custom Behaviors

### Patch Changes

- 71cfa58: Handlers to dynamically update behaviors

## 0.1.0

### Minor Changes

- b708cb8: refactor: Improve behavior abstraction boundary

## 0.0.3

### Patch Changes

- b6bcfad: Add customizable behaviors
- 31d25be: feat: Customizable renderers

## 0.0.2

### Patch Changes

- b790723: chore: Include README in package
