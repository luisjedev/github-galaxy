export interface GitHubProfile {
  id: number
  login: string
  name: string | null
  avatar_url: string
  html_url: string
  bio: string | null
  followers: number
  public_repos: number
}

export interface GitHubRepository {
  id: number
  name: string
  html_url: string
  description: string | null
  fork: boolean
  archived: boolean
  is_template: boolean
  language: string | null
  stargazers_count: number
  forks_count: number
  size: number
  updated_at: string
}

export type PlanetBiome =
  | 'aurora'
  | 'crystalline'
  | 'desert'
  | 'oceanic'
  | 'verdant'
  | 'volcanic'
  | 'rocky'
  | 'dead'

export type PlanetSurfaceFeature =
  | 'bands'
  | 'craters'
  | 'dunes'
  | 'facets'
  | 'islands'
  | 'ridges'

export interface PlanetAppearance {
  languageFamily: string | null
  biome: PlanetBiome
  state: 'active' | 'neutral' | 'archived'
  surfaceFeature: PlanetSurfaceFeature
  baseHue: number
  accentHue: number
  saturation: number
  lightness: number
  luminosity: number
  hasRing: boolean
  ringHue: number
  surfaceSeed: number
}

export interface PlanetDescriptor {
  repository: GitHubRepository
  relevanceScore: number
  radius: number
  orbitRadius: number
  initialPhase: number
  initialRotation: number
  rotationSpeed: number
  orbitPeriodSeconds: number
  appearanceSeed: number
  appearance: PlanetAppearance
}

export interface StarAppearance {
  languageFamilies: string[]
  technologyHues: number[]
  primaryHue: number
  coronaHue: number
  accentHue: number
  luminosity: number
  flareScale: number
  facetSeed: number
}

export interface GitHubSystem {
  profile: GitHubProfile
  repositories: GitHubRepository[]
  ownRepositoryCount: number
  planets: PlanetDescriptor[]
  starSeed: number
  starAppearance: StarAppearance
}

interface ScoredRepository {
  repository: GitHubRepository
  relevanceScore: number
}

type PlanetSeedTrait =
  | 'phase'
  | 'rotation'
  | 'rotation-speed'
  | 'orbit-speed'
  | 'appearance'

const MIN_PLANET_RADIUS = 0.7
const MAX_PLANET_RADIUS = 2.4
const PLANET_SIZE_CEILING = 999_999
const MAX_PLANETS = 20
const MIN_ORBIT_RADIUS = 8
const SAFE_ORBIT_GAP = 2
export const FULL_ROTATION_RADIANS = Math.PI * 2

export function planetOrbitPhase(planet: PlanetDescriptor, elapsedSeconds: number): number {
  return (
    planet.initialPhase +
    (elapsedSeconds / planet.orbitPeriodSeconds) * FULL_ROTATION_RADIANS
  )
}

export function planetPositionAt(planet: PlanetDescriptor, elapsedSeconds: number) {
  const phase = planetOrbitPhase(planet, elapsedSeconds)
  return {
    x: Math.cos(phase) * planet.orbitRadius,
    y: 0,
    z: -Math.sin(phase) * planet.orbitRadius,
  }
}

interface LanguagePalette {
  biome: Exclude<PlanetBiome, 'rocky' | 'dead'>
  baseHue: number
  accentHue: number
  surfaceFeature: Exclude<PlanetSurfaceFeature, 'craters'>
}

const LANGUAGE_PALETTES: Record<string, LanguagePalette> = {
  typescript: { biome: 'crystalline', baseHue: 215, accentHue: 185, surfaceFeature: 'facets' },
  javascript: { biome: 'desert', baseHue: 50, accentHue: 28, surfaceFeature: 'dunes' },
  python: { biome: 'oceanic', baseHue: 210, accentHue: 48, surfaceFeature: 'bands' },
  rust: { biome: 'volcanic', baseHue: 16, accentHue: 36, surfaceFeature: 'ridges' },
  go: { biome: 'oceanic', baseHue: 187, accentHue: 205, surfaceFeature: 'bands' },
  ruby: { biome: 'volcanic', baseHue: 350, accentHue: 18, surfaceFeature: 'ridges' },
  java: { biome: 'volcanic', baseHue: 24, accentHue: 210, surfaceFeature: 'ridges' },
  'c#': { biome: 'crystalline', baseHue: 274, accentHue: 302, surfaceFeature: 'facets' },
  'c++': { biome: 'crystalline', baseHue: 330, accentHue: 210, surfaceFeature: 'facets' },
  c: { biome: 'crystalline', baseHue: 225, accentHue: 200, surfaceFeature: 'facets' },
  html: { biome: 'desert', baseHue: 14, accentHue: 40, surfaceFeature: 'dunes' },
  css: { biome: 'aurora', baseHue: 225, accentHue: 290, surfaceFeature: 'bands' },
  php: { biome: 'aurora', baseHue: 238, accentHue: 270, surfaceFeature: 'bands' },
  swift: { biome: 'volcanic', baseHue: 12, accentHue: 42, surfaceFeature: 'ridges' },
  kotlin: { biome: 'aurora', baseHue: 268, accentHue: 22, surfaceFeature: 'bands' },
  shell: { biome: 'verdant', baseHue: 132, accentHue: 72, surfaceFeature: 'islands' },
}

