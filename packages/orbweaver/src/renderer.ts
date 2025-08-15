export type RendererOptions = {
  cols?: number;
  rows?: number;
  foreground?: string;
  background?: string;
};

export interface Renderer {
  getPixelSize(): { width: number; height: number };
  getGridSize(): { cols: number; rows: number };
  render(intensityAt: (col: number, row: number) => number): void;
  onResize(callback: () => void): () => void;
  destroy(): void;
}

export type CanvasAsciiRendererOptions = RendererOptions & {
  /**
   * The glyphs to use for rendering.
   * The first glyph is used as the background cell.
   * The last glyph is used as the most intense foreground cell (center of the orb).
   */
  glyphs?: string[];
};

const DEFAULT_GLYPHS = [" ", ".", ":", "-", "=", "+", "*", "#", "%", "@"];

export class CanvasAsciiRenderer implements Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private cols: number;
  private rows: number;
  private foreground: string;
  private background: string;
  private glyphs: string[];
  private resizeListeners: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement, options?: CanvasAsciiRendererOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context not available");
    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;
    this.cols = options?.cols ?? 80;
    this.rows = options?.rows ?? 30;
    this.foreground = options?.foreground ?? "#1a1a1a";
    this.background = options?.background ?? "#ffffff";
    this.glyphs = options?.glyphs ?? DEFAULT_GLYPHS;

    this.configureCanvas();
  }

  getCanvas() {
    return this.canvas;
  }

  setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context not available");
    this.ctx = ctx;
    this.configureCanvas();
  }

  private configureCanvas() {
    const { canvas } = this;
    const rect = canvas.getBoundingClientRect();
    // Fallback if not styled yet
    const cssWidth = rect.width || 800;
    const cssHeight = rect.height || 450;

    canvas.width = Math.max(1, Math.floor(cssWidth * this.dpr));
    canvas.height = Math.max(1, Math.floor(cssHeight * this.dpr));

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);

    this.ctx.textBaseline = "top";
    this.ctx.font = `14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  }

  private resize() {
    this.configureCanvas();
    for (const listener of this.resizeListeners) listener();
  }

  clear() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect(0, 0, rect.width, rect.height);
  }

  private drawAsciiGrid(intensityAt: (col: number, row: number) => number) {
    const rect = this.canvas.getBoundingClientRect();
    const cellWidth = rect.width / this.cols;
    const cellHeight = rect.height / this.rows;

    this.clear();

    this.ctx.fillStyle = this.foreground;
    // Set font size to fit cell height slightly smaller to avoid clipping
    const fontSize = Math.floor(cellHeight * 0.9);
    this.ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const intensity = Math.min(1, Math.max(0, intensityAt(c, r)));
        const glyphIndex = Math.min(
          this.glyphs.length - 1,
          Math.max(0, Math.floor(intensity * (this.glyphs.length - 1)))
        );
        const ch: string = this.glyphs[glyphIndex]!;
        const x = c * cellWidth;
        const y = r * cellHeight;
        this.ctx.fillText(ch, x, y);
      }
    }
  }

  /**
   * Convert client coordinates from a mouse event (or similar) to canvas-local pixel and cell coordinates.
   * Returns the zero-based integer cell indices along with the local pixel position.
   */
  clientToCell(
    clientX: number,
    clientY: number
  ): {
    /**
     * The zero-based integer column index.
     */
    col: number;
    /**
     * The zero-based integer row index.
     */
    row: number;
    /**
     * The local pixel x-coordinate.
     */
    x: number;
    /**
     * The local pixel y-coordinate.
     */
    y: number;
    /**
     * The distance to the center of the canvas, from the client coordinates in pixels.
     */
    distanceToCenter: number;
    /**
     * The scale factor from normalized units to pixels.
     */
    unitScalePx: number;
    /**
     * The normalized x-offset from the center of the canvas.
     */
    normalizedOffsetX: number;
    /**
     * The normalized y-offset from the center of the canvas.
     */
    normalizedOffsetY: number;
    /**
     * The normalized distance to the center of the canvas.
     */
    normalizedDistance: number;
  } {
    const rect = this.canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const cellWidth = rect.width / this.cols;
    const cellHeight = rect.height / this.rows;
    let col = Math.floor(localX / cellWidth);
    let row = Math.floor(localY / cellHeight);
    // Clamp to grid bounds
    col = Math.max(0, Math.min(this.cols - 1, col));
    row = Math.max(0, Math.min(this.rows - 1, row));
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const distanceToCenter = Math.hypot(localX - cx, localY - cy);
    const unitScalePx = Math.max(1e-6, Math.min(rect.width, rect.height) / 2);
    const normalizedOffsetX = (localX - cx) / unitScalePx; // right positive
    const normalizedOffsetY = (localY - cy) / unitScalePx; // down positive
    const normalizedDistance = Math.min(
      1,
      Math.hypot(normalizedOffsetX, normalizedOffsetY)
    );
    return {
      col,
      row,
      x: localX,
      y: localY,
      distanceToCenter,
      unitScalePx,
      normalizedOffsetX,
      normalizedOffsetY,
      normalizedDistance,
    };
  }

  // Renderer interface
  getPixelSize(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn("Canvas is not visible:", rect);
    }
    return { width: rect.width, height: rect.height };
  }

  getGridSize(): { cols: number; rows: number } {
    return { cols: this.cols, rows: this.rows };
  }

  render(intensityAt: (col: number, row: number) => number): void {
    this.drawAsciiGrid(intensityAt);
  }

  onResize(callback: () => void): () => void {
    if (this.resizeListeners.length === 0) {
      // Lazily attach a single window listener
      window.addEventListener("resize", () => this.resize());
    }
    this.resizeListeners.push(callback);
    return () => {
      this.resizeListeners = this.resizeListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  setForeground(foreground: string) {
    this.foreground = foreground;
  }

  setBackground(background: string) {
    this.background = background;
  }

  destroy() {
    this.resizeListeners.forEach((listener) => {
      window.removeEventListener("resize", listener);
    });
    this.resizeListeners = [];
  }
}
