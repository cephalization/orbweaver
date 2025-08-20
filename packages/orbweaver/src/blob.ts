import type { Harmonic, HarmonicGenParams, HarmonicInput } from "./harmonics.js";
import { HARMONIC_PRESETS, generateHarmonics } from "./harmonics.js";


export class BlobModel {
  baseRadius: number;
  amplitude: number;
  harmonics: Harmonic[];

  constructor(baseRadius = 0.5, input?: HarmonicInput) {
    this.baseRadius = baseRadius;
    this.amplitude = 0.12;
    if (!input) {
      this.harmonics = HARMONIC_PRESETS.rippled;
    } else if (Array.isArray(input)) {
      this.harmonics = input;
    } else {
      this.harmonics = generateHarmonics(input);
    }
  }

  /**
   * Replace the current harmonics with a newly generated set from params.
   */
  setHarmonicParams(params: HarmonicGenParams): void {
    this.setHarmonics(params);
  }

  /**
   * Replace the current harmonics either by direct array or by generation params.
   */
  setHarmonics(input: HarmonicInput): void {
    if (Array.isArray(input)) {
      this.harmonics = input;
    } else {
      this.harmonics = generateHarmonics(input);
    }
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
