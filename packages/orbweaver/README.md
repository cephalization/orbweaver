# Orbweaver

![orbweaver-demo](https://raw.githubusercontent.com/cephalization/orbweaver/refs/heads/main/assets/demo.gif)

A library for rendering pleasing blob-like orbs as ascii or shaded hues.

It supports:

- Bring your own rendering backend (canvas, terminal ascii, etc)
- Customizable colors
- Responsive interaction (mouse, keyboard, audio, etc)
- Configurable framerate for performance control

## Usage

```bash
# install the orbweaver package
pnpm add orbweaver-core
```

Render a blob in an HTML canvas (auto-initialized canvas ASCII renderer):

```tsx
// index.ts
import { Orbweaver } from "orbweaver-core";

const orbweaver = new Orbweaver(
  document.getElementById("canvas") as HTMLCanvasElement
);

orbweaver.start();
```

```html
<!-- index.html -->
<canvas id="canvas" style="width: 100%; height: 100%; border-radius: 8px; border: 1px solid #1E3A2F; background: #081B12;"></canvas>
```

Bring your own renderer (advanced):

```ts
// index.ts
import {
  Orbweaver,
  CanvasAsciiRenderer,
  BobBehavior,
  RotateBehavior,
  OrbitBehavior,
  type Renderer,
} from "orbweaver-core";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// You can either use the provided CanvasAsciiRenderer explicitly...
const renderer = new CanvasAsciiRenderer(canvas, {
  cols: 100,
  rows: 36,
  foreground: "#A8FFB5",
  background: "#081B12",
});

// ...or supply any custom implementation of the Renderer interface
// interface Renderer {
//   getPixelSize(): { width: number; height: number };
//   getGridSize(): { cols: number; rows: number };
//   render(intensityAt: (col: number, row: number) => number): void;
//   onResize(callback: () => void): () => void;
// }

// Create behaviors
const bob = new BobBehavior({ amplitude: 0.05, rate: 2.5 });
const rotate = new RotateBehavior({ speed: 2.5, direction: -1 });
const orbit = new OrbitBehavior({ radiusUnits: 0.15, angularSpeed: 1 });

// Initialize the orbweaver with the renderer and desired behaviors
const orbweaver = new Orbweaver({
  renderer,
  behavior: [bob, rotate, orbit],
  fps: 30, // Optional: limit to 30 FPS for performance
});

orbweaver.start();

// Update behavior parameters later
rotate.set({ speed: 2.0 });
bob.set({ amplitude: 0.4 });

// Dynamically adjust framerate
orbweaver.setTargetFPS(60); // Set to 60 FPS
orbweaver.setTargetFPS(null); // Unlimited FPS (default)

// Apply a transient impulse (normalized units-per-second, towards the center of the renderer)
orbweaver.impulse({ x: 1.2, y: 0 });
```

## Development

Install dependencies:

```bash
# ensure node v23 is installed, and pnpm v10.14
pnpm install
```

Start the development react app from the root of the monorepo:

```bash
pnpm dev
```