import { describe, expect, test } from 'vitest'
import {
  advanceFlight,
  createInitialFlight,
  createRespawnFlight,
  idleFlightInput,
  NORMAL_FLIGHT_SPEED,
  REVERSE_FLIGHT_SPEED,
  TURBO_FLIGHT_SPEED,
  type FlightInput,
  type FlightState,
} from './flight'
import {
  createGitHubSystem,
  type GitHubProfile,
  type GitHubRepository,
} from './github-system'

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

const profile: GitHubProfile = {
  id: 1,
  login: 'pilot',
  name: 'Pilot',
  avatar_url: 'https://avatars.example/pilot.png',
  html_url: 'https://github.com/pilot',
  bio: null,
  followers: 0,
  public_repos: 20,
}

function repository(id: number): GitHubRepository {
  return {
    id,
    name: `repository-${id}`,
    html_url: `https://github.com/pilot/repository-${id}`,
    description: null,
    fork: false,
    archived: false,
    is_template: false,
    language: 'TypeScript',
    stargazers_count: id,
    forks_count: 0,
    size: id * 10,
    updated_at: `2025-01-${String(id).padStart(2, '0')}T00:00:00Z`,
  }
}

describe('createInitialFlight', () => {
  test('aparece a altura 7 sobre la última órbita y mirando hacia la estrella', () => {
    const system = createGitHubSystem(
      profile,
      Array.from({ length: 20 }, (_, index) => repository(index + 1)),
    )
    const outermostPlanet = [...system.planets].sort(
      (left, right) => right.orbitRadius - left.orbitRadius,
    )[0]
    const x = Math.cos(outermostPlanet.initialPhase) * outermostPlanet.orbitRadius
    const z = -Math.sin(outermostPlanet.initialPhase) * outermostPlanet.orbitRadius

    expect(createInitialFlight(system)).toEqual({
      state: {
        x,
        z,
        altitude: 7,
        heading: Math.atan2(-x, -z),
        bank: 0,
        pitch: 0,
        speed: 0,
        turbo: false,
      },
      destinationRepositoryId: null,
    })
  })

  test('conserva un punto seguro a altura 7 cuando el sistema no tiene planetas', () => {
    expect(createInitialFlight(createGitHubSystem(profile, [])).state).toMatchObject({
      x: 0,
      z: -10,
      altitude: 7,
      heading: 0,
    })
  })

  test('usa exactamente el punto de entrada como destino de respawn', () => {
    const system = createGitHubSystem(
      profile,
      Array.from({ length: 20 }, (_, index) => repository(index + 1)),
    )

    expect(createRespawnFlight(system)).toEqual(createInitialFlight(system).state)
  })
})

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
    expect(advanceRepeatedly(idleState, input({ ascend: true })).pitch).toBeCloseTo(-0.3)

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

  test('S frena más rápido que dejar la nave a la deriva antes de aplicar reversa', () => {
    const cruising = { ...idleState, speed: NORMAL_FLIGHT_SPEED }
    const coasting = advanceRepeatedly(cruising, input({}), 10)
    const braking = advanceRepeatedly(cruising, input({ reverse: true }), 10)

    expect(braking.speed).toBeGreaterThanOrEqual(0)
    expect(braking.speed).toBeLessThan(coasting.speed)
    expect(advanceRepeatedly(braking, input({ reverse: true }))).toHaveProperty(
      'speed',
      -REVERSE_FLIGHT_SPEED,
    )
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
