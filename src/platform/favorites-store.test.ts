import { describe, expect, it, vi } from 'vitest'
import { encodeFavoriteCollection, type FavoriteSnapshot } from '../domain/favorites'
import type { GitHubRepository } from '../domain/github-system'
import { createFavoriteStore, FAVORITES_STORAGE_KEY } from './favorites-store'

const favorite: FavoriteSnapshot = {
  repositoryId: 1,
  owner: 'pilot',
  name: 'first',
  description: null,
  language: 'TypeScript',
  stars: 1,
  url: 'https://github.com/pilot/first',
  addedAt: '2026-01-01T00:00:00.000Z',
}

const repository: GitHubRepository = {
  id: 2,
  name: 'second',
  html_url: 'https://github.com/pilot/second',
  description: 'A repository',
  fork: false,
  archived: false,
  is_template: false,
  language: 'Rust',
  stargazers_count: 2,
  forks_count: 0,
  size: 20,
  updated_at: '2026-02-01T00:00:00Z',
}

function storageWith(value: string | null) {
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn(),
  }
}

describe('almacenamiento de favoritos', () => {
  it('lee una colección válida y persiste los cambios versionados', () => {
    const storage = storageWith(encodeFavoriteCollection([favorite]))
    const store = createFavoriteStore(storage)

    expect(store.initial).toEqual({ favorites: [favorite], warning: false })
    const result = store.toggle(repository, 'pilot', '2026-02-01T00:00:00.000Z')

    expect(result.favorites.map((entry) => entry.repositoryId)).toEqual([2, 1])
    expect(storage.setItem).toHaveBeenCalledWith(
      FAVORITES_STORAGE_KEY,
      encodeFavoriteCollection(result.favorites),
    )
  })

  it('usa memoria y avisa una sola vez cuando el contenido es corrupto sin sobrescribirlo', () => {
    const storage = storageWith('{invalid')
    const store = createFavoriteStore(storage)

    expect(store.initial).toEqual({ favorites: [], warning: true })
    expect(store.toggle(repository, 'pilot', '2026-02-01T00:00:00.000Z')).toMatchObject({
      favorites: [{ repositoryId: 2 }],
      warning: false,
    })
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('conserva en memoria la mutación que llena o bloquea localStorage y no repite el aviso', () => {
    const storage = storageWith(null)
    storage.setItem.mockImplementation(() => { throw new Error('Quota exceeded') })
    const store = createFavoriteStore(storage)

    const first = store.toggle(repository, 'pilot', '2026-02-01T00:00:00.000Z')
    const second = store.toggle(repository, 'pilot', '2026-02-02T00:00:00.000Z')

    expect(first).toMatchObject({ favorites: [{ repositoryId: 2 }], warning: true })
    expect(second).toEqual({ favorites: [], warning: false })
  })

  it('recupera la exploración cuando el acceso o la lectura de localStorage están bloqueados', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('Security error') }),
      setItem: vi.fn(),
    }

    expect(createFavoriteStore(storage).initial).toEqual({ favorites: [], warning: true })
    expect(createFavoriteStore(() => { throw new Error('Blocked getter') }).initial).toEqual({
      favorites: [],
      warning: true,
    })
  })
})
