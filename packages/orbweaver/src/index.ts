import { BlobModel } from "./blob.js";
import {
  type Renderer,
  CanvasAsciiRenderer,
  type RendererOptions,
} from "./renderer.js";
import { type Behavior } from "./behavior.js";

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
  private centerX: number = 0;
  private centerY: number = 0;
  private unitScale: number = 1; // pixels per normalized unit for mapping [-1,1]
  private cols: number;
  private rows: number;
  private unsubscribeResize: (() => void) | null = null;
  private bobAmplitudeUnits: number = 0; // normalized units amplitude
  private rotateTimeScale: number = 0; // multiplier for time (can be negative)
  private bobRate: number = 2.0; // multiplier for time (can be negative)

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
    let bobAmplitudeUnits = 0;
    let rotateTimeScale = 0;
    for (const b of providedBehaviors) {
      if (typeof b === "string") {
        if (b === "bob") {
          bobAmplitudeUnits += 0.05; // default amplitude
        } else if (b === "rotate") {
          rotateTimeScale += 1; // default speed and direction
        }
        continue;
      }
      if (b?.type === "bob") {
        const amp = typeof b.amplitude === "number" ? b.amplitude : 0;
        bobAmplitudeUnits += Math.max(0, amp);
        this.bobRate = typeof b.rate === "number" ? b.rate : 2.0;
      } else if (b?.type === "rotate") {
        const speed = typeof b.speed === "number" ? b.speed : 1;
        const direction = typeof b.direction === "number" ? b.direction : 1;
        rotateTimeScale += speed * direction;
      }
    }
    this.bobAmplitudeUnits = bobAmplitudeUnits;
    this.rotateTimeScale = rotateTimeScale;

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

  private intensityAt(col: number, row: number, timeSeconds: number): number {
    // Map grid to normalized device coordinates [-1, 1]
    const { width, height } = this.renderer.getPixelSize();
    const cellWidth = width / this.cols;
    const cellHeight = height / this.rows;
    const x = col * cellWidth + cellWidth * 0.5;
    const y = row * cellHeight + cellHeight * 0.5;

    // Compute optional vertical bobbing in normalized units
    const bobOffsetUnits = this.bobAmplitudeUnits
      ? Math.sin(timeSeconds * this.bobRate) * this.bobAmplitudeUnits
      : 0;

    const nx = (x - this.centerX) / this.unitScale;
    const ny =
      (y - (this.centerY + bobOffsetUnits * this.unitScale)) / this.unitScale;

    const r = Math.hypot(nx, ny) + 1e-6;
    const theta = Math.atan2(ny, nx);
    // Optional rotation is controlled by scaling time (can be 0 or negative)
    const effectiveTime = this.rotateTimeScale
      ? timeSeconds * this.rotateTimeScale
      : 0;
    const radius = this.blob.radiusAt(theta, effectiveTime);

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

  start() {
    if (this.animationHandle !== null) return;
    this.startTimeMs = performance.now();
    const loop = () => {
      const now = performance.now();
      const t = (now - this.startTimeMs) / 1000;
      this.renderer.render((c, r) => this.intensityAt(c, r, t));
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
