export type OrbweaverOptions = {
  cols?: number;
  rows?: number;
  foreground?: string;
  background?: string;
};

export class BlobModel {
  baseRadius: number;
  amplitude: number;
  harmonics: Array<{ amplitude: number; frequency: number; phase: number }>;

  constructor(baseRadius = 0.5) {
    this.baseRadius = baseRadius;
    this.amplitude = 0.12;
    this.harmonics = [
      { amplitude: 1.0, frequency: 3, phase: 0 },
      { amplitude: 0.6, frequency: 5, phase: Math.PI / 3 },
      { amplitude: 0.4, frequency: 7, phase: Math.PI / 5 },
    ];
  }

  radiusAt(angle: number, timeSeconds: number): number {
    let radius = this.baseRadius;
    for (const h of this.harmonics) {
      radius +=
        this.amplitude *
        h.amplitude *
        Math.sin(h.frequency * angle + h.phase + timeSeconds * 0.9);
    }
    return radius;
  }
}

export class CanvasAsciiRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private cols: number;
  private rows: number;
  private foreground: string;
  private background: string;
  private glyphs: string[];

  constructor(canvas: HTMLCanvasElement, options?: OrbweaverOptions) {
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
    const { canvas, dpr } = this;
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

  resize() {
    this.configureCanvas();
  }

  clear() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect(0, 0, rect.width, rect.height);
  }

  drawAsciiGrid(intensityAt: (col: number, row: number) => number) {
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
}

export class Orbweaver {
  private renderer: CanvasAsciiRenderer;
  private blob: BlobModel;
  private animationHandle: number | null = null;
  private startTimeMs: number = 0;
  private centerX: number = 0;
  private centerY: number = 0;
  private unitScale: number = 1; // pixels per normalized unit for mapping [-1,1]
  private cols: number;
  private rows: number;

  constructor(canvas: HTMLCanvasElement, options?: OrbweaverOptions) {
    this.renderer = new CanvasAsciiRenderer(canvas, options);
    this.blob = new BlobModel(0.55);

    const rect = canvas.getBoundingClientRect();
    this.centerX = rect.width / 2;
    this.centerY = rect.height / 2;
    this.unitScale = Math.min(rect.width, rect.height) / 2;

    this.cols = options?.cols ?? 80;
    this.rows = options?.rows ?? 30;

    window.addEventListener("resize", () => {
      this.renderer.resize();
      const r = canvas.getBoundingClientRect();
      this.centerX = r.width / 2;
      this.centerY = r.height / 2;
      this.unitScale = Math.min(r.width, r.height) / 2;
    });
  }

  private intensityAt(col: number, row: number, timeSeconds: number): number {
    // Map grid to normalized device coordinates [-1, 1]
    const rect = (this.renderer as any)[
      "canvas"
    ].getBoundingClientRect() as DOMRect;
    const cellWidth = rect.width / this.cols;
    const cellHeight = rect.height / this.rows;
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
      this.renderer.drawAsciiGrid((c, r) => this.intensityAt(c, r, t));
      this.animationHandle = requestAnimationFrame(loop);
    };
    this.animationHandle = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animationHandle !== null) {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
  }
}

export default Orbweaver;
