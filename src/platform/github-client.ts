import type { LoadingStage } from '../domain/app-state'
import {
  createGitHubSystem,
  type GitHubProfile,
  type GitHubRepository,
  type GitHubSystem,
} from '../domain/github-system'

const GITHUB_API_URL = 'https://api.github.com'
const GITHUB_API_VERSION = '2026-03-10'
const PAGE_SIZE = 100
const CACHE_KEY_PREFIX = 'gitgalaxy:github-system:v4:'
export const DEFAULT_GITHUB_CACHE_TTL_MS = 15 * 60 * 1_000

interface LoadOptions {
  onStage?: (stage: LoadingStage) => void
}

export class GitHubRequestError extends Error {
  constructor(
    public readonly kind: 'not-found' | 'rate-limit' | 'network' | 'api',
    message: string,
    public readonly retryAt?: number,
  ) {
    super(message)
    this.name = 'GitHubRequestError'
  }
}

interface CachedSystem {
  cachedAt: number
  system: GitHubSystem
}

interface PendingLoad {
  promise: Promise<GitHubSystem>
  listeners: Set<(stage: LoadingStage) => void>
}

const pendingLoads = new Map<string, PendingLoad>()

function configuredCacheTtlMs(): number {
  const value = Number(import.meta.env.VITE_GITHUB_CACHE_TTL_MS)
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_GITHUB_CACHE_TTL_MS
}

function readCachedSystem(key: string, cacheTtlMs: number): GitHubSystem | null {
  try {
    const rawValue = window.localStorage.getItem(`${CACHE_KEY_PREFIX}${key}`)
    if (!rawValue) return null

    const cached = JSON.parse(rawValue) as CachedSystem
    const age = Date.now() - cached.cachedAt
    if (
      !Number.isFinite(cached.cachedAt) ||
      age < 0 ||
      age >= cacheTtlMs ||
      !cached.system?.profile?.login ||
      !Array.isArray(cached.system.repositories) ||
      typeof cached.system.ownRepositoryCount !== 'number' ||
      !Array.isArray(cached.system.planets)
    ) {
      window.localStorage.removeItem(`${CACHE_KEY_PREFIX}${key}`)
      return null
    }

    return cached.system
  } catch {
    return null
  }
}

function writeCachedSystem(key: string, system: GitHubSystem) {
  try {
    const cached: CachedSystem = { cachedAt: Date.now(), system }
    window.localStorage.setItem(`${CACHE_KEY_PREFIX}${key}`, JSON.stringify(cached))
  } catch {
    // Storage can be unavailable or full; GitHub data still remains usable for this session.
  }
}

function invalidResponse(): never {
  throw new GitHubRequestError('api', 'GitHub devolvió una respuesta incompleta')
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function normalizeProfile(value: unknown): GitHubProfile {
  if (!value || typeof value !== 'object') invalidResponse()
  const profile = value as Record<string, unknown>

  if (
    typeof profile.id !== 'number' ||
    !Number.isFinite(profile.id) ||
    typeof profile.login !== 'string' ||
    !profile.login ||
    !isNullableString(profile.name) ||
    typeof profile.avatar_url !== 'string' ||
    typeof profile.html_url !== 'string' ||
    !isNullableString(profile.bio) ||
    typeof profile.followers !== 'number' ||
    typeof profile.public_repos !== 'number'
  ) {
    invalidResponse()
  }

  return {
    id: profile.id,
    login: profile.login,
    name: profile.name,
    avatar_url: profile.avatar_url,
    html_url: profile.html_url,
    bio: profile.bio,
    followers: profile.followers,
    public_repos: profile.public_repos,
  }
}

function normalizeRepository(value: unknown): GitHubRepository {
  if (!value || typeof value !== 'object') invalidResponse()
  const repository = value as Record<string, unknown>

  if (
    typeof repository.id !== 'number' ||
    !Number.isFinite(repository.id) ||
    typeof repository.name !== 'string' ||
    typeof repository.html_url !== 'string' ||
    !isNullableString(repository.description) ||
    typeof repository.fork !== 'boolean' ||
    typeof repository.archived !== 'boolean' ||
    typeof repository.is_template !== 'boolean' ||
    !isNullableString(repository.language) ||
    typeof repository.stargazers_count !== 'number' ||
    typeof repository.forks_count !== 'number' ||
    typeof repository.size !== 'number' ||
    typeof repository.updated_at !== 'string'
  ) {
    invalidResponse()
  }

  return {
    id: repository.id,
    name: repository.name,
    html_url: repository.html_url,
    description: repository.description,
    fork: repository.fork,
    archived: repository.archived,
    is_template: repository.is_template,
    language: repository.language,
    stargazers_count: repository.stargazers_count,
    forks_count: repository.forks_count,
    size: repository.size,
    updated_at: repository.updated_at,
  }
}

function githubHeaders(): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }
}

