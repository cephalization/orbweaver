# web

## 1.1.0

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
  - orbweaver-react@0.2.0
  - orbweaver-core@0.4.0

## 1.0.9

### Patch Changes

- Updated dependencies [640f176]
  - orbweaver-core@0.3.0
  - orbweaver-react@0.1.0

## 1.0.8

### Patch Changes

- Updated dependencies [6504c52]
  - orbweaver-core@0.2.4

## 1.0.7

### Patch Changes

- Updated dependencies [9eb1677]
  - orbweaver-core@0.2.3

## 1.0.6

### Patch Changes

- Updated dependencies [3600b1d]
  - orbweaver-core@0.2.2

## 1.0.5

### Patch Changes

- Updated dependencies [6b25b13]
  - orbweaver-core@0.2.1

## 1.0.4

### Patch Changes

- Updated dependencies [166bfb6]
- Updated dependencies [71cfa58]
  - orbweaver-core@0.2.0

## 1.0.3

### Patch Changes

- Updated dependencies [b708cb8]
  - orbweaver-core@0.1.0

## 1.0.2

### Patch Changes

- Updated dependencies [b6bcfad]
- Updated dependencies [31d25be]
  - orbweaver-core@0.0.3

## 1.0.1

### Patch Changes

- Updated dependencies [b790723]
  - orbweaver-core@0.0.2
