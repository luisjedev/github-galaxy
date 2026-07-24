import {
  addFavorite,
  decodeFavoriteCollection,
  encodeFavoriteCollection,
  refreshFavorites,
  removeFavorite,
  type FavoriteSnapshot,
} from '../domain/favorites'
import type { GitHubRepository, GitHubSystem } from '../domain/github-system'

export const FAVORITES_STORAGE_KEY = 'gitgalaxy:favorites'

interface FavoritesStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface FavoriteStoreResult {
  favorites: FavoriteSnapshot[]
  warning: boolean
}

export interface FavoriteStore {
  initial: FavoriteStoreResult
  toggle(repository: GitHubRepository, owner: string, addedAt?: string): FavoriteStoreResult
  remove(repositoryId: number): FavoriteStoreResult
  refresh(system: GitHubSystem): FavoriteStoreResult
}

export function createFavoriteStore(
  storageSource: FavoritesStorage | (() => FavoritesStorage),
): FavoriteStore {
  let favorites: FavoriteSnapshot[] = []
  let storage: FavoritesStorage | null = null
  let persistenceAvailable = true
  let warningIssued = false
  let initialWarning = false

  try {
    storage = typeof storageSource === 'function' ? storageSource() : storageSource
    const serialized = storage.getItem(FAVORITES_STORAGE_KEY)
    if (serialized !== null) {
      const decoded = decodeFavoriteCollection(serialized)
      if (decoded === null) {
        persistenceAvailable = false
        warningIssued = true
        initialWarning = true
      } else {
        favorites = decoded
      }
    }
  } catch {
    persistenceAvailable = false
    warningIssued = true
    initialWarning = true
  }

  function commit(nextFavorites: FavoriteSnapshot[]): FavoriteStoreResult {
    favorites = nextFavorites
    if (!persistenceAvailable || !storage) return { favorites, warning: false }

    try {
      storage.setItem(FAVORITES_STORAGE_KEY, encodeFavoriteCollection(favorites))
      return { favorites, warning: false }
    } catch {
      persistenceAvailable = false
      const warning = !warningIssued
      warningIssued = true
      return { favorites, warning }
    }
  }

  return {
    initial: { favorites, warning: initialWarning },
    toggle(repository, owner, addedAt = new Date().toISOString()) {
      const isFavorite = favorites.some(
        (favorite) => favorite.repositoryId === repository.id,
      )
      return commit(
        isFavorite
          ? removeFavorite(favorites, repository.id)
          : addFavorite(favorites, repository, owner, addedAt),
      )
    },
    remove(repositoryId) {
      return commit(removeFavorite(favorites, repositoryId))
    },
    refresh(system) {
      const refreshed = refreshFavorites(favorites, system.repositories)
      return encodeFavoriteCollection(refreshed) === encodeFavoriteCollection(favorites)
        ? { favorites, warning: false }
        : commit(refreshed)
    },
  }
}
