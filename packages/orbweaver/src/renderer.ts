export type BobBehavior = {
  type: "bob";
  amplitude: number;
  rate?: number; // defaults to 2.0
};

export type RotateBehavior = {
  type: "rotate";
  speed: number;
  direction?: number; // positive or negative; defaults to 1
};

export type Behavior = BobBehavior | RotateBehavior;

export type RendererOptions = {
  cols?: number;
  rows?: number;
  foreground?: string;
  background?: string;
  behavior?: Behavior[];
};

export interface Renderer {
  getPixelSize(): { width: number; height: number };
  getGridSize(): { cols: number; rows: number };
  render(intensityAt: (col: number, row: number) => number): void;
  onResize(callback: () => void): () => void;
}

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

  constructor(canvas: HTMLCanvasElement, options?: RendererOptions) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context not available");
    this.canvas = canvas;
    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;
    this.cols = options?.cols ?? 80;
    this.rows = options?.rows ?? 30;
    this.foreground = options?.foreground ?? "#1a1a1a";
    this.background = options?.background ?? "#ffffff";
    this.glyphs = [" ", ".", ":", "-", "=", "+", "*", "#", "%", "@"];

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

  // Renderer interface
  getPixelSize(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect();
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
}
