import type { GitHubRepository } from './github-system'

export const FAVORITES_FORMAT_VERSION = 1

export interface FavoriteSnapshot {
  repositoryId: number
  owner: string
  name: string
  description: string | null
  language: string | null
  stars: number
  url: string
  addedAt: string
}

interface FavoriteCollectionDocument {
  version: typeof FAVORITES_FORMAT_VERSION
  favorites: FavoriteSnapshot[]
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isFavoriteSnapshot(value: unknown): value is FavoriteSnapshot {
  if (!value || typeof value !== 'object') return false
  const favorite = value as Record<string, unknown>
  return (
    Number.isSafeInteger(favorite.repositoryId) &&
    (favorite.repositoryId as number) > 0 &&
    typeof favorite.owner === 'string' &&
    favorite.owner.length > 0 &&
    typeof favorite.name === 'string' &&
    favorite.name.length > 0 &&
    isNullableString(favorite.description) &&
    isNullableString(favorite.language) &&
    Number.isFinite(favorite.stars) &&
    (favorite.stars as number) >= 0 &&
    typeof favorite.url === 'string' &&
    favorite.url.length > 0 &&
    typeof favorite.addedAt === 'string' &&
    Number.isFinite(Date.parse(favorite.addedAt))
  )
}

export function decodeFavoriteCollection(serialized: string): FavoriteSnapshot[] | null {
  try {
    const document = JSON.parse(serialized) as Partial<FavoriteCollectionDocument>
    if (
      !document ||
      typeof document !== 'object' ||
      document.version !== FAVORITES_FORMAT_VERSION ||
      !Array.isArray(document.favorites) ||
      !document.favorites.every(isFavoriteSnapshot)
    ) return null

    const repositoryIds = document.favorites.map((favorite) => favorite.repositoryId)
    if (new Set(repositoryIds).size !== repositoryIds.length) return null
    return document.favorites
      .map((favorite) => ({ ...favorite }))
      .sort((left, right) => Date.parse(right.addedAt) - Date.parse(left.addedAt))
  } catch {
    return null
  }
}

export function encodeFavoriteCollection(favorites: FavoriteSnapshot[]): string {
  return JSON.stringify({ version: FAVORITES_FORMAT_VERSION, favorites })
}

function snapshotRepository(
  repository: GitHubRepository,
  owner: string,
  addedAt: string,
): FavoriteSnapshot {
  return {
    repositoryId: repository.id,
    owner,
    name: repository.name,
    description: repository.description,
    language: repository.language,
    stars: repository.stargazers_count,
    url: repository.html_url,
    addedAt,
  }
}

export function addFavorite(
  favorites: FavoriteSnapshot[],
  repository: GitHubRepository,
  owner: string,
  addedAt: string,
): FavoriteSnapshot[] {
  return [
    snapshotRepository(repository, owner, addedAt),
    ...favorites.filter((favorite) => favorite.repositoryId !== repository.id),
  ]
}

export function removeFavorite(
  favorites: FavoriteSnapshot[],
  repositoryId: number,
): FavoriteSnapshot[] {
  return favorites.filter((favorite) => favorite.repositoryId !== repositoryId)
}

export function refreshFavorites(
  favorites: FavoriteSnapshot[],
  repositories: GitHubRepository[],
): FavoriteSnapshot[] {
  const repositoriesById = new Map(repositories.map((repository) => [repository.id, repository]))
  return favorites.map((favorite) => {
    const repository = repositoriesById.get(favorite.repositoryId)
    if (!repository) return favorite
    return {
      ...favorite,
      name: repository.name,
      description: repository.description,
      language: repository.language,
      stars: repository.stargazers_count,
      url: repository.html_url,
    }
  })
}
