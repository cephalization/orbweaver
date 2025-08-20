import {
  BlobModel,
} from "./blob.js";
import { HARMONIC_PRESETS } from "./harmonics.js";
import type {
  Harmonic,
  HarmonicPreset,
  HarmonicPresetName,
  HarmonicGenParams,
  FrequencySpacing,
  HarmonicInput,
} from "./harmonics.js"
import {
  type Renderer,
  CanvasAsciiRenderer,
  type CanvasAsciiRendererOptions,
  type RendererOptions,
} from "./renderer.js";
import {
  Behavior,
  BobBehavior,
  RotateBehavior,
  Channels,
  OrbitBehavior,
  type RotateParams,
  type BobParams,
  type OrbitParams,
} from "./behavior.js";

export type OrbweaverOptions = {
  behavior?: Behavior[] | undefined;
  renderer?: Renderer | undefined;
  fps?: number | undefined; // Target frames per second (default: unlimited)
};

export type Vector2 = { x: number; y: number };

const DEFAULT_RENDERER_OPTIONS: RendererOptions = {
  cols: 80,
  rows: 30,
  foreground: "#1a1a1a",
  background: "#ffffff",
};

export class Orbweaver {
  private renderer: Renderer | null = null;
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
  private targetFPS: number | null = null; // null means unlimited
  private frameIntervalMs: number | null = null; // null means unlimited
  private lastFrameTimeMs: number = 0; // For frame timing
  private crosshairRow: number | null = null;
  private crosshairCol: number | null = null;
  private debugCrosshair: boolean = false;

  // Cached per-frame state used by per-cell sampling in intensityAt
  private frameState: {
    rotationPhase: number;
    xOffsetUnits: number;
    yOffsetUnits: number;
    cursorTheta: number | null;
    cursorDistanceUnits: number | null;
  } = {
      rotationPhase: 0,
      xOffsetUnits: 0,
      yOffsetUnits: 0,
      cursorTheta: null,
      cursorDistanceUnits: null,
    };

