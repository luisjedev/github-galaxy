import type { FlightState } from './flight'
import {
  FULL_ROTATION_RADIANS,
  type GitHubSystem,
  type PlanetDescriptor,
} from './github-system'

export const STAR_RADIUS = 4
export const CELESTIAL_ATMOSPHERE_CLEARANCE = 2
export const INFORMATION_ZONE_CLEARANCE = 6

export type CelestialBodyKey = 'star' | `planet:${number}`

export interface AtmosphereContact {
  key: CelestialBodyKey
  kind: 'star' | 'planet'
}

export interface AtmosphereCollisionResult {
  flight: FlightState
  contact: AtmosphereContact | null
}

export type ActiveCelestialBody =
  | {
      key: 'star'
      kind: 'star'
      surfaceDistance: number
    }
  | {
      key: `planet:${number}`
      kind: 'planet'
      planet: PlanetDescriptor
      surfaceDistance: number
    }

export function atmosphereRadius(bodyRadius: number): number {
  return bodyRadius + CELESTIAL_ATMOSPHERE_CLEARANCE
}

export function informationZoneRadius(bodyRadius: number): number {
  return bodyRadius + INFORMATION_ZONE_CLEARANCE
}

function distanceFromShip(
  flight: FlightState,
  position: { x: number; y: number; z: number },
): number {
  return Math.hypot(flight.x - position.x, flight.altitude - position.y, flight.z - position.z)
}

function planetPosition(planet: PlanetDescriptor, elapsedSeconds: number) {
  const phase =
    planet.initialPhase +
    (elapsedSeconds / planet.orbitPeriodSeconds) * FULL_ROTATION_RADIANS

  return {
    x: Math.cos(phase) * planet.orbitRadius,
    y: 0,
    z: -Math.sin(phase) * planet.orbitRadius,
  }
}

interface Position {
  x: number
  y: number
  z: number
}

interface CollisionBody extends AtmosphereContact {
  position: Position
  radius: number
}

interface MovingCollisionBody extends Omit<CollisionBody, 'position'> {
  previousPosition: Position
  position: Position
}

function add(left: Position, right: Position): Position {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z }
}

function subtract(left: Position, right: Position): Position {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }
}

function scale(position: Position, multiplier: number): Position {
  return {
    x: position.x * multiplier,
    y: position.y * multiplier,
    z: position.z * multiplier,
  }
}

function dot(left: Position, right: Position): number {
  return left.x * right.x + left.y * right.y + left.z * right.z
}

const ATMOSPHERE_CONTACT_TOLERANCE = 0.01

function collisionBodies(system: GitHubSystem, elapsedSeconds: number): CollisionBody[] {
  return [
    {
      key: 'star',
      kind: 'star',
      position: { x: 0, y: 0, z: 0 },
      radius: atmosphereRadius(STAR_RADIUS),
    },
    ...system.planets.map((planet) => ({
      key: `planet:${planet.repository.id}` as const,
      kind: 'planet' as const,
      position: planetPosition(planet, elapsedSeconds),
      radius: atmosphereRadius(planet.radius),
    })),
  ]
}

function movingCollisionBodies(
  system: GitHubSystem,
  previousElapsedSeconds: number,
  elapsedSeconds: number,
): MovingCollisionBody[] {
  const previousPositionByKey = new Map(
    collisionBodies(system, previousElapsedSeconds).map((body) => [body.key, body.position]),
  )
  return collisionBodies(system, elapsedSeconds).map((body) => ({
    ...body,
    previousPosition: previousPositionByKey.get(body.key) ?? body.position,
  }))
}

function flightPosition(flight: FlightState): Position {
  return { x: flight.x, y: flight.altitude, z: flight.z }
}

export function detectAtmosphereContact(
  system: GitHubSystem,
  flight: FlightState,
  elapsedSeconds: number,
): AtmosphereContact | null {
  const position = flightPosition(flight)
  const body = collisionBodies(system, elapsedSeconds)
    .filter(
      (candidate) =>
        Math.hypot(
          position.x - candidate.position.x,
          position.y - candidate.position.y,
          position.z - candidate.position.z,
        ) <=
        candidate.radius + ATMOSPHERE_CONTACT_TOLERANCE,
    )
    .sort((left, right) => left.key.localeCompare(right.key))[0]

  return body ? { key: body.key, kind: body.kind } : null
}

