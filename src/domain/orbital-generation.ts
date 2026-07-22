import type { GitHubSystem, PlanetDescriptor } from './github-system'
import type { Vector3Tuple, VisualQuality } from './visual-generation'

export const ORBITAL_DETAIL_LIMITS = {
  normal: {
    moonsPerPlanet: 3,
    artificialObjectsPerPlanet: 2,
    innerClusters: 4,
    rocksPerCluster: 12,
    beltAsteroids: 320,
    shootingStarEvents: 8,
  },
  reduced: {
    moonsPerPlanet: 1,
    artificialObjectsPerPlanet: 1,
    innerClusters: 2,
    rocksPerCluster: 6,
    beltAsteroids: 96,
    shootingStarEvents: 0,
  },
} as const

export interface MoonVisual {
  radius: number
  orbitRadius: number
  inclination: number
  ascendingNode: number
  initialPhase: number
  orbitSpeed: number
  rotationSpeed: number
  hue: number
  saturation: number
  lightness: number
  detail: 0 | 1
}

export interface RingBandVisual {
  radius: number
  width: number
  opacity: number
  hue: number
}

export interface PlanetaryRingVisual {
  innerRadius: number
  outerRadius: number
  inclination: number
  ascendingNode: number
  bands: RingBandVisual[]
}

export type ArtificialObjectKind = 'satellite' | 'probe'

export interface ArtificialObjectVisual {
  kind: ArtificialObjectKind
  orbitRadius: number
  inclination: number
  ascendingNode: number
  initialPhase: number
  orbitSpeed: number
  rotationSpeed: number
  scale: number
  hue: number
  signalHue: number
}

export interface PlanetOrbitalVisual {
  moons: MoonVisual[]
  ring: PlanetaryRingVisual | null
  artificialObjects: ArtificialObjectVisual[]
}

const UINT32_RANGE = 0x1_0000_0000
const FULL_TURN = Math.PI * 2

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE
  }
}

function range(random: () => number, minimum: number, maximum: number): number {
  return minimum + random() * (maximum - minimum)
}

function round(value: number): number {
  return Number(value.toFixed(6))
}

function generateRing(
  planet: PlanetDescriptor,
  quality: VisualQuality,
  random: () => number,
): PlanetaryRingVisual | null {
  const hasSeededRing = random() < 0.36
  if (!planet.appearance.hasRing && !hasSeededRing) return null

  const innerRadius = planet.radius * range(random, 1.25, 1.38)
  const outerRadius = planet.radius * range(random, 1.78, 2.22)
  const maximumBands = quality === 'normal' ? 5 : 3
  const bandCount = 2 + Math.floor(random() * (maximumBands - 1))
  const availableWidth = outerRadius - innerRadius
  const bands = Array.from({ length: bandCount }, (_, index) => {
    const bandCenter = innerRadius + availableWidth * ((index + 0.5) / bandCount)
    const width = availableWidth / bandCount * range(random, 0.24, 0.58)
    return {
      radius: round(bandCenter + range(random, -width * 0.16, width * 0.16)),
      width: round(width),
      opacity: round(range(random, 0.16, 0.68)),
      hue: round((planet.appearance.ringHue + range(random, -24, 24) + 360) % 360),
    }
  })

  return {
    innerRadius: round(innerRadius),
    outerRadius: round(outerRadius),
    inclination: round(range(random, -0.62, 0.62)),
    ascendingNode: round(range(random, 0, FULL_TURN)),
    bands,
  }
}

