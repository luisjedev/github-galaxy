import type {
  PlanetAppearance,
  PlanetDescriptor,
  PlanetSurfaceFeature,
} from './github-system'

export type VisualQuality = 'normal' | 'reduced'
export type Vector3Tuple = [number, number, number]

export interface VisualCapabilities {
  hardwareConcurrency?: number
  devicePixelRatio?: number
  softwareRenderer?: boolean
}

export interface StarVisualPoint {
  position: Vector3Tuple
  size: number
  opacity: number
  hue: number
  layer: 0 | 1 | 2
  twinklePhase: number
}

export interface DustVisualPoint {
  position: Vector3Tuple
  size: number
  speed: number
  hue: number
}

export interface NebulaVisual {
  position: Vector3Tuple
  scale: Vector3Tuple
  rotation: number
  hue: number
  secondaryHue: number
  opacity: number
  noiseSeed: number
}

export interface SpaceVisual {
  stars: StarVisualPoint[]
  dust: DustVisualPoint[]
  nebulas: NebulaVisual[]
}

export type SurfaceFormationKind =
  | 'band'
  | 'crater'
  | 'dune'
  | 'crystal'
  | 'island'
  | 'ridge'

export interface SurfaceFormation {
  kind: SurfaceFormationKind
  position: Vector3Tuple
  scale: Vector3Tuple
  accentMix: number
}

export interface PlanetSurfaceSample {
  direction: Vector3Tuple
  hue: number
  saturation: number
  lightness: number
  accentMix: number
}

export interface AtmosphereVisual {
  hue: number
  opacity: number
  scale: number
}

export interface PlanetVisual {
  radius: number
  surfaceSamples: PlanetSurfaceSample[]
  formations: SurfaceFormation[]
  atmosphere: AtmosphereVisual | null
  cloudLayer: boolean
  emissiveStrength: number
}

const UINT32_MAX = 0x1_0000_0000
const FULL_TURN = Math.PI * 2

export function deterministicUnit(seed: number, index: number, salt = 0): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
  return ((value ^ (value >>> 16)) >>> 0) / UINT32_MAX
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_MAX
  }
}

