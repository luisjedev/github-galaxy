const GITHUB_SEARCH_PAGE_SIZE = 100
const GITHUB_SEARCH_ACCESSIBLE_LIMIT = 1_000

export interface RandomSearchLocation {
  index: number
  page: number
  position: number
  accessibleCount: number
}

export function calculateRandomSearchLocation(
  totalCount: number,
  randomUnit: number,
): RandomSearchLocation | null {
  // GitHub only exposes the first 1,000 Search results. This is uniform inside
  // that accessible window, not across every GitHub user that exists.
  const accessibleCount = Math.min(
    GITHUB_SEARCH_ACCESSIBLE_LIMIT,
    Math.max(0, Math.floor(totalCount)),
  )
  if (accessibleCount === 0) return null
  const boundedRandom = Math.min(Math.max(randomUnit, 0), 1 - Number.EPSILON)
  const index = Math.floor(boundedRandom * accessibleCount)
  return {
    index,
    page: Math.floor(index / GITHUB_SEARCH_PAGE_SIZE) + 1,
    position: index % GITHUB_SEARCH_PAGE_SIZE,
    accessibleCount,
  }
}

export interface GitHubUserSearchPage {
  totalCount: number
  incomplete: boolean
  logins: string[]
}

interface DestinationSystem {
  profile: {
    login: string
    public_repos: number
  }
}

export class DestinationSelectionError extends Error {
  constructor(public readonly reason: 'none' | 'exhausted') {
    super(
      reason === 'none'
        ? 'GitHub Search no devolvió candidatos'
        : 'No se encontró un destino válido tras varios intentos',
    )
    this.name = 'DestinationSelectionError'
  }
}

export async function selectRandomDestination<T extends DestinationSystem>({
  currentLogin,
  recentLogins,
  searchPage,
  loadSystem,
  random,
  maxAttempts = 5,
  shouldRetryLoadError = () => false,
}: {
  currentLogin: string
  recentLogins: string[]
  searchPage: (page: number) => Promise<GitHubUserSearchPage>
  loadSystem: (login: string) => Promise<T>
  random: () => number
  maxAttempts?: number
  shouldRetryLoadError?: (error: unknown) => boolean
}): Promise<T> {
  const currentKey = currentLogin.toLowerCase()
  const recentKeys = new Set(recentLogins.map((login) => login.toLowerCase()))
  const attempted = new Set<string>()
  let recentFallback: string | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const firstPage = await searchPage(1)
    const location = calculateRandomSearchLocation(firstPage.totalCount, random())
    if (!location) throw new DestinationSelectionError('none')
    if (firstPage.incomplete) continue

    const selectedPage = location.page === 1 ? firstPage : await searchPage(location.page)
    if (selectedPage.incomplete) continue
    const login = selectedPage.logins[location.position]
    if (!login) continue
    const key = login.toLowerCase()
    if (key === currentKey || attempted.has(key)) continue
    attempted.add(key)
    if (recentKeys.has(key)) {
      recentFallback ??= login
      continue
    }

    let system: T
    try {
      system = await loadSystem(login)
    } catch (error) {
      if (shouldRetryLoadError(error)) continue
      throw error
    }
    const canonicalKey = system.profile.login.toLowerCase()
    if (
      canonicalKey === currentKey ||
      recentKeys.has(canonicalKey) ||
      system.profile.public_repos < 15
    ) {
      continue
    }
    return system
  }

  if (recentFallback) {
    const system = await loadSystem(recentFallback)
    if (
      system.profile.login.toLowerCase() !== currentKey &&
      system.profile.public_repos >= 15
    ) {
      return system
    }
  }

  throw new DestinationSelectionError('exhausted')
}

export const SYSTEM_EXIT_MARGIN = 1.5
export const SYSTEM_EXIT_HYSTERESIS = 2

export function calculateSystemExitRadius(asteroidBeltOuterRadius: number): number {
  return asteroidBeltOuterRadius + SYSTEM_EXIT_MARGIN
}

export interface SystemBoundaryState {
  armed: boolean
  previousDistance: number
}

export interface SystemBoundaryResult extends SystemBoundaryState {
  crossed: boolean
}

export function evaluateSystemBoundary(
  state: SystemBoundaryState,
  position: { x: number; z: number },
  exitRadius: number,
): SystemBoundaryResult {
  const distance = Math.hypot(position.x, position.z)
  const crossed = state.armed && state.previousDistance <= exitRadius && distance > exitRadius
  const rearmed = !state.armed && distance <= exitRadius - SYSTEM_EXIT_HYSTERESIS
  return {
    armed: crossed ? false : rearmed || state.armed,
    previousDistance: distance,
    crossed,
  }
}
