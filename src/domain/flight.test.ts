import { describe, expect, test } from 'vitest'
import {
  advanceFlight,
  idleFlightInput,
  NORMAL_FLIGHT_SPEED,
  TURBO_FLIGHT_SPEED,
  type FlightInput,
  type FlightState,
} from './flight'

const idleState: FlightState = {
  x: 0,
  z: 0,
  altitude: 0,
  heading: 0,
  bank: 0,
  pitch: 0,
  speed: 0,
  turbo: false,
}

function input(overrides: Partial<FlightInput>): FlightInput {
  return { ...idleFlightInput, ...overrides }
}

function advanceRepeatedly(
  state: FlightState,
  controls: FlightInput,
  frames = 100,
): FlightState {
  let next = state
  for (let frame = 0; frame < frames; frame += 1) {
    next = advanceFlight(next, controls, 0.05)
  }
  return next
}

describe('advanceFlight', () => {
  test('A gira a la izquierda y levanta el ala derecha; D hace lo contrario', () => {
    const left = advanceFlight(idleState, input({ left: true }), 0.05)
    const right = advanceFlight(idleState, input({ right: true }), 0.05)

    expect(left.heading).toBeGreaterThan(0)
    expect(left.bank).toBeLessThan(0)
    expect(right.heading).toBeLessThan(0)
    expect(right.bank).toBeGreaterThan(0)
    expect(advanceRepeatedly(idleState, input({ left: true })).bank).toBeCloseTo(-0.58)
  })

  test('inclina el morro hacia la subida o la bajada y recupera la posición neutra', () => {
    const climbing = advanceFlight(idleState, input({ ascend: true }), 0.05)
    const descending = advanceFlight(idleState, input({ descend: true }), 0.05)

    expect(climbing.altitude).toBeGreaterThan(0)
    expect(climbing.pitch).toBeLessThan(0)
    expect(descending.altitude).toBeLessThan(0)
    expect(descending.pitch).toBeGreaterThan(0)
    expect(advanceRepeatedly(idleState, input({ ascend: true })).pitch).toBeCloseTo(-0.4)

    const banked = advanceRepeatedly(idleState, input({ left: true }), 10)
    const level = advanceRepeatedly(banked, input({}))
    expect(level.bank).toBe(0)
  })

  test('limita la velocidad normal a 3 y el turbo a 6', () => {
    const normal = advanceRepeatedly(idleState, input({ forward: true }))
    const turbo = advanceRepeatedly(idleState, input({ forward: true, turbo: true }))

    expect(normal.speed).toBe(NORMAL_FLIGHT_SPEED)
    expect(turbo.speed).toBe(TURBO_FLIGHT_SPEED)
  })
})
