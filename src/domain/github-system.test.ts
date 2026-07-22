import { describe, expect, test } from 'vitest'
import {
  createGitHubSystem,
  type GitHubProfile,
  type GitHubRepository,
} from './github-system'

const profile: GitHubProfile = {
  id: 7,
  login: 'stargazer',
  name: null,
  avatar_url: 'https://example.com/avatar.png',
  html_url: 'https://github.com/stargazer',
  bio: null,
  followers: 0,
  public_repos: 3,
}

function repository(
  id: number,
  overrides: Partial<GitHubRepository> = {},
): GitHubRepository {
  return {
    id,
    name: `repository-${id}`,
    html_url: `https://github.com/stargazer/repository-${id}`,
    description: null,
    fork: false,
    archived: false,
    is_template: false,
    language: 'TypeScript',
    stargazers_count: 0,
    forks_count: 0,
    size: 0,
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('createGitHubSystem', () => {
  test('combina estrellas, actividad y tamaño con pesos 40/35/25 normalizados', () => {
    const system = createGitHubSystem(profile, [
      repository(1, { stargazers_count: 99 }),
      repository(2, { updated_at: '2025-01-01T00:00:00Z' }),
      repository(3, { size: 99 }),
    ])

    expect(system.planets.map(({ repository: repo, relevanceScore }) => [repo.id, relevanceScore]))
      .toEqual([
        [1, 0.4],
        [2, 0.35],
        [3, 0.25],
      ])
  })

  test('transforma logarítmicamente estrellas y tamaño antes de normalizarlos', () => {
    const system = createGitHubSystem(profile, [
      repository(1),
      repository(2, { stargazers_count: 9, size: 9 }),
      repository(3, { stargazers_count: 99, size: 99 }),
    ])

    expect(system.planets.find(({ repository: repo }) => repo.id === 2)?.relevanceScore).toBeCloseTo(
      0.325,
    )
  })

  test('nunca puntúa peor la actividad más reciente', () => {
    const system = createGitHubSystem(profile, [
      repository(1, { updated_at: '2023-01-01T00:00:00Z' }),
      repository(2, { updated_at: '2024-01-01T00:00:00Z' }),
      repository(3, { updated_at: '2025-01-01T00:00:00Z' }),
    ])

    expect(system.planets.map(({ repository: repo }) => repo.id)).toEqual([3, 2, 1])
    expect(system.planets.map(({ relevanceScore }) => relevanceScore)).toEqual(
      [...system.planets.map(({ relevanceScore }) => relevanceScore)].sort(
        (left, right) => right - left,
      ),
    )
  })

  test('resuelve empates por actualización reciente y después por identificador estable', () => {
    const system = createGitHubSystem(profile, [
      repository(4, { stargazers_count: 99, updated_at: '1970-01-01T00:00:00.000Z' }),
      repository(3, { size: 999, updated_at: '1970-01-01T00:00:00.003Z' }),
      repository(2, { stargazers_count: 99, updated_at: '1970-01-01T00:00:00.000Z' }),
      repository(1, { updated_at: '1970-01-01T00:00:00.007Z' }),
    ])

    expect(system.planets.map(({ repository: repo }) => repo.id)).toEqual([3, 2, 4, 1])
  })

  test('acota el radio planetario con una escala logarítmica y da el mínimo al vacío', () => {
    const system = createGitHubSystem(profile, [
      repository(1),
      repository(2, { size: 999 }),
      repository(3, { size: 999_999 }),
      repository(4, { size: 100_000_000 }),
    ])
    const radii = new Map(
      system.planets.map(({ repository: repo, radius }) => [repo.id, radius]),
    )

    expect(radii.get(1)).toBe(0.7)
    expect(radii.get(2)).toBeCloseTo(1.55)
    expect(radii.get(3)).toBe(2.4)
    expect(radii.get(4)).toBe(2.4)
  })

  test('sitúa actividad reciente en órbitas cercanas manteniendo separación segura', () => {
    const system = createGitHubSystem(profile, [
      repository(1, { size: 999, updated_at: '2023-01-01T00:00:00Z' }),
      repository(2, { size: 999, updated_at: '2025-01-01T00:00:00Z' }),
      repository(3, { size: 999, updated_at: '2024-01-01T00:00:00Z' }),
    ])
    const byRecency = [2, 3, 1].map((id) =>
      system.planets.find(({ repository: repo }) => repo.id === id)!,
    )

    expect(byRecency.map(({ orbitRadius }) => orbitRadius)).toEqual(
      [...byRecency.map(({ orbitRadius }) => orbitRadius)].sort((left, right) => left - right),
    )
    for (let index = 1; index < byRecency.length; index += 1) {
      const inner = byRecency[index - 1]
      const outer = byRecency[index]
      expect(outer.orbitRadius - inner.orbitRadius - inner.radius - outer.radius).toBeGreaterThanOrEqual(
        2,
      )
    }
  })

  test('produce fases, rotaciones y órbitas lentas reproducibles sin depender del orden de entrada', () => {
    const repositories = [
      repository(8, { size: 42, updated_at: '2025-01-01T00:00:00Z' }),
      repository(2, { stargazers_count: 5 }),
      repository(5, { language: null, is_template: true }),
    ]

    const first = createGitHubSystem(profile, repositories)
    const reordered = createGitHubSystem(profile, [repositories[2], repositories[0], repositories[1]])

    expect(reordered).toEqual(first)
    for (const planet of first.planets) {
      expect(planet.initialPhase).toBeGreaterThanOrEqual(0)
      expect(planet.initialPhase).toBeLessThan(Math.PI * 2)
      expect(planet.initialRotation).toBeGreaterThanOrEqual(0)
      expect(planet.initialRotation).toBeLessThan(Math.PI * 2)
      expect(planet.rotationSpeed).toBeGreaterThanOrEqual(0.03)
      expect(planet.rotationSpeed).toBeLessThanOrEqual(0.08)
      expect(planet.orbitPeriodSeconds).toBeGreaterThanOrEqual(140)
      expect(planet.orbitPeriodSeconds).toBeLessThanOrEqual(260)
    }
  })

  test('refleja de forma controlada los cambios relevantes sin alterar la semilla del repositorio', () => {
    const initial = createGitHubSystem(profile, [repository(1), repository(2)])
    const resized = createGitHubSystem(profile, [repository(1, { size: 999 }), repository(2)])
    const before = initial.planets.find(({ repository: repo }) => repo.id === 1)!
    const after = resized.planets.find(({ repository: repo }) => repo.id === 1)!

    expect(after.radius).toBeGreaterThan(before.radius)
    expect(after.relevanceScore).toBeGreaterThan(before.relevanceScore)
    expect({
      initialPhase: after.initialPhase,
      initialRotation: after.initialRotation,
      rotationSpeed: after.rotationSpeed,
      orbitPeriodSeconds: after.orbitPeriodSeconds,
      appearanceSeed: after.appearanceSeed,
    }).toEqual({
      initialPhase: before.initialPhase,
      initialRotation: before.initialRotation,
      rotationSpeed: before.rotationSpeed,
      orbitPeriodSeconds: before.orbitPeriodSeconds,
      appearanceSeed: before.appearanceSeed,
    })
  })

  test('excluye forks antes de puntuar y conserva como máximo veinte repositorios especiales', () => {
    const candidates = Array.from({ length: 21 }, (_, index) =>
      repository(index + 1, {
        archived: index === 20,
        is_template: index === 19,
        language: index === 18 ? null : 'TypeScript',
        size: index === 17 ? 0 : index + 1,
        stargazers_count: index,
      }),
    )
    const system = createGitHubSystem(profile, [
      repository(100, { fork: true, stargazers_count: 1_000_000 }),
      ...candidates,
    ])

    const withoutFork = createGitHubSystem(profile, candidates)

    expect(system.planets).toHaveLength(20)
    expect(system.planets).toEqual(withoutFork.planets)
    expect(system.planets.some(({ repository: repo }) => repo.fork)).toBe(false)
    expect(system.planets.some(({ repository: repo }) => repo.archived)).toBe(true)
    expect(system.planets.some(({ repository: repo }) => repo.is_template)).toBe(true)
    expect(system.planets.some(({ repository: repo }) => repo.language === null)).toBe(true)
    expect(system.planets.some(({ repository: repo }) => repo.size === 0)).toBe(true)
  })
})