export function generatePlanetOrbitalVisual(
  planet: PlanetDescriptor,
  quality: VisualQuality,
): PlanetOrbitalVisual {
  const random = mulberry32(planet.appearanceSeed ^ 0x51ed270b)
  const ring = generateRing(planet, quality, random)
  const maximumMoons = ORBITAL_DETAIL_LIMITS[quality].moonsPerPlanet
  const moonCount = quality === 'normal' ? 1 + Math.floor(random() * maximumMoons) : 1
  const moons: MoonVisual[] = []
  let previousOuterRadius = ring?.outerRadius ?? planet.radius

  for (let index = 0; index < moonCount; index += 1) {
    const radius = planet.radius * range(random, 0.09, 0.22)
    const orbitRadius = previousOuterRadius + radius + planet.radius * range(random, 0.38, 0.68)
    moons.push({
      radius: round(radius),
      orbitRadius: round(orbitRadius),
      inclination: round(range(random, -0.72, 0.72)),
      ascendingNode: round(range(random, 0, FULL_TURN)),
      initialPhase: round(range(random, 0, FULL_TURN)),
      orbitSpeed: round(range(random, 0.08, 0.32) * (random() < 0.5 ? -1 : 1)),
      rotationSpeed: round(range(random, -0.42, 0.42)),
      hue: round((planet.appearance.baseHue + range(random, -72, 72) + 360) % 360),
      saturation: round(range(random, 12, 48)),
      lightness: round(range(random, 38, 72)),
      detail: (random() < 0.46 ? 0 : 1) as 0 | 1,
    })
    previousOuterRadius = orbitRadius + radius
  }

  const objectRoll = random()
  const normalObjectCount = objectRoll < 0.36 ? 0 : objectRoll < 0.77 ? 1 : 2
  const objectCount = Math.min(
    normalObjectCount,
    ORBITAL_DETAIL_LIMITS[quality].artificialObjectsPerPlanet,
  )
  const artificialObjects = Array.from({ length: objectCount }, (_, index) => {
    const scale = planet.radius * range(random, 0.055, 0.12)
    const orbitRadius = previousOuterRadius + scale + planet.radius * range(random, 0.32, 0.54)
    previousOuterRadius = orbitRadius + scale
    return {
      kind: (index + Math.floor(random() * 2)) % 2 === 0 ? 'satellite' as const : 'probe' as const,
      orbitRadius: round(orbitRadius),
      inclination: round(range(random, -0.82, 0.82)),
      ascendingNode: round(range(random, 0, FULL_TURN)),
      initialPhase: round(range(random, 0, FULL_TURN)),
      orbitSpeed: round(range(random, 0.1, 0.28) * (random() < 0.5 ? -1 : 1)),
      rotationSpeed: round(range(random, -0.9, 0.9)),
      scale: round(scale),
      hue: round((planet.appearance.accentHue + range(random, -18, 18) + 360) % 360),
      signalHue: round(range(random, 165, 205)),
    }
  })

  return { moons, ring, artificialObjects }
}

export interface RockVisual {
  position: Vector3Tuple
  scale: Vector3Tuple
  rotation: Vector3Tuple
  hue: number
}

export interface InnerRockClusterVisual {
  center: Vector3Tuple
  driftSpeed: number
  rocks: RockVisual[]
}

export interface AsteroidBeltVisual {
  innerRadius: number
  outerRadius: number
  rotationSpeed: number
  rocks: RockVisual[]
}

export interface ShootingStarEventVisual {
  startsAt: number
  duration: number
  start: Vector3Tuple
  end: Vector3Tuple
  hue: number
  opacity: number
}

export interface SystemOrbitalVisual {
  planets: Array<{ repositoryId: number; visual: PlanetOrbitalVisual }>
  innerClusters: InnerRockClusterVisual[]
  asteroidBelt: AsteroidBeltVisual
  shootingStars: ShootingStarEventVisual[]
  shootingStarCycleSeconds: number
}

function roundedVector(vector: Vector3Tuple): Vector3Tuple {
  return [round(vector[0]), round(vector[1]), round(vector[2])]
}

function randomDirection(random: () => number): Vector3Tuple {
  const y = range(random, -1, 1)
  const angle = range(random, 0, FULL_TURN)
  const horizontal = Math.sqrt(Math.max(0, 1 - y * y))
  return [Math.cos(angle) * horizontal, y, Math.sin(angle) * horizontal]
}

function createRock(
  random: () => number,
  position: Vector3Tuple,
  sizeRange: [number, number],
  large = false,
): RockVisual {
  const size = range(random, large ? sizeRange[1] * 1.25 : sizeRange[0], large ? 0.58 : sizeRange[1])
  return {
    position: roundedVector(position),
    scale: roundedVector([
      size * range(random, 0.66, 1.34),
      size * range(random, 0.66, 1.34),
      size * range(random, 0.66, 1.34),
    ]),
    rotation: roundedVector([
      range(random, 0, FULL_TURN),
      range(random, 0, FULL_TURN),
      range(random, 0, FULL_TURN),
    ]),
    hue: round(range(random, 18, 46)),
  }
}

function generateInnerClusters(
  system: GitHubSystem,
  quality: VisualQuality,
  starRadius: number,
  random: () => number,
): InnerRockClusterVisual[] {
  const sortedPlanets = [...system.planets].sort((left, right) => left.orbitRadius - right.orbitRadius)
  if (sortedPlanets.length === 0) return []

  const gaps = sortedPlanets.map((planet, index) => {
    const innerBoundary = index === 0
      ? starRadius + 1.5
      : sortedPlanets[index - 1].orbitRadius + sortedPlanets[index - 1].radius
    const outerBoundary = planet.orbitRadius - planet.radius
    return {
      radius: (innerBoundary + outerBoundary) / 2,
      dispersion: Math.max(0.3, Math.min(0.72, (outerBoundary - innerBoundary) * 0.22)),
    }
  })
  const count = Math.min(ORBITAL_DETAIL_LIMITS[quality].innerClusters, gaps.length)
  const rockCount = ORBITAL_DETAIL_LIMITS[quality].rocksPerCluster

  return Array.from({ length: count }, (_, index) => {
    const gapIndex = Math.min(gaps.length - 1, Math.floor(((index + 0.5) / count) * gaps.length))
    const gap = gaps[gapIndex]
    const angle = range(random, 0, FULL_TURN)
    const center: Vector3Tuple = [
      Math.cos(angle) * gap.radius,
      range(random, -2.8, 2.8),
      Math.sin(angle) * gap.radius,
    ]
    return {
      center: roundedVector(center),
      driftSpeed: round(range(random, -0.018, 0.018)),
      rocks: Array.from({ length: rockCount }, () => {
        const clusterAngle = range(random, 0, FULL_TURN)
        const clusterRadius = gap.dispersion * Math.sqrt(random())
        return createRock(
          random,
          [
            Math.cos(clusterAngle) * clusterRadius,
            range(random, -gap.dispersion * 0.7, gap.dispersion * 0.7),
            Math.sin(clusterAngle) * clusterRadius,
          ],
          [0.09, 0.28],
        )
      }),
    }
  })
}

