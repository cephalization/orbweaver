import { BlobModel } from "./blob.js";
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

  private intensityAt(col: number, row: number, deltaTimeMs: number): number {
    if (!this.renderer) {
      throw new Error("Renderer not set");
    }
    // Advance behaviors once per frame
    if (deltaTimeMs !== this.lastIntegratedDeltaTimeMs) {
      const frameDeltaMs = deltaTimeMs - this.lastIntegratedDeltaTimeMs;
      this.lastIntegratedDeltaTimeMs = deltaTimeMs;
      const dtSeconds = Math.max(0, frameDeltaMs / 1000);
      for (const behavior of this.behaviors) {
        behavior.update(dtSeconds);
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

    // Apply impulse offsets in concert with behaviors (normalized units)
    xOffsetUnits += this.impulseOffsetUnits.x;
    yOffsetUnits += this.impulseOffsetUnits.y;

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
    this.behaviors = this.behaviors.filter(b => b.type !== behavior.type).concat(behavior);
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

      this.renderer.render((c, r) => this.intensityAt(c, r, deltaTimeMs));

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

export { BlobModel, type Renderer, CanvasAsciiRenderer, type RendererOptions, type CanvasAsciiRendererOptions };
export { Behavior, BobBehavior, RotateBehavior, OrbitBehavior, Channels, type RotateParams, type BobParams, type OrbitParams };

export default Orbweaver;
