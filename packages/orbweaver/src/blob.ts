export type Harmonic = { amplitude: number; frequency: number; phase: number };
export type HarmonicPreset = Harmonic[];

export type HarmonicPresetName =
  | "minimal"
  | "classic"
  | "flow"
  | "rippled"
  | "spiky"
  | "complex";

export const HARMONIC_PRESETS: Record<HarmonicPresetName, HarmonicPreset> = {
  minimal: [{ amplitude: 1.0, frequency: 2, phase: 0 }],
  classic: [
    { amplitude: 1.0, frequency: 3, phase: 0 },
    { amplitude: 0.6, frequency: 5, phase: Math.PI / 3 },
    { amplitude: 0.4, frequency: 7, phase: Math.PI / 5 },
  ],
  flow: [
    { amplitude: 0.9, frequency: 2, phase: 0 },
    { amplitude: 0.5, frequency: 3, phase: Math.PI / 4 },
    { amplitude: 0.3, frequency: 4, phase: Math.PI / 2 },
  ],
  rippled: [
    { amplitude: 1.0, frequency: 2, phase: 0 },
    { amplitude: 0.35, frequency: 6, phase: Math.PI / 6 },
    { amplitude: 0.25, frequency: 9, phase: Math.PI / 2 },
    { amplitude: 0.15, frequency: 12, phase: Math.PI / 3 },
  ],
  spiky: [
    { amplitude: 0.8, frequency: 5, phase: 0 },
    { amplitude: 0.6, frequency: 9, phase: Math.PI / 5 },
    { amplitude: 0.4, frequency: 13, phase: Math.PI / 2 },
  ],
  complex: [
    { amplitude: 1.0, frequency: 2, phase: 0 },
    { amplitude: 0.7, frequency: 3, phase: Math.PI / 6 },
    { amplitude: 0.5, frequency: 5, phase: Math.PI / 3 },
    { amplitude: 0.35, frequency: 7, phase: Math.PI / 2 },
    { amplitude: 0.25, frequency: 9, phase: (2 * Math.PI) / 3 },
    { amplitude: 0.2, frequency: 12, phase: (5 * Math.PI) / 6 },
  ],
};

export class BlobModel {
  baseRadius: number;
  amplitude: number;
  harmonics: Harmonic[];

  constructor(baseRadius = 0.5) {
    this.baseRadius = baseRadius;
    this.amplitude = 0.12;
    this.harmonics = HARMONIC_PRESETS.complex;
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