function range(random: () => number, minimum: number, maximum: number): number {
  return minimum + random() * (maximum - minimum)
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalize([x, y, z]: Vector3Tuple): Vector3Tuple {
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

function randomDirection(random: () => number): Vector3Tuple {
  const y = range(random, -1, 1)
  const angle = range(random, 0, FULL_TURN)
  const horizontal = Math.sqrt(Math.max(0, 1 - y * y))
  return [Math.cos(angle) * horizontal, y, Math.sin(angle) * horizontal]
}

function scaleVector(vector: Vector3Tuple, scale: number): Vector3Tuple {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale]
}

function round(value: number): number {
  return Number(value.toFixed(6))
}

function roundedVector(vector: Vector3Tuple): Vector3Tuple {
  return [round(vector[0]), round(vector[1]), round(vector[2])]
}

function wrappedHue(hue: number): number {
  return ((hue % 360) + 360) % 360
}

export function selectVisualQuality(capabilities: VisualCapabilities): VisualQuality {
  const cores = capabilities.hardwareConcurrency ?? 4
  const dpr = capabilities.devicePixelRatio ?? 1
  return capabilities.softwareRenderer || cores <= 4 || dpr > 2 ? 'reduced' : 'normal'
}

function generateStars(seed: number, quality: VisualQuality): StarVisualPoint[] {
  const count = quality === 'normal' ? 960 : 240
  const random = mulberry32(seed ^ 0xa341316c)
  const clusterRandom = mulberry32(seed ^ 0xc8013ea4)
  const clusters = Array.from({ length: 7 }, () => randomDirection(clusterRandom))
  const temperatures = [28, 42, 190, 208, 222, 258]

  return Array.from({ length: count }, (_, index) => {
    const layer = Math.min(2, Math.floor((index / count) * 3)) as 0 | 1 | 2
    const direction = randomDirection(random)
    const clustered = random() < 0.44
    const cluster = clusters[Math.floor(random() * clusters.length)]
    const clusterStrength = clustered ? range(random, 0.28, 0.58) : 0
    const finalDirection = normalize([
      direction[0] * (1 - clusterStrength) + cluster[0] * clusterStrength,
      direction[1] * (1 - clusterStrength) + cluster[1] * clusterStrength,
      direction[2] * (1 - clusterStrength) + cluster[2] * clusterStrength,
    ])
    const minimumDistance = [72, 96, 120][layer]
    const maximumDistance = [94, 116, 142][layer]
    const distance = range(random, minimumDistance, maximumDistance)
    const baseHue = temperatures[Math.floor(random() * temperatures.length)]

    return {
      position: roundedVector(scaleVector(finalDirection, distance)),
      size: round(range(random, 0.08, 0.34 - layer * 0.025)),
      opacity: round(range(random, 0.32, 0.95)),
      hue: round(wrappedHue(baseHue + range(random, -7, 7))),
      layer,
      twinklePhase: round(range(random, 0, FULL_TURN)),
    }
  })
}

function generateDust(seed: number, quality: VisualQuality): DustVisualPoint[] {
  const count = quality === 'normal' ? 120 : 32
  const random = mulberry32(seed ^ 0xad90777d)

  return Array.from({ length: count }, () => ({
    position: [
      round(range(random, -8, 8)),
      round(range(random, -4.5, 4.5)),
      round(range(random, -22, 8)),
    ],
    size: round(range(random, 0.018, 0.065)),
    speed: round(range(random, 0.7, 1.5)),
    hue: round(range(random, 178, 225)),
  }))
}

function generateNebulas(seed: number, quality: VisualQuality): NebulaVisual[] {
  const count = quality === 'reduced' ? 2 : 2 + (seed % 3)
  const random = mulberry32(seed ^ 0x7e95761e)

  return Array.from({ length: count }, (_, index) => {
    const anchorAngle = ((index === 0 ? -38 : 38) + range(random, -5, 5)) * (Math.PI / 180)
    const direction = index < 2
      ? normalize([Math.sin(anchorAngle), range(random, -0.12, 0.12), Math.cos(anchorAngle)])
      : randomDirection(random)
    const width = range(random, index < 2 ? 26 : 16, 38)
    return {
      position: roundedVector(scaleVector(direction, range(random, 58, 90))),
      scale: [round(width), round(width * range(random, 0.42, 0.74)), 1],
      rotation: round(range(random, 0, FULL_TURN)),
      hue: round(range(random, 178, 315)),
      secondaryHue: round(range(random, 8, 72)),
      opacity: round(range(random, 0.08, 0.2)),
      noiseSeed: Math.floor(random() * UINT32_MAX),
    }
  })
}

export function generateSpaceVisual(seed: number, quality: VisualQuality): SpaceVisual {
  return {
    stars: generateStars(seed, quality),
    dust: generateDust(seed, quality),
    nebulas: generateNebulas(seed, quality),
  }
}

function fract(value: number): number {
  return value - Math.floor(value)
}

function spatialNoise(
  seed: number,
  [x, y, z]: Vector3Tuple,
  salt: number,
): number {
  return fract(
    Math.sin(
      x * 127.1 + y * 311.7 + z * 74.7 + (seed % 104_729) * 0.013 + salt * 19.19,
    ) * 43_758.5453,
  )
}

function featureAccent(
  feature: PlanetSurfaceFeature,
  seed: number,
  direction: Vector3Tuple,
): number {
  const [x, y, z] = direction
  const noise = spatialNoise(seed, direction, 1)

  switch (feature) {
    case 'bands':
      return clamp(0.5 + Math.sin((y * 6 + noise * 0.35) * Math.PI) * 0.5)
    case 'craters': {
      const cell = spatialNoise(seed, direction, 4)
      return cell > 0.72 ? clamp((cell - 0.72) * 3.57) : noise * 0.18
    }
    case 'dunes':
      return clamp(0.5 + Math.sin((y * 8 + x * 2.4 + noise * 0.45) * Math.PI) * 0.5)
    case 'facets':
      return clamp(noise * 0.82 + spatialNoise(seed, direction, 8) * 0.18)
    case 'islands':
      return clamp(
        (Math.sin(x * 5 + noise) + Math.cos(z * 4 - y * 2) + 1.05) / 3.05,
      )
    case 'ridges': {
      const ridge = Math.abs(Math.sin(Math.atan2(z, x) * 5 + y * 8 + noise * 0.8))
      return clamp(Math.pow(ridge, 5))
    }
  }
}

export function samplePlanetSurface(
  appearance: PlanetAppearance,
  direction: Vector3Tuple,
): PlanetSurfaceSample {
  const normalizedDirection = normalize(direction)
  const accentMix = featureAccent(
    appearance.surfaceFeature,
    appearance.surfaceSeed,
    normalizedDirection,
  )
  const variation = spatialNoise(appearance.surfaceSeed, normalizedDirection, 12) - 0.5
  const hueDelta = appearance.accentHue - appearance.baseHue
  const shortestHueDelta = ((hueDelta + 540) % 360) - 180
  const archivedFactor = appearance.state === 'archived' ? 0.34 : 1

  return {
    direction: roundedVector(normalizedDirection),
    hue: round(wrappedHue(appearance.baseHue + shortestHueDelta * accentMix * 0.72)),
    saturation: round(clamp((appearance.saturation + variation * 16) / 100) * 100 * archivedFactor),
    lightness: round(clamp((appearance.lightness + variation * 18 + accentMix * 9) / 100) * 100),
    accentMix: round(accentMix),
  }
}

function fibonacciDirection(index: number, count: number): Vector3Tuple {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const y = 1 - ((index + 0.5) / count) * 2
  const radius = Math.sqrt(Math.max(0, 1 - y * y))
  const angle = goldenAngle * index
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius]
}