function generateAsteroidBelt(
  system: GitHubSystem,
  quality: VisualQuality,
  starRadius: number,
  random: () => number,
): AsteroidBeltVisual {
  const furthestSurface = Math.max(
    starRadius,
    ...system.planets.map((planet) => planet.orbitRadius + planet.radius),
  )
  const innerRadius = Math.max(starRadius + 8, furthestSurface + 5)
  const outerRadius = innerRadius + Math.max(4.5, innerRadius * 0.08)
  const count = ORBITAL_DETAIL_LIMITS[quality].beltAsteroids
  const sectorCount = quality === 'normal' ? 19 : 11
  const sectorOffsets = Array.from({ length: sectorCount }, () => range(random, -0.035, 0.035))
  const rocks = Array.from({ length: count }, (_, index) => {
    const baseAngle = (index / count) * FULL_TURN
    const sector = Math.min(sectorCount - 1, Math.floor((index / count) * sectorCount))
    const angle = baseAngle + sectorOffsets[sector] + range(random, -0.018, 0.018)
    const radius = range(random, innerRadius, outerRadius)
    return createRock(
      random,
      [
        Math.cos(angle) * radius,
        range(random, -1.35, 1.35) * (0.45 + random()),
        Math.sin(angle) * radius,
      ],
      [0.08, 0.38],
      index % 29 === 0,
    )
  })

  return {
    innerRadius: round(innerRadius),
    outerRadius: round(outerRadius),
    rotationSpeed: round(range(random, 0.0025, 0.006)),
    rocks,
  }
}

function generateShootingStars(
  quality: VisualQuality,
  random: () => number,
): { events: ShootingStarEventVisual[]; cycleSeconds: number } {
  const count = ORBITAL_DETAIL_LIMITS[quality].shootingStarEvents
  let cursor = range(random, 8, 16)
  const events = Array.from({ length: count }, () => {
    const direction = randomDirection(random)
    const radius = range(random, 116, 136)
    const start: Vector3Tuple = [
      direction[0] * radius,
      direction[1] * radius,
      direction[2] * radius,
    ]
    const tangent: Vector3Tuple = Math.abs(direction[1]) < 0.8
      ? [-direction[2], range(random, -0.35, 0.35), direction[0]]
      : [1, range(random, -0.2, 0.2), 0]
    const tangentLength = Math.hypot(...tangent) || 1
    const trailLength = range(random, 8, 18)
    const duration = range(random, 0.65, 1.45)
    const event: ShootingStarEventVisual = {
      startsAt: round(cursor),
      duration: round(duration),
      start: roundedVector(start),
      end: roundedVector([
        start[0] + tangent[0] / tangentLength * trailLength,
        start[1] + tangent[1] / tangentLength * trailLength,
        start[2] + tangent[2] / tangentLength * trailLength,
      ]),
      hue: round(range(random, 178, 224)),
      opacity: round(range(random, 0.48, 0.88)),
    }
    cursor += duration + range(random, 9, 20)
    return event
  })

  return { events, cycleSeconds: round(cursor + 12) }
}

export function generateSystemOrbitalVisual(
  system: GitHubSystem,
  quality: VisualQuality,
  starRadius: number,
): SystemOrbitalVisual {
  const random = mulberry32(system.starSeed ^ 0xb5297a4d)
  const shootingStars = generateShootingStars(quality, random)
  return {
    planets: system.planets.map((planet) => ({
      repositoryId: planet.repository.id,
      visual: generatePlanetOrbitalVisual(planet, quality),
    })),
    innerClusters: generateInnerClusters(system, quality, starRadius, random),
    asteroidBelt: generateAsteroidBelt(system, quality, starRadius, random),
    shootingStars: shootingStars.events,
    shootingStarCycleSeconds: shootingStars.cycleSeconds,
  }
}
