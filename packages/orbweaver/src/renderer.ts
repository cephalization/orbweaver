export type RendererOptions = {
  cols?: number;
  rows?: number;
  foreground?: string;
  background?: string;
};

export interface Renderer {
  getPixelSize(): { width: number; height: number };
  getGridSize(): { cols: number; rows: number };
  clientToCell?: (clientX: number, clientY: number) => { col: number; row: number; x: number; y: number; distanceToCenter: number; unitScalePx: number; normalizedOffsetX: number; normalizedOffsetY: number; normalizedDistance: number };
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

export type CanvasGradientRendererOptions = RendererOptions & {
  /**
   * Ordered list of CSS colors (hex, rgb(a), hsl(a)).
   * Intensity 0 maps to the first color, 1 maps to the last.
   */
  colors?: string[];
};

type RGBA = { r: number; g: number; b: number; a: number };

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function parseHexColor(input: string): RGBA | null {
  const s = input.trim().toLowerCase();
  if (!s.startsWith("#")) return null;
  let hex = s.slice(1);
  if (hex.length === 3) {
    const r = parseInt(hex[0]! + hex[0]!, 16);
    const g = parseInt(hex[1]! + hex[1]!, 16);
    const b = parseInt(hex[2]! + hex[2]!, 16);
    return { r, g, b, a: 255 };
  }
  if (hex.length === 4) {
    const r = parseInt(hex[0]! + hex[0]!, 16);
    const g = parseInt(hex[1]! + hex[1]!, 16);
    const b = parseInt(hex[2]! + hex[2]!, 16);
    const a = parseInt(hex[3]! + hex[3]!, 16);
    return { r, g, b, a };
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b, a: 255 };
  }
  if (hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = parseInt(hex.slice(6, 8), 16);
    return { r, g, b, a };
  }
  return null;
}

function parseRgbColor(input: string): RGBA | null {
  const s = input.trim();
  // rgb(255,0,0) or rgba(255,0,0,0.5)
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (!rgb) return null;
  const parts = rgb[1]!.split(',').map((p) => p.trim());
  if (parts.length < 3) return null;
  const to255 = (v: string): number => {
    if (v.endsWith('%')) {
      const n = parseFloat(v.slice(0, -1));
      return Math.round(clamp01(n / 100) * 255);
    }
    return Math.max(0, Math.min(255, Math.round(parseFloat(v))));
  };
  const r = to255(parts[0]!);
  const g = to255(parts[1]!);
  const b = to255(parts[2]!);
  let a = 255;
  if (parts.length >= 4) {
    const av = parts[3]!;
    const alpha = av.endsWith('%')
      ? clamp01(parseFloat(av) / 100)
      : clamp01(parseFloat(av));
    a = Math.round(alpha * 255);
  }
  return { r, g, b, a };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  // h [0,360), s,l [0,1]
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function parseHslColor(input: string): RGBA | null {
  const s = input.trim();
  // hsl(120, 100%, 50%) or hsla(120, 100%, 50%, 0.5)
  const hsl = /^hsla?\(([^)]+)\)$/i.exec(s);
  if (!hsl) return null;
  const parts = hsl[1]!.split(',').map((p) => p.trim());
  if (parts.length < 3) return null;
  const hRaw = parts[0]!;
  const sRaw = parts[1]!;
  const lRaw = parts[2]!;
  const h = ((parseFloat(hRaw) % 360) + 360) % 360;
  const sVal = clamp01(parseFloat(sRaw) / (sRaw.endsWith('%') ? 100 : 1));
  const lVal = clamp01(parseFloat(lRaw) / (lRaw.endsWith('%') ? 100 : 1));
  const { r, g, b } = hslToRgb(h, sVal, lVal);
  let a = 255;
  if (parts.length >= 4) {
    const av = parts[3]!;
    const alpha = av.endsWith('%')
      ? clamp01(parseFloat(av) / 100)
      : clamp01(parseFloat(av));
    a = Math.round(alpha * 255);
  }
  return { r, g, b, a };
}

