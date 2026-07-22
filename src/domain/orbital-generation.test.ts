import { describe, expect, test } from 'vitest'
import {
  createGitHubSystem,
  type GitHubProfile,
  type GitHubRepository,
} from './github-system'
import { calculateSystemExitRadius } from './wormhole'
import {
  generatePlanetOrbitalVisual,
  generateSystemOrbitalVisual,
  ORBITAL_DETAIL_LIMITS,
} from './orbital-generation'

const profile: GitHubProfile = {
  id: 15,
  login: 'orbital-pilot',
  name: null,
  avatar_url: 'https://example.com/avatar.png',
  html_url: 'https://github.com/orbital-pilot',
  bio: null,
  followers: 0,
  public_repos: 20,
}

function repository(
  id: number,
  overrides: Partial<GitHubRepository> = {},
): GitHubRepository {
  return {
    id,
    name: `orbital-${id}`,
    html_url: `https://github.com/orbital-pilot/orbital-${id}`,
    description: null,
    fork: false,
    archived: false,
    is_template: false,
    language: 'TypeScript',
    stargazers_count: id,
    forks_count: 0,
    size: 100 + id * 1_000,
    updated_at: `2025-01-${String(Math.min(id, 28)).padStart(2, '0')}T00:00:00Z`,
    ...overrides,
  }
}

function expectFiniteTree(value: unknown): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value)).toBe(true)
    return
  }
  if (Array.isArray(value)) {
    value.forEach(expectFiniteTree)
    return
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(expectFiniteTree)
  }
}

describe('detalles orbitales planetarios', () => {
  test('genera lunas, anillos y objetos artificiales deterministas sin solapamientos inválidos', () => {
    const planets = createGitHubSystem(profile, [
      repository(1),
      repository(2, { is_template: true }),
    ]).planets

    for (const quality of ['normal', 'reduced'] as const) {
      for (const planet of planets) {
        const first = generatePlanetOrbitalVisual(planet, quality)
        const second = generatePlanetOrbitalVisual(planet, quality)

        expect(second).toEqual(first)
        expectFiniteTree(first)
        expect(first.moons.length).toBeGreaterThanOrEqual(1)
        expect(first.moons.length).toBeLessThanOrEqual(ORBITAL_DETAIL_LIMITS[quality].moonsPerPlanet)
        expect(first.artificialObjects.length).toBeLessThanOrEqual(
          ORBITAL_DETAIL_LIMITS[quality].artificialObjectsPerPlanet,
        )
        if (planet.appearance.hasRing) expect(first.ring).not.toBeNull()

        const ringOuterRadius = first.ring?.outerRadius ?? planet.radius
        let previousMoonOuterRadius = ringOuterRadius
        for (const moon of first.moons) {
          expect(moon.radius).toBeGreaterThanOrEqual(planet.radius * 0.09)
          expect(moon.radius).toBeLessThanOrEqual(planet.radius * 0.22)
          expect(moon.orbitRadius - moon.radius).toBeGreaterThan(previousMoonOuterRadius)
          expect(Math.abs(moon.inclination)).toBeLessThanOrEqual(0.72)
          expect(Math.abs(moon.orbitSpeed)).toBeGreaterThanOrEqual(0.08)
          expect(Math.abs(moon.orbitSpeed)).toBeLessThanOrEqual(0.32)
          previousMoonOuterRadius = moon.orbitRadius + moon.radius
        }

        let previousArtificialOuterRadius = previousMoonOuterRadius
        for (const object of first.artificialObjects) {
          expect(object.orbitRadius - object.scale).toBeGreaterThan(previousArtificialOuterRadius)
          expect(object.scale).toBeGreaterThanOrEqual(planet.radius * 0.055)
          expect(object.scale).toBeLessThanOrEqual(planet.radius * 0.12)
          expect(Math.abs(object.inclination)).toBeLessThanOrEqual(0.82)
          expect(Math.abs(object.orbitSpeed)).toBeGreaterThanOrEqual(0.1)
          expect(Math.abs(object.orbitSpeed)).toBeLessThanOrEqual(0.28)
          expect(['satellite', 'probe']).toContain(object.kind)
          previousArtificialOuterRadius = object.orbitRadius + object.scale
        }

        if (first.ring) {
          expect(first.ring.innerRadius).toBeGreaterThan(planet.radius)
          expect(first.ring.outerRadius).toBeGreaterThan(first.ring.innerRadius)
          expect(first.ring.outerRadius).toBeLessThanOrEqual(planet.radius * 2.25)
          expect(first.ring.bands.length).toBeGreaterThanOrEqual(2)
          expect(first.ring.bands.length).toBeLessThanOrEqual(5)
          expect(Math.abs(first.ring.inclination)).toBeLessThanOrEqual(0.62)
          expect(first.ring.bands.every((band) =>
            band.opacity >= 0.16 &&
            band.opacity <= 0.68 &&
            band.radius - band.width / 2 > first.ring!.innerRadius &&
            band.radius + band.width / 2 < first.ring!.outerRadius
          )).toBe(true)
        }
      }
    }
  })
})

