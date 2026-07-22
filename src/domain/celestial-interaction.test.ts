import { describe, expect, test } from 'vitest'
import type { FlightState } from './flight'
import type { GitHubSystem } from './github-system'
import {
  atmosphereRadius,
  collisionRadius,
  detectAtmosphereContact,
  resolveAtmosphereCollision,
  STAR_RADIUS,
} from './celestial-interaction'

const system = { planets: [] } as unknown as GitHubSystem

function flight(z: number, speed = 4): FlightState {
  return {
    x: 0,
    z,
    altitude: 0,
    heading: 0,
    bank: 0,
    pitch: 0,
    speed,
    turbo: true,
  }
}

describe('zonas de aproximación y colisión', () => {
  test('mantiene la alarma exterior y sitúa la colisión casi sobre la superficie', () => {
    expect(collisionRadius(STAR_RADIUS) - STAR_RADIUS).toBeCloseTo(0.2)
    expect(atmosphereRadius(STAR_RADIUS) - collisionRadius(STAR_RADIUS)).toBeCloseTo(1.8)
    expect(detectAtmosphereContact(system, flight(-(STAR_RADIUS + 1.9)), 0)).toEqual({
      key: 'star',
      kind: 'star',
    })
  })

  test('permite atravesar la zona de alarma y frena junto al cuerpo', () => {
    const result = resolveAtmosphereCollision(
      system,
      flight(-(STAR_RADIUS + 3)),
      flight(-(STAR_RADIUS - 1)),
      0,
      0.05,
    )

    expect(result.contact).toEqual({ key: 'star', kind: 'star' })
    expect(result.flight.z).toBeCloseTo(-collisionRadius(STAR_RADIUS))
    expect(result.flight.speed).toBe(0)
  })
})
