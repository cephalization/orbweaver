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