export function resolveAtmosphereCollision(
  system: GitHubSystem,
  previousFlight: FlightState,
  proposedFlight: FlightState,
  previousElapsedSeconds: number,
  elapsedSeconds: number,
): AtmosphereCollisionResult {
  const start = flightPosition(previousFlight)
  const proposed = flightPosition(proposedFlight)
  const shipMovement = subtract(proposed, start)
  let firstCollision: {
    body: MovingCollisionBody
    relativeStart: Position
    relativeMovement: Position
    time: number
  } | null = null

  for (const body of movingCollisionBodies(
    system,
    previousElapsedSeconds,
    elapsedSeconds,
  )) {
    const relativeStart = subtract(start, body.previousPosition)
    const bodyMovement = subtract(body.position, body.previousPosition)
    const relativeMovement = subtract(shipMovement, bodyMovement)
    const relativeMovementSquared = dot(relativeMovement, relativeMovement)
    if (relativeMovementSquared === 0) continue

    const startDistance = Math.hypot(relativeStart.x, relativeStart.y, relativeStart.z)
    const projectedMovement = dot(relativeStart, relativeMovement)
    let collisionTime: number | null = null

    if (startDistance <= body.radius + ATMOSPHERE_CONTACT_TOLERANCE) {
      const outwardShipMovement = dot(relativeStart, shipMovement)
      if (outwardShipMovement <= 0 && projectedMovement < 0) collisionTime = 0
    } else {
      const distanceFromSurfaceSquared = startDistance ** 2 - body.radius ** 2
      const discriminant =
        projectedMovement ** 2 - relativeMovementSquared * distanceFromSurfaceSquared
      if (discriminant >= 0) {
        const entryTime =
          (-projectedMovement - Math.sqrt(discriminant)) / relativeMovementSquared
        if (entryTime >= 0 && entryTime <= 1) collisionTime = entryTime
      }
    }

    if (collisionTime !== null && (!firstCollision || collisionTime < firstCollision.time)) {
      firstCollision = { body, relativeStart, relativeMovement, time: collisionTime }
    }
  }

  if (!firstCollision) {
    return {
      flight: proposedFlight,
      contact: detectAtmosphereContact(system, proposedFlight, elapsedSeconds),
    }
  }

  const relativeContact = add(
    firstCollision.relativeStart,
    scale(firstCollision.relativeMovement, firstCollision.time),
  )
  const normalLength =
    Math.hypot(relativeContact.x, relativeContact.y, relativeContact.z) || 1
  const contactNormal = scale(relativeContact, 1 / normalLength)
  const relativeEnd = subtract(proposed, firstCollision.body.position)
  const remainingRelativeMovement = subtract(relativeEnd, relativeContact)
  const inwardMovement = Math.min(0, dot(remainingRelativeMovement, contactNormal))
  const resolvedRelativePosition = add(
    add(relativeContact, remainingRelativeMovement),
    scale(contactNormal, -inwardMovement),
  )
  const resolvedPosition = add(firstCollision.body.position, resolvedRelativePosition)

  return {
    flight: {
      ...proposedFlight,
      x: resolvedPosition.x,
      altitude: resolvedPosition.y,
      z: resolvedPosition.z,
      speed: 0,
    },
    contact: { key: firstCollision.body.key, kind: firstCollision.body.kind },
  }
}

export function selectActiveCelestialBody(
  system: GitHubSystem,
  flight: FlightState,
  elapsedSeconds: number,
): ActiveCelestialBody | null {
  const candidates: ActiveCelestialBody[] = []
  const starDistance = distanceFromShip(flight, { x: 0, y: 0, z: 0 })

  if (starDistance <= informationZoneRadius(STAR_RADIUS)) {
    candidates.push({
      key: 'star',
      kind: 'star',
      surfaceDistance: starDistance - STAR_RADIUS,
    })
  }

  for (const planet of system.planets) {
    const planetDistance = distanceFromShip(flight, planetPosition(planet, elapsedSeconds))
    if (planetDistance <= informationZoneRadius(planet.radius)) {
      candidates.push({
        key: `planet:${planet.repository.id}`,
        kind: 'planet',
        planet,
        surfaceDistance: planetDistance - planet.radius,
      })
    }
  }

  return (
    candidates.sort((left, right) => {
      const distanceDifference = left.surfaceDistance - right.surfaceDistance
      if (distanceDifference !== 0) return distanceDifference

      const leftRelevance = left.kind === 'planet' ? left.planet.relevanceScore : 0
      const rightRelevance = right.kind === 'planet' ? right.planet.relevanceScore : 0
      if (leftRelevance !== rightRelevance) return rightRelevance - leftRelevance

      return left.key.localeCompare(right.key)
    })[0] ?? null
  )
}
