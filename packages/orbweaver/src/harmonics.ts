export type Harmonic = { amplitude: number; frequency: number; phase: number };
export type HarmonicPreset = Harmonic[];

export type FrequencySpacing = "harmonic" | "geometric" | "additive";

export type HarmonicGenParams = {
    numHarmonics: number;
    baseFrequency: number;
    frequencySpacing: FrequencySpacing;
    /** Radians added per harmonic index for a simple progressive phase */
    phaseSpread: number;
};

export type HarmonicInput = HarmonicGenParams | Harmonic[];

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

/**
 * Generate a simple set of harmonics from a small parameter set.
 *
 * Defaults used for spacing specifics:
 * - geometric ratio = 1.7
 * - additive step = 1
 *
 * Amplitude profile: A_i = 1 / (i + 1)
 */
export function generateHarmonics(params: HarmonicGenParams): Harmonic[] {
    const { numHarmonics, baseFrequency, frequencySpacing, phaseSpread } = params;
    const harmonics: Harmonic[] = [];

    const geometricRatio = 1.7;
    const additiveStep = 1;

    for (let i = 0; i < numHarmonics; i++) {
        const amplitude = 1 / (i + 1);

        let frequency: number;
        switch (frequencySpacing) {
            case "harmonic":
                frequency = baseFrequency * (i + 1);
                break;
            case "geometric":
                frequency = baseFrequency * Math.pow(geometricRatio, i);
                break;
            case "additive":
                frequency = baseFrequency + additiveStep * i;
                break;
            default:
                frequency = baseFrequency * (i + 1);
                break;
        }

        const phase = i * phaseSpread;

        harmonics.push({ amplitude, frequency, phase });
    }

    return harmonics;
}