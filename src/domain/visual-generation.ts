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

export interface DistantGalaxyVisual {
  kind: 'spiral' | 'elliptical'
  position: Vector3Tuple
  scale: Vector3Tuple
  rotation: number
  hue: number
  coreHue: number
  opacity: number
  armCount: number
  noiseSeed: number
}

export interface SpaceVisual {
  stars: StarVisualPoint[]
  dust: DustVisualPoint[]
  nebulas: NebulaVisual[]
  galaxies: DistantGalaxyVisual[]
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

export interface PlanetSurfaceDescriptor {
  orientation: Vector3Tuple
  regionScale: number
  detailScale: number
  detailOctaves: 1 | 2
  regionThreshold: number
  reliefAmplitude: number
  forkNetworkStrength: number
  secondaryTrait: PlanetSecondaryTrait
}

export interface PlanetSurfaceSample {
  direction: Vector3Tuple
  hue: number
  saturation: number
  lightness: number
  accentMix: number
  regionMix: number
  detailMix: number
  elevation: number
}

export interface PlanetMetricSignals {
  stars: number
  forks: number
  size: number
  activity: number
}

export type PlanetSecondaryTrait =
  | 'caps'
  | 'canyons'
  | 'crater-field'
  | 'mineral-veins'
  | 'night-lights'
  | 'plates'
  | 'storm-bands'

export interface SurfacePatch {
  direction: Vector3Tuple
  scale: number
  intensity: number
}

export interface DynamicLayerVisual {
  kind: 'aurora' | 'clouds' | 'thermal-clouds'
  opacity: number
  rotationSpeed: number
  patches: SurfacePatch[]
}

export interface EmissiveVisual {
  kind: 'aurora' | 'lava' | 'lights' | 'mineral' | 'none'
  hue: number
  intensity: number
  patches: SurfacePatch[]
}

export interface AtmosphereVisual {
  hue: number
  opacity: number
  scale: number
}

export interface PlanetVisual {
  radius: number
  surface: PlanetSurfaceDescriptor
  surfaceSamples: PlanetSurfaceSample[]
  formations: SurfaceFormation[]
  atmosphere: AtmosphereVisual | null
  cloudLayer: boolean
  dynamicLayer: DynamicLayerVisual | null
  emissive: EmissiveVisual
  emissiveStrength: number
  metricSignals: PlanetMetricSignals
  forkNetworkStrength: number
  secondaryTrait: PlanetSecondaryTrait
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

function generateDistantGalaxies(
  seed: number,
  quality: VisualQuality,
): DistantGalaxyVisual[] {
  const count = quality === 'reduced' ? 2 : 3 + ((seed >>> 0) % 4)
  const random = mulberry32(seed ^ 0x6c8e9cf5)

  return Array.from({ length: count }, (_, index) => {
    const anchorAngle = ((index === 0 ? -24 : 27) + range(random, -7, 7)) * (Math.PI / 180)
    const direction = index < 2
      ? normalize([
          Math.sin(anchorAngle),
          range(random, index === 0 ? 0.1 : -0.3, index === 0 ? 0.34 : -0.08),
          Math.cos(anchorAngle),
        ])
      : randomDirection(random)
    const kind = random() < 0.72 ? 'spiral' : 'elliptical'
    const width = range(random, kind === 'spiral' ? 10 : 7, kind === 'spiral' ? 20 : 14)

    return {
      kind,
      position: roundedVector(scaleVector(direction, range(random, 104, 134))),
      scale: [round(width), round(width * range(random, 0.28, 0.58)), 1],
      rotation: round(range(random, 0, FULL_TURN)),
      hue: round(range(random, 188, 282)),
      coreHue: round(range(random, 28, 58)),
      opacity: round(range(random, 0.24, 0.48)),
      armCount: 2 + Math.floor(random() * 3),
      noiseSeed: Math.floor(random() * UINT32_MAX),
    }
  })
}

export function generateSpaceVisual(seed: number, quality: VisualQuality): SpaceVisual {
  return {
    stars: generateStars(seed, quality),
    dust: generateDust(seed, quality),
    nebulas: generateNebulas(seed, quality),
    galaxies: generateDistantGalaxies(seed, quality),
  }
}

function seededAxis(seed: number, salt: number): Vector3Tuple {
  const random = mulberry32(seed ^ Math.imul(salt + 1, 0x9e3779b9))
  return randomDirection(random)
}

function dot(left: Vector3Tuple, right: Vector3Tuple): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
}

// Directional waves are continuous on the sphere, unlike UV noise: there is no
// longitude seam and the poles receive the same sampling density as every face.
function sphericalWave(
  seed: number,
  direction: Vector3Tuple,
  scale: number,
  salt: number,
): number {
  const first = seededAxis(seed, salt)
  const second = seededAxis(seed, salt + 17)
  const phase = deterministicUnit(seed, salt, 31) * FULL_TURN
  const value =
    Math.sin(dot(direction, first) * scale * Math.PI + phase) * 0.62 +
    Math.cos(dot(direction, second) * scale * Math.PI * 0.73 - phase * 0.7) * 0.38
  return clamp(value * 0.5 + 0.5)
}

function defaultSurfaceDescriptor(appearance: PlanetAppearance): PlanetSurfaceDescriptor {
  return {
    orientation: roundedVector(seededAxis(appearance.surfaceSeed, 3)),
    regionScale: round(2.2 + deterministicUnit(appearance.surfaceSeed, 2) * 1.4),
    detailScale: round(7 + deterministicUnit(appearance.surfaceSeed, 4) * 3),
    detailOctaves: 2,
    regionThreshold: round(0.38 + deterministicUnit(appearance.surfaceSeed, 6) * 0.2),
    reliefAmplitude: 0.018,
    forkNetworkStrength: 0,
    secondaryTrait: selectSecondaryTrait(appearance),
  }
}

function featureAccent(
  feature: PlanetSurfaceFeature,
  seed: number,
  direction: Vector3Tuple,
  surface: PlanetSurfaceDescriptor,
): number {
  const [x, y, z] = direction
  const oriented = dot(direction, surface.orientation)
  const primaryDetail = sphericalWave(seed, direction, surface.detailScale, 41)
  const detail = surface.detailOctaves === 2
    ? primaryDetail * 0.74 +
      sphericalWave(seed, direction, surface.detailScale * 1.86, 47) * 0.26
    : primaryDetail

  switch (feature) {
    case 'bands':
      return clamp(0.5 + Math.sin((oriented * 5.2 + detail * 0.42) * Math.PI) * 0.5)
    case 'craters': {
      const cell = sphericalWave(seed, direction, surface.detailScale * 0.72, 53)
      return cell > 0.7 ? clamp((cell - 0.7) / 0.3) : detail * 0.14
    }
    case 'dunes':
      return clamp(0.5 + Math.sin((oriented * 7 + dot(direction, seededAxis(seed, 8)) * 2 + detail * 0.35) * Math.PI) * 0.5)
    case 'facets':
      return clamp(detail * 0.7 + sphericalWave(seed, direction, surface.detailScale * 0.55, 67) * 0.3)
    case 'islands':
      return clamp((sphericalWave(seed, direction, surface.regionScale * 1.3, 71) - 0.34) / 0.52)
    case 'ridges': {
      const ridge = Math.abs(Math.sin((x * 2.7 + y * 4.1 + z * 3.3 + detail * 0.6) * Math.PI))
      return clamp(Math.pow(ridge, 4))
    }
  }
}

export function samplePlanetSurface(
  appearance: PlanetAppearance,
  direction: Vector3Tuple,
  descriptor: PlanetSurfaceDescriptor = defaultSurfaceDescriptor(appearance),
): PlanetSurfaceSample {
  const normalizedDirection = normalize(direction)
  const broadNoise = sphericalWave(
    appearance.surfaceSeed,
    normalizedDirection,
    descriptor.regionScale,
    11,
  )
  const regionMix = clamp((broadNoise - descriptor.regionThreshold) / 0.28)
  const featureMix = featureAccent(
    appearance.surfaceFeature,
    appearance.surfaceSeed,
    normalizedDirection,
    descriptor,
  )
  const vein = Math.pow(Math.abs(Math.sin(
    (dot(normalizedDirection, seededAxis(appearance.surfaceSeed, 91)) * 5.4 +
      dot(normalizedDirection, seededAxis(appearance.surfaceSeed, 97)) * 3.1) * Math.PI,
  )), 9) * descriptor.forkNetworkStrength
  const traitWave = sphericalWave(
    appearance.surfaceSeed,
    normalizedDirection,
    descriptor.detailScale * 0.64,
    109,
  )
  const traitMix = descriptor.secondaryTrait === 'caps'
    ? clamp((Math.abs(dot(normalizedDirection, descriptor.orientation)) - 0.58) / 0.3)
    : descriptor.secondaryTrait === 'canyons'
      ? 1 - Math.pow(Math.abs(traitWave * 2 - 1), 0.28)
      : descriptor.secondaryTrait === 'crater-field'
        ? traitWave > 0.76 ? (traitWave - 0.76) / 0.24 : 0
        : descriptor.secondaryTrait === 'mineral-veins'
          ? Math.pow(Math.abs(Math.sin(traitWave * Math.PI * 3)), 8)
          : descriptor.secondaryTrait === 'plates'
            ? Math.round(traitWave * 4) / 4
            : descriptor.secondaryTrait === 'storm-bands'
              ? 0.5 + Math.sin(
                  dot(normalizedDirection, descriptor.orientation) * Math.PI * 9,
                ) * 0.5
              : traitWave
  const detailMix = clamp(
    featureMix * (0.82 - descriptor.forkNetworkStrength * 0.2) +
    traitMix * 0.18 +
    vein,
  )
  const accentMix = clamp(regionMix * 0.72 + detailMix * 0.28)
  const hueDelta = ((appearance.accentHue - appearance.baseHue + 540) % 360) - 180
  const archivedFactor = appearance.state === 'archived' ? 0.34 : 1
  const reliefShape = clamp(regionMix * 0.68 + detailMix * 0.32)
  const elevation = (reliefShape * 2 - 1) * descriptor.reliefAmplitude

  return {
    direction: roundedVector(normalizedDirection),
    hue: round(wrappedHue(appearance.baseHue + hueDelta * accentMix * 0.76)),
    saturation: round(clamp((appearance.saturation + (detailMix - 0.5) * 14) / 100) * 100 * archivedFactor),
    lightness: round(clamp((appearance.lightness + (regionMix - 0.5) * 16 + detailMix * 7) / 100) * 100),
    accentMix: round(accentMix),
    regionMix: round(regionMix),
    detailMix: round(detailMix),
    elevation: round(elevation),
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

function boundedLog(value: number, reference: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return round(clamp(Math.log1p(value) / Math.log1p(reference)))
}

function metricSignals(planet: PlanetDescriptor): PlanetMetricSignals {
  const timestamp = Date.parse(planet.repository.updated_at)
  const start = Date.UTC(2008, 0, 1)
  const end = Date.UTC(2030, 0, 1)
  return {
    stars: boundedLog(planet.repository.stargazers_count, 1_000),
    forks: boundedLog(planet.repository.forks_count, 120),
    size: boundedLog(planet.repository.size, 900_000),
    activity: Number.isFinite(timestamp) ? round(clamp((timestamp - start) / (end - start))) : 0,
  }
}

function surfaceDescriptor(
  planet: PlanetDescriptor,
  quality: VisualQuality,
  signals: PlanetMetricSignals,
): PlanetSurfaceDescriptor {
  const { appearance } = planet
  const reliefByFeature: Record<PlanetSurfaceFeature, number> = {
    bands: 0.012,
    craters: 0.022,
    dunes: 0.018,
    facets: 0.028,
    islands: 0.02,
    ridges: 0.032,
  }
  return {
    orientation: roundedVector(seededAxis(appearance.surfaceSeed, 3)),
    regionScale: round(1.4 + deterministicUnit(appearance.surfaceSeed, 2) * 2.2 + signals.size * 1.2),
    detailScale: round(6.2 + deterministicUnit(appearance.surfaceSeed, 4) * 4 + signals.size * 2.2),
    detailOctaves: quality === 'normal' ? 2 : 1,
    regionThreshold: round(0.34 + deterministicUnit(appearance.surfaceSeed, 6) * 0.24),
    reliefAmplitude: round(Math.min(0.04, reliefByFeature[appearance.surfaceFeature] + signals.size * 0.006)),
    forkNetworkStrength: planet.repository.forks_count <= 0 ? 0 : round(signals.forks * 0.8),
    secondaryTrait: selectSecondaryTrait(appearance),
  }
}

const traitsByBiome: Record<PlanetAppearance['biome'], PlanetSecondaryTrait[]> = {
  aurora: ['storm-bands', 'caps', 'night-lights'],
  crystalline: ['mineral-veins', 'plates', 'caps'],
  desert: ['canyons', 'plates', 'crater-field'],
  oceanic: ['caps', 'storm-bands', 'night-lights'],
  verdant: ['night-lights', 'storm-bands', 'caps'],
  volcanic: ['canyons', 'plates', 'crater-field'],
  rocky: ['crater-field', 'mineral-veins', 'canyons'],
  dead: ['crater-field', 'canyons', 'plates'],
}

function selectSecondaryTrait(appearance: PlanetAppearance): PlanetSecondaryTrait {
  const traits = traitsByBiome[appearance.biome]
  return traits[appearance.surfaceSeed % traits.length]
}

function generateFormations(
  planet: PlanetDescriptor,
  quality: VisualQuality,
  surface: PlanetSurfaceDescriptor,
  signals: PlanetMetricSignals,
): SurfaceFormation[] {
  const { appearance, radius } = planet
  const normalCount = Math.min(18, 9 + Math.floor(signals.size * 4) + (appearance.surfaceSeed % 5))
  const count = quality === 'normal' ? normalCount : Math.max(4, Math.floor(normalCount * 0.48))
  const random = mulberry32(appearance.surfaceSeed ^ 0x9e3779b9)

  return Array.from({ length: count }, () => {
    // Pick the most coherent candidate instead of sticking an object at the
    // first random point. Formations therefore collect along their regions.
    let direction = randomDirection(random)
    let surfaceSample = samplePlanetSurface(appearance, direction, surface)
    let accentMix = surfaceSample.accentMix
    for (let candidateIndex = 0; candidateIndex < 3; candidateIndex += 1) {
      const candidate = randomDirection(random)
      const candidateSample = samplePlanetSurface(appearance, candidate, surface)
      if (candidateSample.accentMix > accentMix) {
        direction = candidate
        surfaceSample = candidateSample
        accentMix = candidateSample.accentMix
      }
    }
    const inset = appearance.surfaceFeature === 'craters' ? -0.008 : Math.max(0.004, surfaceSample.elevation * 0.55)
    return {
      kind: formationKindByFeature[appearance.surfaceFeature],
      position: roundedVector(scaleVector(direction, radius * (1 + inset))),
      scale: formationScale(appearance.surfaceFeature, radius, random),
      accentMix: round(accentMix),
    }
  })
}

function generatePatches(seed: number, count: number, salt: number): SurfacePatch[] {
  const random = mulberry32(seed ^ salt)
  return Array.from({ length: count }, () => ({
    direction: roundedVector(randomDirection(random)),
    scale: round(range(random, 0.08, 0.22)),
    intensity: round(range(random, 0.42, 1)),
  }))
}

function generateSurfacePatches(
  appearance: PlanetAppearance,
  surface: PlanetSurfaceDescriptor,
  count: number,
  salt: number,
): SurfacePatch[] {
  const random = mulberry32(appearance.surfaceSeed ^ salt)
  return Array.from({ length: count }, () => {
    let direction = randomDirection(random)
    let intensity = samplePlanetSurface(appearance, direction, surface).accentMix
    for (let candidateIndex = 0; candidateIndex < 3; candidateIndex += 1) {
      const candidate = randomDirection(random)
      const candidateIntensity = samplePlanetSurface(appearance, candidate, surface).accentMix
      if (candidateIntensity > intensity) {
        direction = candidate
        intensity = candidateIntensity
      }
    }
    return {
      direction: roundedVector(direction),
      scale: round(range(random, 0.08, 0.18)),
      intensity: round(0.42 + intensity * 0.58),
    }
  })
}

function dynamicLayer(
  planet: PlanetDescriptor,
  quality: VisualQuality,
  signals: PlanetMetricSignals,
): DynamicLayerVisual | null {
  const { appearance } = planet
  if (appearance.state !== 'active') return null
  const seeded = deterministicUnit(appearance.surfaceSeed, 21)
  let kind: DynamicLayerVisual['kind'] | null = null
  if (appearance.biome === 'aurora') kind = 'aurora'
  else if (appearance.biome === 'volcanic' && (signals.activity > 0.7 || seeded > 0.62)) kind = 'thermal-clouds'
  else if (['oceanic', 'verdant'].includes(appearance.biome) && seeded > 0.28) kind = 'clouds'
  if (!kind) return null

  const normalCount = 7 + Math.floor(signals.activity * 5)
  return {
    kind,
    opacity: round(Math.min(0.24, 0.09 + signals.activity * 0.1)),
    rotationSpeed: round(0.006 + signals.activity * 0.012),
    patches: generatePatches(
      appearance.surfaceSeed,
      quality === 'normal' ? normalCount : Math.max(2, Math.floor(normalCount * 0.42)),
      0x4c11db7,
    ),
  }
}

function emissiveVisual(
  planet: PlanetDescriptor,
  quality: VisualQuality,
  signals: PlanetMetricSignals,
  surface: PlanetSurfaceDescriptor,
): EmissiveVisual {
  const { appearance } = planet
  if (appearance.state !== 'active') {
    return { kind: 'none', hue: appearance.accentHue, intensity: 0, patches: [] }
  }
  const kind: EmissiveVisual['kind'] = appearance.biome === 'volcanic'
    ? 'lava'
    : appearance.biome === 'aurora'
      ? 'aurora'
      : appearance.biome === 'crystalline'
        ? 'mineral'
        : signals.stars >= 0.28
          ? 'lights'
          : 'none'
  if (kind === 'none') return { kind, hue: appearance.accentHue, intensity: 0, patches: [] }
  const normalCount = 3 + Math.floor(signals.stars * 7 + signals.forks * 3)
  return {
    kind,
    hue: appearance.accentHue,
    intensity: round(Math.min(0.65, 0.16 + signals.stars * 0.3 + signals.activity * 0.14)),
    patches: generateSurfacePatches(
      appearance,
      surface,
      quality === 'normal' ? normalCount : Math.max(2, Math.floor(normalCount * 0.5)),
      0x2c9277b5,
    ),
  }
}

export function generatePlanetVisual(
  planet: PlanetDescriptor,
  quality: VisualQuality,
): PlanetVisual {
  const { appearance, radius } = planet
  const signals = metricSignals(planet)
  const surface = surfaceDescriptor(planet, quality, signals)
  const layer = dynamicLayer(planet, quality, signals)
  const emissive = emissiveVisual(planet, quality, signals, surface)
  const atmosphere = appearance.state === 'active'
    ? {
        hue: appearance.biome === 'volcanic' ? appearance.accentHue : wrappedHue(appearance.baseHue + 18),
        opacity: round(Math.min(0.2, 0.1 + signals.activity * 0.07)),
        scale: round(1.045 + signals.activity * 0.012),
      }
    : null
  return {
    radius,
    surface,
    surfaceSamples: Array.from({ length: 80 }, (_, index) =>
      samplePlanetSurface(appearance, fibonacciDirection(index, 80), surface),
    ),
    formations: generateFormations(planet, quality, surface, signals),
    atmosphere,
    cloudLayer: layer?.kind === 'clouds',
    dynamicLayer: layer,
    emissive,
    emissiveStrength: appearance.state === 'archived'
      ? 0.04
      : appearance.state === 'neutral'
        ? 0.06
        : round(Math.min(0.36, 0.06 + emissive.intensity * 0.34)),
    metricSignals: signals,
    forkNetworkStrength: surface.forkNetworkStrength,
    secondaryTrait: surface.secondaryTrait,
  }
}
