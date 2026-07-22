import { describe, expect, test } from 'vitest'
import {
  advanceFlight,
  idleFlightInput,
  NORMAL_FLIGHT_SPEED,
  REVERSE_FLIGHT_SPEED,
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

  test('J y K inclinan la nave sin desplazarla por sí solos', () => {
    const tiltingUp = advanceFlight(idleState, input({ ascend: true }), 0.05)
    const tiltingDown = advanceFlight(idleState, input({ descend: true }), 0.05)

    expect(tiltingUp).toMatchObject({ x: 0, z: 0, altitude: 0, speed: 0 })
    expect(tiltingUp.pitch).toBeLessThan(0)
    expect(tiltingDown).toMatchObject({ x: 0, z: 0, altitude: 0, speed: 0 })
    expect(tiltingDown.pitch).toBeGreaterThan(0)
    expect(advanceRepeatedly(idleState, input({ ascend: true })).pitch).toBeCloseTo(-0.6)

    const banked = advanceRepeatedly(idleState, input({ left: true }), 10)
    const level = advanceRepeatedly(banked, input({}))
    expect(level.bank).toBe(0)
  })

  test('solo cambia de altitud al combinar la inclinación con W o S', () => {
    const ascendingForward = advanceFlight(
      idleState,
      input({ ascend: true, forward: true }),
      0.05,
    )
    const descendingInReverse = advanceFlight(
      idleState,
      input({ descend: true, reverse: true }),
      0.05,
    )

    expect(ascendingForward.altitude).toBeGreaterThan(0)
    expect(descendingInReverse.altitude).toBeLessThan(0)
  })

  test('limita mucho la velocidad normal, la reversa y el turbo', () => {
    const normal = advanceRepeatedly(idleState, input({ forward: true }))
    const reverse = advanceRepeatedly(idleState, input({ reverse: true }))
    const turbo = advanceRepeatedly(idleState, input({ forward: true, turbo: true }))

    expect(normal.speed).toBe(NORMAL_FLIGHT_SPEED)
    expect(reverse.speed).toBe(-REVERSE_FLIGHT_SPEED)
    expect(turbo.speed).toBe(TURBO_FLIGHT_SPEED)
  })
})
