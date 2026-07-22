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
}

export interface GitHubSystem {
  profile: GitHubProfile
  repositories: GitHubRepository[]
  ownRepositoryCount: number
  planets: PlanetDescriptor[]
  starSeed: number
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

function describePlanet(profile: GitHubProfile, scored: ScoredRepository): PlanetDescriptor {
  const { repository, relevanceScore } = scored

  return {
    repository,
    relevanceScore,
    radius: planetRadius(repository.size),
    orbitRadius: 0,
    initialPhase: seededRange(profile, repository, 'phase', 0, FULL_ROTATION_RADIANS),
    initialRotation: seededRange(profile, repository, 'rotation', 0, FULL_ROTATION_RADIANS),
    rotationSpeed: seededRange(profile, repository, 'rotation-speed', 0.03, 0.08),
    orbitPeriodSeconds: seededRange(profile, repository, 'orbit-speed', 140, 260),
    appearanceSeed: planetTraitSeed(profile, repository, 'appearance'),
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

  return {
    profile,
    repositories: canonicalRepositories,
    ownRepositoryCount: ownRepositories.length,
    planets,
    starSeed: stableSeedParts('star', profile.id, profile.login.toLowerCase()),
  }
}
