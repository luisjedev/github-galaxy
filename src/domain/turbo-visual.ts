import type { VisualQuality } from './visual-generation'

export interface TurboVisualProfile {
  speedLineCount: number
  particleCount: number
  maximumIntensity: number
  motionScale: number
  feedback: 'full' | 'attenuated'
}

export function isTurboVisualActive(
  flight: { turbo: boolean; speed: number },
  effectsEnabled: boolean,
): boolean {
  return effectsEnabled && flight.turbo && flight.speed > 0
}

export function advanceTurboVisualIntensity(
  current: number,
  target: number,
  elapsedSeconds: number,
): number {
  const response = target > current ? 14 : 9
  const next = current +
    (target - current) * (1 - Math.exp(-response * Math.min(elapsedSeconds, 0.05)))
  return target === 0 && next < 0.001 ? 0 : next
}

export function turboVisualProfile(
  quality: VisualQuality,
  reducedMotion: boolean,
): TurboVisualProfile {
  if (quality === 'normal' && !reducedMotion) {
    return {
      speedLineCount: 24,
      particleCount: 72,
      maximumIntensity: 1,
      motionScale: 1,
      feedback: 'full',
    }
  }

  if (quality === 'reduced' && reducedMotion) {
    return {
      speedLineCount: 7,
      particleCount: 24,
      maximumIntensity: 0.4,
      motionScale: 0.35,
      feedback: 'attenuated',
    }
  }

  return quality === 'reduced'
    ? {
        speedLineCount: 12,
        particleCount: 42,
        maximumIntensity: 0.78,
        motionScale: 0.82,
        feedback: 'attenuated',
      }
    : {
        speedLineCount: 9,
        particleCount: 36,
        maximumIntensity: 0.52,
        motionScale: 0.42,
        feedback: 'attenuated',
      }
}
