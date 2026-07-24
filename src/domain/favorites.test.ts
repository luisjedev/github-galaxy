import { describe, expect, it } from 'vitest'
import {
  addFavorite,
  decodeFavoriteCollection,
  encodeFavoriteCollection,
  refreshFavorites,
  removeFavorite,
  type FavoriteSnapshot,
} from './favorites'
import type { GitHubRepository } from './github-system'

const repository: GitHubRepository = {
  id: 42,
  name: 'galaxy',
  html_url: 'https://github.com/pilot/galaxy',
  description: 'First description',
  fork: false,
  archived: false,
  is_template: false,
  language: 'TypeScript',
  stargazers_count: 12,
  forks_count: 1,
  size: 100,
  updated_at: '2026-01-01T00:00:00Z',
}

const existing: FavoriteSnapshot = {
  repositoryId: 7,
  owner: 'navigator',
  name: 'older',
  description: null,
  language: null,
  stars: 1,
  url: 'https://github.com/navigator/older',
  addedAt: '2026-01-01T00:00:00.000Z',
}

describe('colección de favoritos', () => {
  it('valida el formato versionado sin aceptar contenido corrupto o versiones desconocidas', () => {
    expect(decodeFavoriteCollection(encodeFavoriteCollection([existing]))).toEqual([existing])
    expect(decodeFavoriteCollection('{not-json')).toBeNull()
    expect(decodeFavoriteCollection(JSON.stringify({ version: 2, favorites: [] }))).toBeNull()
    expect(decodeFavoriteCollection(JSON.stringify({ version: 1, favorites: [{ id: 7 }] }))).toBeNull()
  })

  it('ordena incorporaciones recientes al leer y al añadir, y deduplica por repository.id', () => {
    const recentPersisted = {
      ...existing,
      repositoryId: 8,
      name: 'recent',
      url: 'https://github.com/navigator/recent',
      addedAt: '2026-01-15T00:00:00.000Z',
    }
    expect(
      decodeFavoriteCollection(encodeFavoriteCollection([existing, recentPersisted]))?.map(
        (favorite) => favorite.repositoryId,
      ),
    ).toEqual([8, 7])

    const added = addFavorite([existing], repository, 'pilot', '2026-02-01T00:00:00.000Z')
    const renamedDuplicate = addFavorite(
      added,
      { ...repository, name: 'renamed' },
      'pilot',
      '2026-03-01T00:00:00.000Z',
    )

    expect(added.map((favorite) => favorite.repositoryId)).toEqual([42, 7])
    expect(renamedDuplicate).toHaveLength(2)
    expect(renamedDuplicate[0]).toMatchObject({
      repositoryId: 42,
      name: 'renamed',
      addedAt: '2026-03-01T00:00:00.000Z',
    })
    expect(removeFavorite(renamedDuplicate, 42)).toEqual([existing])
  })

  it('refresca los datos encontrados sin cambiar propietario, orden ni fecha de incorporación', () => {
    const favorite = addFavorite([], repository, 'pilot', '2026-02-01T00:00:00.000Z')[0]
    const refreshed = refreshFavorites(
      [favorite, existing],
      [{
        ...repository,
        name: 'galaxy-next',
        html_url: 'https://github.com/pilot/galaxy-next',
        description: 'Updated',
        language: 'Rust',
        stargazers_count: 99,
      }],
    )

    expect(refreshed).toEqual([
      {
        ...favorite,
        name: 'galaxy-next',
        url: 'https://github.com/pilot/galaxy-next',
        description: 'Updated',
        language: 'Rust',
        stars: 99,
      },
      existing,
    ])
  })
})
