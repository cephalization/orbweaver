import { BlobModel } from "./blob.js";
import {
  type Renderer,
  CanvasAsciiRenderer,
  type RendererOptions,
} from "./renderer.js";
import { type Behavior, type BobBehavior } from "./behavior.js";

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

  // Integrated phases and smoothed params to avoid snapping on live edits
  private rotatePhase: number = 0;
  private bobPhase: number = 0;
  private currentBobAmplitude: number = 0;

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

    // Parse behaviors. Default to ["rotate"] if none provided
    const providedBehaviors: Behavior[] = options?.behavior ?? [
      { type: "rotate", speed: 1, direction: 1 },
    ];
    this.setBehavior(providedBehaviors);

    // Initialize smoothed state from provided behaviors
    const initialBob = this.behaviors.find(
      (b): b is BobBehavior => b.type === "bob"
    );
    this.currentBobAmplitude = initialBob?.amplitude ?? 0;

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
    // Update integrated phases and smoothed parameters once per frame
    if (deltaTimeMs !== this.lastIntegratedDeltaTimeMs) {
      const frameDeltaMs = deltaTimeMs - this.lastIntegratedDeltaTimeMs;
      this.lastIntegratedDeltaTimeMs = deltaTimeMs;
      const dtSeconds = Math.max(0, frameDeltaMs / 1000);

      const bobBehaviorInt = this.behaviors.find((b) => b.type === "bob");
      const rotateBehaviorInt = this.behaviors.find((b) => b.type === "rotate");

      // Integrate rotation phase
      const angularVelocity =
        (rotateBehaviorInt?.speed ?? 0) * (rotateBehaviorInt?.direction ?? 1);
      this.rotatePhase += angularVelocity * dtSeconds;

      // Integrate bob phase
      const bobRate = bobBehaviorInt?.rate ?? 2.0;
      this.bobPhase += bobRate * dtSeconds;

      // Smooth bob amplitude toward target
      const targetAmp = bobBehaviorInt?.amplitude ?? 0;
      const smoothing = 1 - Math.exp(-dtSeconds * 12);
      this.currentBobAmplitude +=
        (targetAmp - this.currentBobAmplitude) *
        Math.max(0, Math.min(1, smoothing));
    }

    // Map grid to normalized device coordinates [-1, 1]
    const { width, height } = this.renderer.getPixelSize();
    const cellWidth = width / this.cols;
    const cellHeight = height / this.rows;
    const x = col * cellWidth + cellWidth * 0.5;
    const y = row * cellHeight + cellHeight * 0.5;

    const bobBehavior = this.behaviors.find((b) => b.type === "bob");

    // Compute optional vertical bobbing in normalized units using integrated phase
    const bobOffsetUnits =
      bobBehavior && this.currentBobAmplitude > 0
        ? Math.sin(this.bobPhase) * this.currentBobAmplitude
        : 0;

    const nx = (x - this.centerX) / this.unitScale;
    const ny =
      (y - (this.centerY + bobOffsetUnits * this.unitScale)) / this.unitScale;

    const r = Math.hypot(nx, ny) + 1e-6;
    const theta = Math.atan2(ny, nx);
    // Use integrated rotation phase to avoid snapping on live edits
    const radius = this.blob.radiusAt(theta, this.rotatePhase);

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
    this.behaviors = behavior;
  }

  /**
   * Update the behaviors for the orbweaver.
   * @param behavior - The behaviors to set.
   * @todo refactor behaviors so that they contain their own state
   */
  updateBehavior(behavior: (Partial<Behavior> & { type: Behavior["type"] })[]) {
    for (const b of behavior) {
      if (b.type === "bob") {
        this.behaviors = this.behaviors.map((b2) => {
          if (b2.type === "bob") {
            return { ...b2, ...b };
          }
          return b2;
        });
      } else if (b.type === "rotate") {
        this.behaviors = this.behaviors.map((b2) => {
          if (b2.type === "rotate") {
            return { ...b2, ...b };
          }
          return b2;
        });
      }
    }
  }

  /**
   * Remove the given behaviors from the orbweaver.
   * @param behavior - The behaviors to remove.
   * @todo refactor behaviors so that they contain their own state
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

export default Orbweaver;