  // Impulse integration state (normalized units)
  private impulseOffsetUnits: Vector2 = { x: 0, y: 0 };
  private impulseVelocityUnitsPerSecond: Vector2 = { x: 0, y: 0 };
  // Spring-damper parameters (mass=1), tuned for a fast, smooth settle
  private readonly impulseStiffness: number = 20; // k
  private readonly impulseDamping: number = 9; // c ≈ 2*sqrt(k)

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
    } else if (optionsOrCanvas.renderer) {
      this.renderer = optionsOrCanvas.renderer;
      options = optionsOrCanvas;
    } else {
      options = optionsOrCanvas;
    }
    this.blob = new BlobModel(0.55);

    // Set target FPS if provided
    if (options.fps !== undefined) {
      this.setTargetFPS(options.fps);
    }

    // Parse behaviors. Default to a single rotate behavior if none provided
    const providedBehaviors: Behavior[] = options?.behavior ?? [
      new RotateBehavior({ speed: 1, direction: 1 }),
    ];
    this.setBehavior(providedBehaviors);
    // Setup renderer if provided
    this.cols = 0;
    this.rows = 0;
    if (this.renderer) {
      this.setupRenderer();
    }
  }

  private intensityAt(col: number, row: number): number {
    if (!this.renderer) {
      throw new Error("Renderer not set");
    }

    if (
      this.debugCrosshair &&
      this.crosshairRow !== null &&
      this.crosshairCol !== null
    ) {
      if (col === this.crosshairRow && row === this.crosshairCol) {
        return 1;
      }
    }

    // Map grid to normalized device coordinates [-1, 1]
    const { width, height } = this.renderer.getPixelSize();
    const cellWidth = width / this.cols;
    const cellHeight = height / this.rows;
    const x = col * cellWidth + cellWidth * 0.5;
    const y = row * cellHeight + cellHeight * 0.5;

    const nx = (x - this.centerX) / this.unitScale;
    // Use cached per-frame contributions
    const { rotationPhase, xOffsetUnits, yOffsetUnits, cursorTheta } =
      this.frameState;

    const ny =
      (y - (this.centerY + yOffsetUnits * this.unitScale)) / this.unitScale;
    const nxShifted = nx - xOffsetUnits;

    const r = Math.hypot(nxShifted, ny) + 1e-6;
    const theta = Math.atan2(ny, nxShifted);
    // Use aggregated rotation phase from behaviors
    const baseRadius = this.blob.radiusAt(theta, rotationPhase);

    // If we have a cursor angle, reduce the radius in that angular direction
    // using a simple cosine falloff centered at the cursor angle
    let radius = baseRadius;
    if (cursorTheta !== null) {
      const angleDiff = theta - cursorTheta;
      const angularFalloff = Math.max(0, Math.cos(angleDiff)); // [0,1]
      // Distance falloff: closer cursor -> stronger effect. Clamp to [0,1].
      // Map distance [0, 1+] to influence [1, 0] with a soft curve.
      const d = Math.min(
        1,
        Math.max(0, this.frameState.cursorDistanceUnits ?? 1)
      );
      const distanceInfluence = 1 - d; // 1 at center, 0 at or beyond radius 1
      const strength = 0.9; // base compression strength
      const combined = angularFalloff * distanceInfluence;
      radius = baseRadius * (1 - strength * combined);
    }

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

  /**
   * Replace the blob's harmonics. Accepts either an explicit array of harmonics
   * or generation parameters.
   */
  setBlobHarmonics(input: HarmonicInput): void {
    this.blob.setHarmonics(input);
  }

  /**
   * Replace the blob's harmonics using generation parameters.
   */
  setBlobHarmonicParams(params: HarmonicGenParams): void {
    this.blob.setHarmonicParams(params);
  }

  /**
   * Advance per-frame state: behaviors, impulse integration, and accumulator.
   */
  private advanceBehaviors(dtSeconds: number): void {
    // Advance behaviors
    for (const behavior of this.behaviors) {
      behavior.update(Math.max(0, dtSeconds));
    }

    // Integrate impulse spring-damper toward origin in normalized units
    if (dtSeconds > 0) {
      const k = this.impulseStiffness;
      const c = this.impulseDamping;

      // X axis
      const ax =
        -k * this.impulseOffsetUnits.x -
        c * this.impulseVelocityUnitsPerSecond.x;
      this.impulseVelocityUnitsPerSecond.x += ax * dtSeconds;
      this.impulseOffsetUnits.x +=
        this.impulseVelocityUnitsPerSecond.x * dtSeconds;

      // Y axis
      const ay =
        -k * this.impulseOffsetUnits.y -
        c * this.impulseVelocityUnitsPerSecond.y;
      this.impulseVelocityUnitsPerSecond.y += ay * dtSeconds;
      this.impulseOffsetUnits.y +=
        this.impulseVelocityUnitsPerSecond.y * dtSeconds;

      // Snap to zero when sufficiently small to avoid float drift
      const eps = 1e-4;
      if (
        Math.abs(this.impulseOffsetUnits.x) < eps &&
        Math.abs(this.impulseVelocityUnitsPerSecond.x) < eps
      ) {
        this.impulseOffsetUnits.x = 0;
        this.impulseVelocityUnitsPerSecond.x = 0;
      }
      if (
        Math.abs(this.impulseOffsetUnits.y) < eps &&
        Math.abs(this.impulseVelocityUnitsPerSecond.y) < eps
      ) {
        this.impulseOffsetUnits.y = 0;
        this.impulseVelocityUnitsPerSecond.y = 0;
      }
    }

    // Accumulate contributions for this frame
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

    // Apply impulse offsets in concert with behaviors (normalized units)
    xOffsetUnits += this.impulseOffsetUnits.x;
    yOffsetUnits += this.impulseOffsetUnits.y;

    // Compute cursor angle and distance relative to the blob center in normalized space, if available
    let cursorTheta: number | null = null;
    let cursorDistanceUnits: number | null = null;
    if (
      this.renderer &&
      this.crosshairRow !== null &&
      this.crosshairCol !== null &&
      this.cols > 0 &&
      this.rows > 0
    ) {
      const { width, height } = this.renderer.getPixelSize();
      const cellWidth = width / this.cols;
      const cellHeight = height / this.rows;
      const cursorPxX = this.crosshairRow * cellWidth + cellWidth * 0.5;
      const cursorPxY = this.crosshairCol * cellHeight + cellHeight * 0.5;

      const nx = (cursorPxX - this.centerX) / this.unitScale;
      const ny =
        (cursorPxY - (this.centerY + yOffsetUnits * this.unitScale)) /
        this.unitScale;
      const nxShifted = nx - xOffsetUnits;

      cursorTheta = Math.atan2(ny, nxShifted);
      cursorDistanceUnits = Math.hypot(nxShifted, ny);
    }

    this.frameState = {
      rotationPhase,
      xOffsetUnits,
      yOffsetUnits,
      cursorTheta,
      cursorDistanceUnits,
    };
  }

  updateCursor(x: number | null, y: number | null) {
    this.crosshairRow = x;
    this.crosshairCol = y;
  }

  /**
   * Get the current behaviors for the orbweaver.
   * @returns The behaviors.
   */
  getBehaviors() {
    return this.behaviors;
  }

  /**
   * Add a behavior to the orbweaver.
   * There can be multiple behaviors, but only one of each type.
   * @param behavior - The behavior to add.
   */
  addBehavior(behavior: Behavior) {
    this.behaviors = this.behaviors
      .filter((b) => b.type !== behavior.type)
      .concat(behavior);
  }

  /**
   * Set the behaviors for the orbweaver.
   * @param behavior - The behaviors to set.
   */
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

  /**
   * Set the target frames per second for the animation loop.
   * @param fps - Target frames per second. Pass null or 0 for unlimited (default behavior).
   */
  setTargetFPS(fps: number | null): void {
    this.targetFPS = fps;
    if (fps && fps > 0) {
      this.frameIntervalMs = 1000 / fps;
    } else {
      this.frameIntervalMs = null;
    }
  }

  /**
   * Get the current target FPS setting.
   * @returns The target FPS, or null if unlimited.
   */
  getTargetFPS(): number | null {
    return this.targetFPS;
  }

  /**
   * Set the renderer for the orbweaver.
   * Recalculates the grid size and center point.
   * @param renderer - The renderer to use.
   */
  setRenderer(renderer: Renderer) {
    this.renderer = renderer;
    this.setupRenderer();
  }

  /**
   * Get the current renderer for the orbweaver.
   * @returns The renderer.
   */
  getRenderer() {
    return this.renderer;
  }

  /**
   * Set the debug crosshair to be shown.
   * @param show - Whether to show the crosshair.
   */
  setDebugCrosshair(show: boolean) {
    this.debugCrosshair = show;
  }

  /**
   * Get the current debug crosshair setting.
   * @returns Whether the crosshair is shown.
   */
  getDebugCrosshair() {
    return this.debugCrosshair;
  }

  /**
   * Start the orbweaver animation loop.
   *
   * Requires a renderer to be set.
   */
  start() {
    if (!this.renderer) {
      throw new Error("Renderer not set");
    }
    if (this.animationHandle !== null) return;
    this.startTimeMs = performance.now();
    this.lastFrameTimeMs = this.startTimeMs;

    const loop = () => {
      if (!this.renderer) {
        throw new Error("Renderer not set");
      }
      const now = performance.now();
      const deltaTimeMs = now - this.startTimeMs;

      // Frame rate limiting logic
      if (this.frameIntervalMs !== null) {
        const timeSinceLastFrame = now - this.lastFrameTimeMs;
        if (timeSinceLastFrame < this.frameIntervalMs) {
          // Schedule next frame with precise timing
          const delay = this.frameIntervalMs - timeSinceLastFrame;
          this.animationHandle = setTimeout(loop, delay);
          return;
        }
        this.lastFrameTimeMs = now;
      }

      // Advance per-frame state once per rendered frame
      const frameDeltaMs = deltaTimeMs - this.lastIntegratedDeltaTimeMs;
      this.lastIntegratedDeltaTimeMs = deltaTimeMs;
      const dtSeconds = Math.max(0, frameDeltaMs / 1000);
      this.advanceBehaviors(dtSeconds);

      this.renderer.render((c, r) => this.intensityAt(c, r));

      if (this.frameIntervalMs === null) {
        // Unlimited FPS - use requestAnimationFrame
        this.animationHandle = requestAnimationFrame(loop);
      } else {
        // Limited FPS - schedule next frame
        this.animationHandle = setTimeout(loop, this.frameIntervalMs);
      }
    };

    if (this.frameIntervalMs === null) {
      this.animationHandle = requestAnimationFrame(loop);
    } else {
      this.animationHandle = setTimeout(loop, this.frameIntervalMs);
    }
  }

  /**
   * Stop the orbweaver animation loop.
   */
  stop() {
    if (this.animationHandle !== null) {
      if (this.frameIntervalMs === null) {
        cancelAnimationFrame(this.animationHandle);
      } else {
        clearTimeout(this.animationHandle);
      }
      this.animationHandle = null;
    }
    if (this.unsubscribeResize) {
      this.unsubscribeResize();
      this.unsubscribeResize = null;
    }
  }

  /**
   * Apply an instantaneous impulse to the orb's center in normalized units.
   * The impulse acts like an added velocity that decays via a critically-damped
   * spring toward the origin over subsequent frames.
   *
   * @param force Units-per-second kick to apply. Larger magnitudes persist longer.
   */
  impulse(force: Vector2): void {
    this.impulseVelocityUnitsPerSecond.x += force.x;
    this.impulseVelocityUnitsPerSecond.y += force.y;
  }

  /**
   * Setup the renderer for the orbweaver.
   * Recalculates the grid size and center point.
   */
  private setupRenderer() {
    if (!this.renderer) {
      throw new Error("Renderer not set");
    }
    const { width, height } = this.renderer.getPixelSize();
    this.centerX = width / 2;
    this.centerY = height / 2;
    this.unitScale = Math.min(width, height) / 2;

    const grid = this.renderer.getGridSize();
    this.cols = grid.cols;
    this.rows = grid.rows;

    this.unsubscribeResize = this.renderer.onResize(() => {
      if (!this.renderer) return;
      const size = this.renderer.getPixelSize();
      this.centerX = size.width / 2;
      this.centerY = size.height / 2;
      this.unitScale = Math.min(size.width, size.height) / 2;
      const newGrid = this.renderer.getGridSize();
      this.cols = newGrid.cols;
      this.rows = newGrid.rows;
    });
  }
}

export type {
  Harmonic,
  HarmonicPreset,
  HarmonicPresetName,
  HarmonicGenParams,
  FrequencySpacing,
  HarmonicInput,
  Renderer,
  RendererOptions,
  CanvasAsciiRendererOptions,
  RotateParams,
  BobParams,
  OrbitParams,
};
export {
  HARMONIC_PRESETS,
  Behavior,
  BlobModel,
  BobBehavior,
  RotateBehavior,
  OrbitBehavior,
  Channels,
  CanvasAsciiRenderer,
};

export default Orbweaver;
