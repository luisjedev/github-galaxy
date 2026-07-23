import { planetPositionAt, type GitHubSystem } from './github-system'

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

const EMPTY_SYSTEM_SPAWN_DISTANCE = 10
const SPAWN_ALTITUDE = 7
const FORWARD_ACCELERATION = 2
const BRAKE_DECELERATION = 2
const REVERSE_ACCELERATION = 0.35
const COAST_DECELERATION = 0.2
export const NORMAL_FLIGHT_SPEED = 2
export const REVERSE_FLIGHT_SPEED = 0.6
export const TURBO_FLIGHT_SPEED = 4
const TURN_SPEED = 0.9
const ALTITUDE_SPEED = 0.7
const ALTITUDE_LIMIT = 40
const MAX_BANK = 0.58
const MAX_PITCH = 0.3
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
  const outermostPlanet = system.planets.reduce<(typeof system.planets)[number] | null>(
    (outermost, planet) =>
      !outermost || planet.orbitRadius > outermost.orbitRadius ? planet : outermost,
    null,
  )
  const outermostPosition = outermostPlanet ? planetPositionAt(outermostPlanet, 0) : null
  const x = outermostPosition?.x ?? 0
  const z = outermostPosition?.z ?? -EMPTY_SYSTEM_SPAWN_DISTANCE

  return {
    state: {
      x,
      z,
      altitude: SPAWN_ALTITUDE,
      heading: Math.atan2(-x, -z) || 0,
      bank: 0,
      pitch: 0,
      speed: 0,
      turbo: false,
    },
    destinationRepositoryId: null,
  }
}

export function createRespawnFlight(system: GitHubSystem): FlightState {
  return createInitialFlight(system).state
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
    if (input.forward) {
      speed += FORWARD_ACCELERATION * elapsed
    } else if (speed > 0) {
      speed = approachZero(speed, BRAKE_DECELERATION * elapsed)
    } else {
      speed -= REVERSE_ACCELERATION * elapsed
    }
  } else {
    speed = approachZero(speed, COAST_DECELERATION * elapsed)
  }

  speed = Math.max(
    -REVERSE_FLIGHT_SPEED,
    Math.min(turbo ? TURBO_FLIGHT_SPEED : NORMAL_FLIGHT_SPEED, speed),
  )
  const turnDirection = Number(input.left) - Number(input.right)
  const heading = state.heading + turnDirection * TURN_SPEED * elapsed
  const altitudeDirection = Number(input.ascend) - Number(input.descend)
  const hasThrustInput = input.forward !== input.reverse
  const altitudeChange = hasThrustInput ? altitudeDirection * ALTITUDE_SPEED * elapsed : 0
  const altitude = Math.max(
    -ALTITUDE_LIMIT,
    Math.min(ALTITUDE_LIMIT, state.altitude + altitudeChange),
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
