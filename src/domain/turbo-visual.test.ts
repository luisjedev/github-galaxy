import { describe, expect, test } from 'vitest'
import {
  advanceTurboVisualIntensity,
  isTurboVisualActive,
  turboVisualProfile,
} from './turbo-visual'

describe('feedback visual del turbo', () => {
  test('distingue el turbo normal con una capa densa de rayas y partículas reutilizables', () => {
    const profile = turboVisualProfile('normal', false)

    expect(profile).toEqual({
      speedLineCount: 36,
      particleCount: 72,
      maximumIntensity: 1,
      motionScale: 1,
      feedback: 'full',
    })
  })

  test('solo activa la intensidad de turbo mientras hay impulso real y la escena está habilitada', () => {
    expect(isTurboVisualActive({ turbo: true, speed: 1 }, true)).toBe(true)
    expect(isTurboVisualActive({ turbo: true, speed: 0 }, true)).toBe(false)
    expect(isTurboVisualActive({ turbo: false, speed: 1 }, true)).toBe(false)
    expect(isTurboVisualActive({ turbo: true, speed: 1 }, false)).toBe(false)
  })

  test('interpola entradas y salidas rápidas sin saltos ni sobrepasar el objetivo', () => {
    const entered = advanceTurboVisualIntensity(0, 1, 1 / 60)
    const released = advanceTurboVisualIntensity(1, 0, 1 / 60)

    expect(entered).toBeGreaterThan(0)
    expect(entered).toBeLessThan(1)
    expect(released).toBeGreaterThan(0)
    expect(released).toBeLessThan(1)
    expect(advanceTurboVisualIntensity(0.0005, 0, 1 / 60)).toBe(0)
  })

  test('reduce por separado la calidad y el movimiento sin eliminar el feedback funcional', () => {
    const full = turboVisualProfile('normal', false)
    const reducedQuality = turboVisualProfile('reduced', false)
    const reducedMotion = turboVisualProfile('normal', true)
    const fullyAttenuated = turboVisualProfile('reduced', true)

    expect(reducedQuality.speedLineCount).toBeLessThan(full.speedLineCount)
    expect(reducedQuality.particleCount).toBeLessThan(full.particleCount)
    expect(reducedMotion.maximumIntensity).toBeLessThan(full.maximumIntensity)
    expect(reducedMotion.motionScale).toBeLessThan(full.motionScale)
    expect(fullyAttenuated.speedLineCount).toBeLessThan(reducedQuality.speedLineCount)
    expect(fullyAttenuated.maximumIntensity).toBeGreaterThan(0)
    expect(fullyAttenuated.feedback).toBe('attenuated')
  })
})