function parseColor(input: string): RGBA | null {
  return parseHexColor(input) || parseRgbColor(input) || parseHslColor(input);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rgbaToCss({ r, g, b, a }: RGBA): string {
  const alpha = a / 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

export class CanvasGradientRenderer implements Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private cols: number;
  private rows: number;
  private background: string;
  private colorStops: RGBA[];
  private resizeListeners: Array<() => void> = [];
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, options?: CanvasGradientRendererOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context not available");
    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;
    this.cols = options?.cols ?? 80;
    this.rows = options?.rows ?? 30;
    this.background = options?.background ?? "#000000";
    const defaults = ["#000000", "#ffffff"]; // fallback 2-stop gradient
    const inputs = options?.colors && options.colors.length >= 2 ? options.colors : defaults;
    this.colorStops = inputs.map((c) => parseColor(c) ?? { r: 0, g: 0, b: 0, a: 255 });

    // offscreen buffer used for smooth upscaling
    this.offscreen = document.createElement("canvas");
    this.offscreen.width = this.cols;
    this.offscreen.height = this.rows;
    const off = this.offscreen.getContext("2d");
    if (!off) throw new Error("2D canvas context not available (offscreen)");
    this.offCtx = off;

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

  setBackground(background: string) {
    this.background = background;
  }

  setColors(colors: string[]) {
    if (!colors || colors.length < 2) return;
    this.colorStops = colors.map((c) => parseColor(c) ?? { r: 0, g: 0, b: 0, a: 255 });
  }

  private configureCanvas() {
    const { canvas } = this;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || 800;
    const cssHeight = rect.height || 450;

    canvas.width = Math.max(1, Math.floor(cssWidth * this.dpr));
    canvas.height = Math.max(1, Math.floor(cssHeight * this.dpr));

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
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

  private sampleColor(t: number): RGBA {
    const n = this.colorStops.length;
    if (n === 0) return { r: 0, g: 0, b: 0, a: 255 };
    if (n === 1) return this.colorStops[0]!;
    const clamped = clamp01(t);
    const scaled = clamped * (n - 1);
    const i0 = Math.floor(scaled);
    const i1 = Math.min(n - 1, i0 + 1);
    const localT = scaled - i0;
    const c0 = this.colorStops[i0]!;
    const c1 = this.colorStops[i1]!;
    return {
      r: Math.round(lerp(c0.r, c1.r, localT)),
      g: Math.round(lerp(c0.g, c1.g, localT)),
      b: Math.round(lerp(c0.b, c1.b, localT)),
      a: Math.round(lerp(c0.a, c1.a, localT)),
    };
  }

  private drawGradientGrid(intensityAt: (col: number, row: number) => number) {
    const rect = this.canvas.getBoundingClientRect();

    // 1) Shade offscreen grid (cols x rows)
    const imageData = this.offCtx.createImageData(this.cols, this.rows);
    const data = imageData.data;
    let p = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const intensity = Math.min(1, Math.max(0, intensityAt(c, r)));
        const color = this.sampleColor(intensity);
        data[p++] = color.r;
        data[p++] = color.g;
        data[p++] = color.b;
        data[p++] = color.a; // already in 0..255
      }
    }
    this.offCtx.putImageData(imageData, 0, 0);

    // 2) Clear and upscale with smoothing
    this.clear();
    this.ctx.imageSmoothingEnabled = true;
    (this.ctx as any).imageSmoothingQuality = "high";
    this.ctx.drawImage(this.offscreen, 0, 0, rect.width, rect.height);
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
    this.drawGradientGrid(intensityAt);
  }

  onResize(callback: () => void): () => void {
    if (this.resizeListeners.length === 0) {
      // Lazily attach a single window listener
      window.addEventListener("resize", () => this.resize());
    }
    this.resizeListeners.push(callback);
    return () => {
      this.resizeListeners = this.resizeListeners.filter((cb) => cb !== callback);
    };
  }

  destroy() {
    this.resizeListeners.forEach((listener) => {
      window.removeEventListener("resize", listener);
    });
    this.resizeListeners = [];
  }
}