async function readJson<T>(
  url: string,
  options: { notFoundMeansUser?: boolean } = {},
): Promise<{ data: T; response: Response }> {
  let response: Response
  try {
    response = await fetch(url, { headers: githubHeaders() })
  } catch {
    throw new GitHubRequestError('network', 'No se pudo conectar con GitHub')
  }

  if (!response.ok) {
    if (response.status === 404 && options.notFoundMeansUser) {
      throw new GitHubRequestError('not-found', 'El usuario de GitHub no existe')
    }

    const remaining = response.headers.get('x-ratelimit-remaining')
    const resetAtSeconds = Number(response.headers.get('x-ratelimit-reset'))
    const retryAfterSeconds = Number(response.headers.get('retry-after'))
    const hasRateLimitReset = Number.isFinite(resetAtSeconds) && resetAtSeconds > 0
    const hasRetryAfter = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    const isRateLimit =
      response.status === 429 ||
      remaining === '0' ||
      (response.status === 403 && (hasRateLimitReset || hasRetryAfter))

    if (isRateLimit) {
      const retryAt = hasRateLimitReset
        ? resetAtSeconds * 1_000
        : hasRetryAfter
          ? Date.now() + retryAfterSeconds * 1_000
          : undefined
      throw new GitHubRequestError(
        'rate-limit',
        'GitHub ha limitado temporalmente las solicitudes públicas',
        retryAt,
      )
    }

    throw new GitHubRequestError('api', `GitHub respondió con el estado ${response.status}`)
  }

  try {
    return { data: (await response.json()) as T, response }
  } catch {
    throw new GitHubRequestError('api', 'GitHub devolvió una respuesta ilegible')
  }
}

function nextPage(response: Response): string | null {
  const link = response.headers.get('link')
  if (!link) return null

  for (const entry of link.split(',')) {
    const match = entry.match(/<([^>]+)>;\s*rel="next"/)
    if (match) return match[1]
  }

  return null
}

async function fetchRepositories(username: string): Promise<GitHubRepository[]> {
  const repositories: GitHubRepository[] = []
  let url: string | null = `${GITHUB_API_URL}/users/${encodeURIComponent(username)}/repos?type=owner&per_page=${PAGE_SIZE}&page=1`

  while (url) {
    const page = await readJson<unknown>(url)
    if (!Array.isArray(page.data)) invalidResponse()
    repositories.push(...page.data.map(normalizeRepository))
    url = nextPage(page.response)
  }

  return repositories
}

async function requestSystem(
  username: string,
  notify: (stage: LoadingStage) => void,
): Promise<GitHubSystem> {
  notify('profile')
  const profileResponse = await readJson<unknown>(
    `${GITHUB_API_URL}/users/${encodeURIComponent(username)}`,
    { notFoundMeansUser: true },
  )
  const profile = normalizeProfile(profileResponse.data)
  notify('repositories')
  const repositories = await fetchRepositories(profile.login)
  notify('system')
  return createGitHubSystem(profile, repositories)
}

export function loadGitHubSystem(username: string, options: LoadOptions = {}): Promise<GitHubSystem> {
  const { onStage } = options
  const key = username.toLowerCase()
  const cached = readCachedSystem(key, configuredCacheTtlMs())
  if (cached) {
    onStage?.('system')
    return Promise.resolve(cached)
  }

  const pending = pendingLoads.get(key)

  if (pending) {
    if (onStage) pending.listeners.add(onStage)
    return pending.promise
  }

  const listeners = new Set<(stage: LoadingStage) => void>()
  if (onStage) listeners.add(onStage)

  const promise = requestSystem(username, (stage) => {
    for (const listener of listeners) listener(stage)
  })
    .then((system) => {
      writeCachedSystem(key, system)
      const canonicalKey = system.profile.login.toLowerCase()
      if (canonicalKey !== key) writeCachedSystem(canonicalKey, system)
      return system
    })
    .finally(() => pendingLoads.delete(key))

  pendingLoads.set(key, { promise, listeners })
  return promise
}
