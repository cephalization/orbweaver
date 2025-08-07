import { BlobModel } from "./blob.js";
import {
  type Renderer,
  CanvasAsciiRenderer,
  type RendererOptions,
} from "./renderer.js";

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

  constructor(
    rendererOrCanvas: Renderer | HTMLCanvasElement,
    options?: RendererOptions
  ) {
    if (rendererOrCanvas instanceof HTMLCanvasElement) {
      this.renderer = new CanvasAsciiRenderer(rendererOrCanvas, options);
    } else {
      this.renderer = rendererOrCanvas;
    }
    this.blob = new BlobModel(0.55);

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

    const nx = (x - this.centerX) / this.unitScale;
    const ny = (y - this.centerY) / this.unitScale;

    const r = Math.hypot(nx, ny) + 1e-6;
    const theta = Math.atan2(ny, nx);
    const radius = this.blob.radiusAt(theta, timeSeconds);

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
