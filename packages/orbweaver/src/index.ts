import { BlobModel } from "./blob.js";
import {
  type Renderer,
  CanvasAsciiRenderer,
  type RendererOptions,
} from "./renderer.js";
import {
  Behavior,
  BobBehavior,
  RotateBehavior,
  Channels,
  OrbitBehavior,
} from "./behavior.js";

export type OrbweaverOptions = {
  behavior?: Behavior[];
  renderer: Renderer;
};

const DEFAULT_RENDERER_OPTIONS: RendererOptions = {
  cols: 80,
  rows: 30,
  foreground: "#1a1a1a",
  background: "#ffffff",
};

export class Orbweaver {
  private renderer: Renderer;
  private blob: BlobModel;
  private animationHandle: number | null = null;
  private startTimeMs: number = 0;
  private lastIntegratedDeltaTimeMs: number = 0;
  private centerX: number = 0;
  private centerY: number = 0;
  private unitScale: number = 1; // pixels per normalized unit for mapping [-1,1]
  private cols: number;
  private rows: number;
  private unsubscribeResize: (() => void) | null = null;
  private behaviors: Behavior[] = [];

  constructor(optionsOrCanvas: OrbweaverOptions | HTMLCanvasElement) {
    let options: OrbweaverOptions;
    if (optionsOrCanvas instanceof HTMLCanvasElement) {
      this.renderer = new CanvasAsciiRenderer(
        optionsOrCanvas,
        DEFAULT_RENDERER_OPTIONS
      );
      options = {
        renderer: this.renderer,
        ...DEFAULT_RENDERER_OPTIONS,
      };
    } else {
      this.renderer = optionsOrCanvas.renderer;
      options = optionsOrCanvas;
    }
    this.blob = new BlobModel(0.55);

    // Parse behaviors. Default to a single rotate behavior if none provided
    const providedBehaviors: Behavior[] = options?.behavior ?? [
      new RotateBehavior({ speed: 1, direction: 1 }),
    ];
    this.setBehavior(providedBehaviors);

    const { width, height } = this.renderer.getPixelSize();
    this.centerX = width / 2;
    this.centerY = height / 2;
    this.unitScale = Math.min(width, height) / 2;

    const grid = this.renderer.getGridSize();
    this.cols = grid.cols;
    this.rows = grid.rows;

    this.unsubscribeResize = this.renderer.onResize(() => {
      const size = this.renderer.getPixelSize();
      this.centerX = size.width / 2;
      this.centerY = size.height / 2;
      this.unitScale = Math.min(size.width, size.height) / 2;
      const newGrid = this.renderer.getGridSize();
      this.cols = newGrid.cols;
      this.rows = newGrid.rows;
    });
  }

  private intensityAt(col: number, row: number, deltaTimeMs: number): number {
    // Advance behaviors once per frame
    if (deltaTimeMs !== this.lastIntegratedDeltaTimeMs) {
      const frameDeltaMs = deltaTimeMs - this.lastIntegratedDeltaTimeMs;
      this.lastIntegratedDeltaTimeMs = deltaTimeMs;
      const dtSeconds = Math.max(0, frameDeltaMs / 1000);
      for (const behavior of this.behaviors) {
        behavior.update(dtSeconds);
      }
    }

    // Map grid to normalized device coordinates [-1, 1]
    const { width, height } = this.renderer.getPixelSize();
    const cellWidth = width / this.cols;
    const cellHeight = height / this.rows;
    const x = col * cellWidth + cellWidth * 0.5;
    const y = row * cellHeight + cellHeight * 0.5;

    const nx = (x - this.centerX) / this.unitScale;
    // Gather contributions from behaviors for this frame
    let rotationPhase = 0;
    let yOffsetUnits = 0;
    let xOffsetUnits = 0;
    for (const behavior of this.behaviors) {
      const acc: Record<string, number> = {};
      behavior.contribute(acc);
      rotationPhase += acc[Channels.rotationPhase] ?? 0;
      yOffsetUnits += acc[Channels.yOffsetUnits] ?? 0;
      xOffsetUnits += acc[Channels.xOffsetUnits] ?? 0;
    }

    const ny =
      (y - (this.centerY + yOffsetUnits * this.unitScale)) / this.unitScale;
    const nxShifted = nx - xOffsetUnits;

    const r = Math.hypot(nxShifted, ny) + 1e-6;
    const theta = Math.atan2(ny, nxShifted);
    // Use aggregated rotation phase from behaviors
    const radius = this.blob.radiusAt(theta, rotationPhase);

    // Interior intensity: higher near center, taper to boundary
    const interior = Math.max(0, 1 - r / (radius + 1e-6));

    // Add a subtle rim highlight around the boundary using a narrow band
    const band = 0.04;
    const signedDistance = r - radius; // negative inside
    const rim = Math.exp(
      -(signedDistance * signedDistance) / (2 * band * band)
    );

    // Combine interior and rim and clamp
    const intensity = Math.min(1, interior * 0.85 + rim * 0.35);
    return intensity;
  }

  getBehaviors() {
    return this.behaviors;
  }

  setBehavior(behavior: Behavior[]) {
    this.behaviors = behavior.map((b) => {
      return b;
    });
  }

  /**
   * Remove the given behaviors from the orbweaver.
   * @param behavior - The behaviors to remove.
   */
  removeBehavior(behavior: Behavior[]) {
    this.behaviors = this.behaviors.filter(
      (b) => !behavior.some((b2) => b2.type === b.type)
    );
  }

  start() {
    if (this.animationHandle !== null) return;
    this.startTimeMs = performance.now();
    const loop = () => {
      const now = performance.now();
      const deltaTimeMs = now - this.startTimeMs;

      this.renderer.render((c, r) => this.intensityAt(c, r, deltaTimeMs));
      this.animationHandle = requestAnimationFrame(loop);
    };
    this.animationHandle = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animationHandle !== null) {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
    if (this.unsubscribeResize) {
      this.unsubscribeResize();
      this.unsubscribeResize = null;
    }
  }
}

export { BlobModel, type Renderer, CanvasAsciiRenderer, type RendererOptions };
export { Behavior, BobBehavior, RotateBehavior, OrbitBehavior, Channels };

export default Orbweaver;
