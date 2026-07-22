import type { GitHubSystem } from './github-system'

export interface FlightState {
  x: number
  z: number
  altitude: number
  heading: number
  bank: number
  pitch: number
  speed: number
  turbo: boolean
}

export interface FlightInput {
  forward: boolean
  reverse: boolean
  left: boolean
  right: boolean
  descend: boolean
  ascend: boolean
  turbo: boolean
}

export interface InitialFlight {
  state: FlightState
  destinationRepositoryId: number | null
}

export interface ShipAppearance {
  primaryHue: number
  accentHue: number
}

export const idleFlightInput: FlightInput = {
  forward: false,
  reverse: false,
  left: false,
  right: false,
  descend: false,
  ascend: false,
  turbo: false,
}

const SPAWN_DISTANCE = 10
const FORWARD_ACCELERATION = 2
const REVERSE_ACCELERATION = 1.5
const COAST_DECELERATION = 0.75
export const NORMAL_FLIGHT_SPEED = 1.5
const REVERSE_SPEED = 0.9
export const TURBO_FLIGHT_SPEED = 3
const TURN_SPEED = 1.9
const ALTITUDE_SPEED = 7
const ALTITUDE_LIMIT = 40
const MAX_BANK = 0.58
const MAX_PITCH = 0.4
const ATTITUDE_RESPONSE = 8

function approachZero(value: number, amount: number): number {
  if (value > 0) return Math.max(0, value - amount)
  if (value < 0) return Math.min(0, value + amount)
  return 0
}

function animateAttitude(current: number, target: number, elapsed: number): number {
  const next = current + (target - current) * (1 - Math.exp(-ATTITUDE_RESPONSE * elapsed))
  return Math.abs(next - target) < 0.001 ? target : next
}

export function createInitialFlight(system: GitHubSystem): InitialFlight {
  const destination = [...system.planets].sort(
    (left, right) => left.orbitRadius - right.orbitRadius,
  )[0]
  const x = 0
  const z = -SPAWN_DISTANCE
  const destinationX = destination
    ? Math.cos(destination.initialPhase) * destination.orbitRadius
    : 0
  const destinationZ = destination
    ? -Math.sin(destination.initialPhase) * destination.orbitRadius
    : 0

  return {
    state: {
      x,
      z,
      altitude: 0,
      heading: Math.atan2(destinationX - x, destinationZ - z),
      bank: 0,
      pitch: 0,
      speed: 0,
      turbo: false,
    },
    destinationRepositoryId: destination?.repository.id ?? null,
  }
}

export function describeShipAppearance(system: GitHubSystem): ShipAppearance {
  return {
    primaryHue: system.starAppearance.technologyHues[0] ?? system.starAppearance.primaryHue,
    accentHue: system.starAppearance.technologyHues[1] ?? system.starAppearance.accentHue,
  }
}

export function advanceFlight(
  state: FlightState,
  input: FlightInput,
  elapsedSeconds: number,
): FlightState {
  const elapsed = Math.min(Math.max(elapsedSeconds, 0), 0.05)
  const turbo = input.turbo && input.forward
  let speed = state.speed

  if (input.forward !== input.reverse) {
    speed += (input.forward ? FORWARD_ACCELERATION : -REVERSE_ACCELERATION) * elapsed
  } else {
    speed = approachZero(speed, COAST_DECELERATION * elapsed)
  }

  speed = Math.max(
    -REVERSE_SPEED,
    Math.min(turbo ? TURBO_FLIGHT_SPEED : NORMAL_FLIGHT_SPEED, speed),
  )
  const turnDirection = Number(input.left) - Number(input.right)
  const heading = state.heading + turnDirection * TURN_SPEED * elapsed
  const altitudeDirection = Number(input.ascend) - Number(input.descend)
  const altitude = Math.max(
    -ALTITUDE_LIMIT,
    Math.min(ALTITUDE_LIMIT, state.altitude + altitudeDirection * ALTITUDE_SPEED * elapsed),
  )
  const targetBank = turnDirection === 0 ? 0 : -turnDirection * MAX_BANK
  const targetPitch = altitudeDirection === 0 ? 0 : -altitudeDirection * MAX_PITCH
  const bank = animateAttitude(state.bank, targetBank, elapsed)
  const pitch = animateAttitude(state.pitch, targetPitch, elapsed)

  return {
    x: state.x + Math.sin(heading) * speed * elapsed,
    z: state.z + Math.cos(heading) * speed * elapsed,
    altitude,
    heading,
    bank,
    pitch,
    speed,
    turbo,
  }
}
