/**
 * Well-known behavior types.
 */
export type BehaviorType = "bob" | "rotate" | "orbit";

/**
s * Open accumulator: behaviors add numeric channels by string keys.
 */
export type FrameAccumulator = Record<string, number>;

/**
 * Well-known accumulator channels understood by the core orbweaver renderer.
 *
 * Behaviors should add their numeric contributions to these keys inside
 * {@link Behavior.contribute}. Unknown keys are ignored by the core, so
 * third‑party behaviors may safely invent additional namespaced channels for
 * custom renderers or post-effects (e.g. "myPlugin.fooAmplitude").
 *
 * Semantics:
 * - rotationPhase: absolute rotation phase (in radians) to add to the blob
 *   shape evaluation for the current frame.
 * - xOffsetUnits / yOffsetUnits: center translation offsets in normalized
 *   units (\[-1, 1\] space). Positive y moves the blob upward in screen space.
 */
export const Channels = {
  rotationPhase: "orbweaver.rotationPhase",
  xOffsetUnits: "orbweaver.xOffsetUnits",
  yOffsetUnits: "orbweaver.yOffsetUnits",
} as const;

/**
 * Base class for all orbweaver behaviors.
 *
 * Design:
 * - Behaviors evolve internal state once per frame via {@link update}.
 * - They expose their instantaneous per-sample effects via {@link contribute},
 *   adding numeric values to an open {@link FrameAccumulator} (a map of string
 *   channels to numbers). This split keeps per-frame integration separate from
 *   per-cell sampling, making multiple calls to {@link contribute} safe and
 *   deterministic within a frame.
 *
 * Extensibility:
 * - The accumulator is intentionally open (Record<string, number>).
 * - Core renders only read documented {@link Channels}. Custom behaviors may
 *   write new channels to be consumed by custom renderers without modifying the
 *   core.
 */
export abstract class Behavior {
  abstract readonly type: BehaviorType;
  /**
   * Advance internal state and contribute to the frame accumulator.
   */
  abstract update(deltaTimeSeconds: number): void;
  /**
   * Contribute current-frame values into the accumulator.
   */
  abstract contribute(acc: FrameAccumulator): void;
  /**
   * Update behavior parameters at runtime.
   */
  abstract set(params: unknown): void;
}

export type BobParams = {
  amplitude: number;
  rate?: number; // defaults to 2.0
};

export class BobBehavior extends Behavior {
  readonly type = "bob" as const;

  amplitude: number;
  rate: number;

  // Internal integrated/smoothed state
  private phase: number = 0;
  private currentAmplitude: number = 0;

  constructor(params: BobParams) {
    super();
    this.amplitude = params.amplitude;
    this.rate = params.rate ?? 2.0;
    this.currentAmplitude = this.amplitude;
  }

  set(params: Partial<BobParams>) {
    if (params.amplitude !== undefined) this.amplitude = params.amplitude;
    if (params.rate !== undefined) this.rate = params.rate;
  }

  update(deltaTimeSeconds: number): void {
    const dt = Math.max(0, deltaTimeSeconds);
    // Integrate phase
    this.phase += this.rate * dt;
    // Smooth amplitude towards target to avoid snapping on live edits
    const smoothing = 1 - Math.exp(-dt * 12);
    this.currentAmplitude +=
      (this.amplitude - this.currentAmplitude) *
      Math.max(0, Math.min(1, smoothing));
  }

  contribute(acc: FrameAccumulator): void {
    const bobOffsetUnits =
      this.currentAmplitude > 0
        ? Math.sin(this.phase) * this.currentAmplitude
        : 0;
    acc[Channels.yOffsetUnits] =
      (acc[Channels.yOffsetUnits] ?? 0) + bobOffsetUnits;
  }
}

export type RotateParams = {
  speed: number;
  direction?: number; // positive or negative; defaults to 1
};

export class RotateBehavior extends Behavior {
  readonly type = "rotate" as const;

  speed: number;
  direction: number;

  // Internal integrated state
  private phase: number = 0;

  constructor(params: RotateParams) {
    super();
    this.speed = params.speed;
    this.direction = params.direction ?? 1;
  }

  set(params: Partial<RotateParams>) {
    if (params.speed !== undefined) this.speed = params.speed;
    if (params.direction !== undefined) this.direction = params.direction;
  }

  update(deltaTimeSeconds: number): void {
    const dt = Math.max(0, deltaTimeSeconds);
    const angularVelocity = this.speed * this.direction;
    this.phase += angularVelocity * dt;
  }

  contribute(acc: FrameAccumulator): void {
    // Contribute absolute rotation phase so multiple rotate behaviors can combine
    acc[Channels.rotationPhase] =
      (acc[Channels.rotationPhase] ?? 0) + this.phase;
  }
}

export type OrbitParams = {
  radiusUnits: number; // in normalized units
  angularSpeed: number; // radians per second
  phase?: number; // starting phase
  axis?: "x" | "y" | "both"; // which axis to affect
};

export class OrbitBehavior extends Behavior {
  readonly type = "orbit" as const;

  radiusUnits: number;
  angularSpeed: number;
  private phase: number;
  private axis: "x" | "y" | "both";

  constructor(params: OrbitParams) {
    super();
    this.radiusUnits = params.radiusUnits;
    this.angularSpeed = params.angularSpeed;
    this.phase = params.phase ?? 0;
    this.axis = params.axis ?? "both";
  }

  set(params: Partial<OrbitParams>): void {
    if (params.radiusUnits !== undefined) this.radiusUnits = params.radiusUnits;
    if (params.angularSpeed !== undefined)
      this.angularSpeed = params.angularSpeed;
    if (params.phase !== undefined) this.phase = params.phase;
    if (params.axis !== undefined) this.axis = params.axis;
  }

  update(deltaTimeSeconds: number): void {
    const dt = Math.max(0, deltaTimeSeconds);
    this.phase += this.angularSpeed * dt;
  }

  contribute(acc: FrameAccumulator): void {
    const x = Math.cos(this.phase) * this.radiusUnits;
    const y = Math.sin(this.phase) * this.radiusUnits;
    if (this.axis === "x" || this.axis === "both") {
      acc[Channels.xOffsetUnits] = (acc[Channels.xOffsetUnits] ?? 0) + x;
    }
    if (this.axis === "y" || this.axis === "both") {
      acc[Channels.yOffsetUnits] = (acc[Channels.yOffsetUnits] ?? 0) + y;
    }
  }
}