describe('entorno orbital del sistema', () => {
  test('acota grupos, estrellas fugaces y cinturón en sistemas de cero, uno y veinte planetas', () => {
    const systems = [
      createGitHubSystem(profile, []),
      createGitHubSystem(profile, [repository(1)]),
      createGitHubSystem(
        profile,
        Array.from({ length: 20 }, (_, index) => repository(index + 1)),
      ),
    ]

    for (const quality of ['normal', 'reduced'] as const) {
      for (const system of systems) {
        const first = generateSystemOrbitalVisual(system, quality, 4)
        const second = generateSystemOrbitalVisual(system, quality, 4)
        const furthestSurface = Math.max(
          4,
          ...system.planets.map((planet) => planet.orbitRadius + planet.radius),
        )

        expect(second).toEqual(first)
        expectFiniteTree(first)
        expect(first.planets).toHaveLength(system.planets.length)
        expect(first.innerClusters.length).toBeLessThanOrEqual(
          ORBITAL_DETAIL_LIMITS[quality].innerClusters,
        )
        expect(first.innerClusters.every(
          (cluster) =>
            cluster.rocks.length <= ORBITAL_DETAIL_LIMITS[quality].rocksPerCluster &&
            Math.abs(cluster.driftSpeed) <= 0.018,
        )).toBe(true)
        expect(first.asteroidBelt.rocks).toHaveLength(
          ORBITAL_DETAIL_LIMITS[quality].beltAsteroids,
        )
        expect(first.asteroidBelt.innerRadius).toBeGreaterThan(furthestSurface)
        expect(first.asteroidBelt.outerRadius).toBeGreaterThan(first.asteroidBelt.innerRadius)
        expect(first.asteroidBelt.rotationSpeed).toBeGreaterThanOrEqual(0.0025)
        expect(first.asteroidBelt.rotationSpeed).toBeLessThanOrEqual(0.006)
        expect(first.shootingStars).toHaveLength(
          ORBITAL_DETAIL_LIMITS[quality].shootingStarEvents,
        )

        for (const rock of [
          ...first.innerClusters.flatMap((cluster) => cluster.rocks),
          ...first.asteroidBelt.rocks,
        ]) {
          expect(Math.min(...rock.scale)).toBeGreaterThan(0)
          expect(Math.max(...rock.scale)).toBeLessThanOrEqual(0.8)
        }

        for (const rock of first.asteroidBelt.rocks) {
          const radius = Math.hypot(rock.position[0], rock.position[2])
          expect(radius).toBeGreaterThanOrEqual(first.asteroidBelt.innerRadius - 0.000_01)
          expect(radius).toBeLessThanOrEqual(first.asteroidBelt.outerRadius + 0.000_01)
        }

        for (const event of first.shootingStars) {
          expect(event.duration).toBeGreaterThanOrEqual(0.65)
          expect(event.duration).toBeLessThanOrEqual(1.45)
          expect(event.opacity).toBeGreaterThanOrEqual(0.48)
          expect(event.opacity).toBeLessThanOrEqual(0.88)
          expect(Math.hypot(...event.start)).toBeGreaterThanOrEqual(116)
          expect(Math.hypot(...event.start)).toBeLessThanOrEqual(136.000_01)
        }
        for (let index = 1; index < first.shootingStars.length; index += 1) {
          const previous = first.shootingStars[index - 1]
          expect(first.shootingStars[index].startsAt)
            .toBeGreaterThan(previous.startsAt + previous.duration)
        }
      }
    }

    for (const system of systems) {
      const normalBelt = generateSystemOrbitalVisual(system, 'normal', 4).asteroidBelt
      const reducedBelt = generateSystemOrbitalVisual(system, 'reduced', 4).asteroidBelt
      expect(reducedBelt.outerRadius).toBe(normalBelt.outerRadius)
      expect(calculateSystemExitRadius(normalBelt.outerRadius)).toBeGreaterThan(
        normalBelt.outerRadius,
      )
    }

    const emptyBelt = generateSystemOrbitalVisual(systems[0], 'normal', 4).asteroidBelt
    expect(emptyBelt.innerRadius).toBeGreaterThanOrEqual(12)
    const populated = generateSystemOrbitalVisual(systems[2], 'normal', 4)
    expect(populated.planets.filter((planet) => planet.visual.ring)).not.toHaveLength(0)
    expect(populated.planets.flatMap((planet) => planet.visual.artificialObjects)).not.toHaveLength(0)
    expect(
      generateSystemOrbitalVisual(systems[1], 'normal', 4),
    ).not.toEqual(generateSystemOrbitalVisual({ ...systems[1], starSeed: 99 }, 'normal', 4))
  })
})
