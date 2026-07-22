import type { FlightState } from './flight'
import {
  FULL_ROTATION_RADIANS,
  type GitHubSystem,
  type PlanetDescriptor,
} from './github-system'

export const STAR_RADIUS = 4
export const CELESTIAL_ATMOSPHERE_CLEARANCE = 2
export const INFORMATION_ZONE_CLEARANCE = 6

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