const FALLBACK_BIOMES: LanguagePalette[] = [
  { biome: 'aurora', baseHue: 285, accentHue: 185, surfaceFeature: 'bands' },
  { biome: 'crystalline', baseHue: 220, accentHue: 300, surfaceFeature: 'facets' },
  { biome: 'desert', baseHue: 38, accentHue: 12, surfaceFeature: 'dunes' },
  { biome: 'oceanic', baseHue: 195, accentHue: 165, surfaceFeature: 'bands' },
  { biome: 'verdant', baseHue: 125, accentHue: 62, surfaceFeature: 'islands' },
  { biome: 'volcanic', baseHue: 4, accentHue: 32, surfaceFeature: 'ridges' },
]

export function stableSeed(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function planetRadius(size: number): number {
  const boundedSize = Math.min(Math.max(size, 0), PLANET_SIZE_CEILING)
  const scale = Math.log1p(boundedSize) / Math.log1p(PLANET_SIZE_CEILING)
  return Number(
    (MIN_PLANET_RADIUS + scale * (MAX_PLANET_RADIUS - MIN_PLANET_RADIUS)).toFixed(12),
  )
}

function stableSeedParts(...parts: Array<string | number>): number {
  return stableSeed(parts.join(':'))
}

function planetTraitSeed(
  profile: GitHubProfile,
  repository: GitHubRepository,
  trait: PlanetSeedTrait,
): number {
  return stableSeedParts('planet', profile.id, repository.id, trait)
}

function seededRange(
  profile: GitHubProfile,
  repository: GitHubRepository,
  trait: PlanetSeedTrait,
  minimum: number,
  maximum: number,
): number {
  const unit = planetTraitSeed(profile, repository, trait) / 0xffffffff
  return Number((minimum + unit * (maximum - minimum)).toFixed(12))
}

function repositoryUpdatedAt(repository: GitHubRepository): number {
  const timestamp = Date.parse(repository.updated_at)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function compareRepositoriesByRecency(left: GitHubRepository, right: GitHubRepository): number {
  return repositoryUpdatedAt(right) - repositoryUpdatedAt(left) || left.id - right.id
}

function minMaxNormalize(values: number[]): number[] {
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  if (minimum === maximum) return values.map(() => 0)
  return values.map((value) => (value - minimum) / (maximum - minimum))
}

function selectRelevantRepositories(ownRepositories: GitHubRepository[]): ScoredRepository[] {
  const starScores = minMaxNormalize(
    ownRepositories.map((repository) => Math.log1p(repository.stargazers_count)),
  )
  const activityScores = minMaxNormalize(ownRepositories.map(repositoryUpdatedAt))
  const sizeScores = minMaxNormalize(
    ownRepositories.map((repository) => Math.log1p(repository.size)),
  )

  return ownRepositories
    .map((repository, index) => ({
      repository,
      relevanceScore:
        starScores[index] * 0.4 + activityScores[index] * 0.35 + sizeScores[index] * 0.25,
    }))
    .sort(
      (left, right) =>
        right.relevanceScore - left.relevanceScore ||
        compareRepositoriesByRecency(left.repository, right.repository),
    )
    .slice(0, MAX_PLANETS)
}

function normalizedLanguage(language: string | null): string | null {
  const normalized = language?.trim().toLowerCase()
  return normalized || null
}

function languagePalette(languageFamily: string): LanguagePalette {
  const knownPalette = LANGUAGE_PALETTES[languageFamily]
  if (knownPalette) return knownPalette
  return FALLBACK_BIOMES[stableSeed(languageFamily) % FALLBACK_BIOMES.length]
}

function describePlanetAppearance(
  profile: GitHubProfile,
  repository: GitHubRepository,
): PlanetAppearance {
  const surfaceSeed = planetTraitSeed(profile, repository, 'appearance')
  const languageFamily = normalizedLanguage(repository.language)

  if (repository.archived) {
    return {
      languageFamily,
      biome: 'dead',
      state: 'archived',
      surfaceFeature: 'craters',
      baseHue: 218,
      accentHue: 32,
      saturation: 8,
      lightness: 42,
      luminosity: 0.24,
      hasRing: repository.is_template,
      ringHue: 210,
      surfaceSeed,
    }
  }

  if (!languageFamily) {
    return {
      languageFamily: null,
      biome: 'rocky',
      state: 'neutral',
      surfaceFeature: 'craters',
      baseHue: 34,
      accentHue: 25,
      saturation: 18,
      lightness: 42,
      luminosity: 0.48,
      hasRing: repository.is_template,
      ringHue: 42,
      surfaceSeed,
    }
  }

  const palette = languagePalette(languageFamily)
  return {
    languageFamily,
    ...palette,
    state: 'active',
    saturation: 68,
    lightness: 54,
    luminosity: Number((0.7 + (surfaceSeed % 21) / 100).toFixed(2)),
    hasRing: repository.is_template,
    ringHue: palette.accentHue,
    surfaceSeed,
  }
}

function describePlanet(profile: GitHubProfile, scored: ScoredRepository): PlanetDescriptor {
  const { repository, relevanceScore } = scored
  const appearance = describePlanetAppearance(profile, repository)

  return {
    repository,
    relevanceScore,
    radius: planetRadius(repository.size),
    orbitRadius: 0,
    initialPhase: seededRange(profile, repository, 'phase', 0, FULL_ROTATION_RADIANS),
    initialRotation: seededRange(profile, repository, 'rotation', 0, FULL_ROTATION_RADIANS),
    rotationSpeed: seededRange(profile, repository, 'rotation-speed', 0.03, 0.08),
    orbitPeriodSeconds: seededRange(profile, repository, 'orbit-speed', 140, 260),
    appearanceSeed: appearance.surfaceSeed,
    appearance,
  }
}

function describeStarAppearance(planets: PlanetDescriptor[], starSeed: number): StarAppearance {
  const languageCounts = new Map<string, number>()
  for (const planet of planets) {
    const languageFamily = planet.appearance.languageFamily
    if (languageFamily) {
      languageCounts.set(languageFamily, (languageCounts.get(languageFamily) ?? 0) + 1)
    }
  }

  const languageFamilies = [...languageCounts]
    .sort(
      ([leftLanguage, leftCount], [rightLanguage, rightCount]) =>
        rightCount - leftCount ||
        (leftLanguage < rightLanguage ? -1 : leftLanguage > rightLanguage ? 1 : 0),
    )
    .slice(0, 3)
    .map(([language]) => language)
  const technologyHues = languageFamilies.map(
    (languageFamily) => languagePalette(languageFamily).baseHue,
  )
  // A star may retain a stable temperature variation from the profile, but it
  // must always read as a hot solar body rather than as a planet in the
  // repository language palette.
  const primaryHue = 24 + ((technologyHues[0] ?? starSeed) % 11)
  const coronaHue = 18 + ((technologyHues[1] ?? (starSeed >>> 8)) % 11)
  const accentHue = 2 + ((technologyHues[2] ?? (starSeed >>> 16)) % 13)

  return {
    languageFamilies,
    technologyHues,
    primaryHue,
    coronaHue,
    accentHue,
    luminosity: Number((1.7 + (starSeed % 21) / 100).toFixed(2)),
    flareScale: Number((0.82 + (starSeed % 29) / 100).toFixed(2)),
    facetSeed: stableSeedParts('star-facets', starSeed),
  }
}

function placePlanetOrbits(planets: PlanetDescriptor[]): PlanetDescriptor[] {
  const planetsByRecency = [...planets].sort((left, right) =>
    compareRepositoriesByRecency(left.repository, right.repository),
  )
  const orbitByRepositoryId = new Map<number, number>()
  let previous: PlanetDescriptor | undefined

  for (const planet of planetsByRecency) {
    const orbitRadius = previous
      ? previous.orbitRadius + previous.radius + planet.radius + SAFE_ORBIT_GAP
      : MIN_ORBIT_RADIUS + planet.radius
    orbitByRepositoryId.set(planet.repository.id, orbitRadius)
    previous = { ...planet, orbitRadius }
  }

  return planets.map((planet) => ({
    ...planet,
    orbitRadius: orbitByRepositoryId.get(planet.repository.id)!,
  }))
}

export function createGitHubSystem(
  profile: GitHubProfile,
  repositories: GitHubRepository[],
): GitHubSystem {
  const canonicalRepositories = [...repositories].sort((left, right) => left.id - right.id)
  const ownRepositories = canonicalRepositories.filter((repository) => !repository.fork)
  const selectedRepositories = selectRelevantRepositories(ownRepositories)
  const planets = placePlanetOrbits(
    selectedRepositories.map((repository) => describePlanet(profile, repository)),
  )

  const starSeed = stableSeedParts('star', profile.id, profile.login.toLowerCase())

  return {
    profile,
    repositories: canonicalRepositories,
    ownRepositoryCount: ownRepositories.length,
    planets,
    starSeed,
    starAppearance: describeStarAppearance(planets, starSeed),
  }
}
