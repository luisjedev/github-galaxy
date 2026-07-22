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
const CACHE_KEY_PREFIX = 'gitgalaxy:github-system:v1:'
export const DEFAULT_GITHUB_CACHE_TTL_MS = 15 * 60 * 1_000

interface LoadOptions {
  onStage?: (stage: LoadingStage) => void
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
      !Array.isArray(cached.system.repositories)
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

function normalizeProfile(profile: GitHubProfile): GitHubProfile {
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

function normalizeRepository(repository: GitHubRepository): GitHubRepository {
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

async function readJson<T>(url: string): Promise<{ data: T; response: Response }> {
  const response = await fetch(url, { headers: githubHeaders() })

  if (!response.ok) {
    throw new Error(`GitHub respondió con el estado ${response.status}`)
  }

  return { data: (await response.json()) as T, response }
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
    const page: { data: GitHubRepository[]; response: Response } = await readJson<
      GitHubRepository[]
    >(url)
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
  const profileResponse = await readJson<GitHubProfile>(
    `${GITHUB_API_URL}/users/${encodeURIComponent(username)}`,
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
