import { describe, expect, it } from 'vitest'
import { evaluateCompatibility } from './compatibility'

describe('evaluateCompatibility', () => {
  it('permite un navegador de escritorio con WebGL', () => {
    expect(
      evaluateCompatibility({
        isMobile: false,
        hasWebGL: true,
      }),
    ).toEqual({ status: 'supported' })
  })

  it('explica que la experiencia móvil no es compatible', () => {
    expect(
      evaluateCompatibility({
        isMobile: true,
        hasWebGL: true,
      }),
    ).toEqual({ status: 'unsupported', reason: 'mobile' })
  })

  it('explica la incompatibilidad cuando WebGL no está disponible', () => {
    expect(
      evaluateCompatibility({
        isMobile: false,
        hasWebGL: false,
      }),
    ).toEqual({ status: 'unsupported', reason: 'webgl' })
  })
})