const formationKindByFeature: Record<PlanetSurfaceFeature, SurfaceFormationKind> = {
  bands: 'band',
  craters: 'crater',
  dunes: 'dune',
  facets: 'crystal',
  islands: 'island',
  ridges: 'ridge',
}

function formationScale(
  feature: PlanetSurfaceFeature,
  radius: number,
  random: () => number,
): Vector3Tuple {
  const unit = radius * range(random, 0.07, 0.16)
  switch (feature) {
    case 'bands':
      return [round(unit * 2.3), round(unit * 0.22), round(unit * 1.4)]
    case 'craters':
      return [round(unit * 1.5), round(unit * 0.18), round(unit * 1.5)]
    case 'dunes':
      return [round(unit * 2.4), round(unit * 0.28), round(unit * 0.7)]
    case 'facets':
      return [round(unit * 0.7), round(unit * 2.1), round(unit * 0.7)]
    case 'islands':
      return [round(unit * 1.8), round(unit * 0.5), round(unit * 1.4)]
    case 'ridges':
      return [round(unit * 0.55), round(unit * 2.5), round(unit * 0.9)]
  }
}

function generateFormations(
  planet: PlanetDescriptor,
  quality: VisualQuality,
): SurfaceFormation[] {
  const { appearance, radius } = planet
  const count = quality === 'normal' ? 10 + (appearance.surfaceSeed % 7) : 5 + (appearance.surfaceSeed % 4)
  const random = mulberry32(appearance.surfaceSeed ^ 0x9e3779b9)

  return Array.from({ length: count }, () => {
    const direction = randomDirection(random)
    const accentMix = featureAccent(appearance.surfaceFeature, appearance.surfaceSeed, direction)
    const lift = appearance.surfaceFeature === 'craters' ? 0.992 : 1.015
    return {
      kind: formationKindByFeature[appearance.surfaceFeature],
      position: roundedVector(scaleVector(direction, radius * lift)),
      scale: formationScale(appearance.surfaceFeature, radius, random),
      accentMix: round(accentMix),
    }
  })
}

export function generatePlanetVisual(
  planet: PlanetDescriptor,
  quality: VisualQuality,
): PlanetVisual {
  const { appearance, radius } = planet
  const atmosphere = appearance.state === 'active'
    ? {
        hue: appearance.biome === 'volcanic' ? appearance.accentHue : wrappedHue(appearance.baseHue + 18),
        opacity: round(0.1 + appearance.luminosity * 0.06),
        scale: round(1.045 + appearance.luminosity * 0.012),
      }
    : null
  return {
    radius,
    surfaceSamples: Array.from({ length: 80 }, (_, index) =>
      samplePlanetSurface(appearance, fibonacciDirection(index, 80)),
    ),
    formations: generateFormations(planet, quality),
    atmosphere,
    cloudLayer:
      appearance.state === 'active' &&
      ['aurora', 'oceanic', 'verdant'].includes(appearance.biome),
    emissiveStrength:
      appearance.state === 'archived'
        ? 0.04
        : appearance.state === 'neutral'
          ? 0.06
          : round(appearance.luminosity * (appearance.biome === 'volcanic' ? 0.38 : 0.15)),
  }
}
