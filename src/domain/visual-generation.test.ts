import { describe, expect, test } from 'vitest'
import {
  createGitHubSystem,
  type GitHubProfile,
  type GitHubRepository,
  type PlanetSurfaceFeature,
} from './github-system'
import {
  generatePlanetVisual,
  generateSpaceVisual,
  selectVisualQuality,
} from './visual-generation'

const profile: GitHubProfile = {
  id: 14,
  login: 'low-poly-pilot',
  name: null,
  avatar_url: 'https://example.com/avatar.png',
  html_url: 'https://github.com/low-poly-pilot',
  bio: null,
  followers: 0,
  public_repos: 20,
}

function repository(
  id: number,
  overrides: Partial<GitHubRepository> = {},
): GitHubRepository {
  return {
    id,
    name: `world-${id}`,
    html_url: `https://github.com/low-poly-pilot/world-${id}`,
    description: null,
    fork: false,
    archived: false,
    is_template: false,
    language: 'TypeScript',
    stargazers_count: id,
    forks_count: 0,
    size: id * 100,
    updated_at: `2025-01-${String(Math.min(id, 28)).padStart(2, '0')}T00:00:00Z`,
    ...overrides,
  }
}

function expectFiniteTree(value: unknown): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value)).toBe(true)
    return
  }
  if (Array.isArray(value)) {
    value.forEach(expectFiniteTree)
    return
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(expectFiniteTree)
  }
}

describe('generación visual procedural', () => {
  test('genera el mismo espacio profundo para la misma semilla y acota todos sus atributos', () => {
    const first = generateSpaceVisual(1_234_567, 'normal')
    const second = generateSpaceVisual(1_234_567, 'normal')

    expect(second).toEqual(first)
    expect(first.stars).toHaveLength(960)
    expect(first.dust).toHaveLength(120)
    expect(first.nebulas.length).toBeGreaterThanOrEqual(2)
    expect(first.nebulas.length).toBeLessThanOrEqual(4)
    expect(new Set(first.stars.map((star) => star.layer))).toEqual(new Set([0, 1, 2]))
    expectFiniteTree(first)

    for (const star of first.stars) {
      const distance = Math.hypot(star.position[0], star.position[1], star.position[2])
      expect(distance).toBeGreaterThanOrEqual(72)
      expect(distance).toBeLessThanOrEqual(142)
      expect(star.size).toBeGreaterThanOrEqual(0.08)
      expect(star.size).toBeLessThanOrEqual(0.34)
      expect(star.opacity).toBeGreaterThanOrEqual(0.32)
      expect(star.opacity).toBeLessThanOrEqual(0.95)
      expect(star.hue).toBeGreaterThanOrEqual(0)
      expect(star.hue).toBeLessThan(360)
    }

    expect(
      first.nebulas.slice(0, 2).every((nebula) => {
        const horizontalAngle = Math.abs(
          Math.atan2(nebula.position[0], nebula.position[2]) * (180 / Math.PI),
        )
        return nebula.position[2] > 0 && horizontalAngle <= 45
      }),
    ).toBe(true)
    for (const nebula of first.nebulas) {
      expect(Math.hypot(...nebula.position)).toBeGreaterThanOrEqual(58)
      expect(Math.hypot(...nebula.position)).toBeLessThanOrEqual(90)
      expect(nebula.scale[0]).toBeGreaterThanOrEqual(16)
      expect(nebula.scale[0]).toBeLessThanOrEqual(38)
      expect(nebula.opacity).toBeGreaterThanOrEqual(0.08)
      expect(nebula.opacity).toBeLessThanOrEqual(0.2)
    }
  })

  test('usa una calidad reducida estable para limitar DPR, estrellas, polvo y nebulosas', () => {
    expect(selectVisualQuality({ hardwareConcurrency: 2, devicePixelRatio: 1 })).toBe('reduced')
    expect(selectVisualQuality({ hardwareConcurrency: 8, devicePixelRatio: 1.5 })).toBe('normal')
    expect(selectVisualQuality({ hardwareConcurrency: 8, devicePixelRatio: 3 })).toBe('reduced')
    expect(
      selectVisualQuality({ hardwareConcurrency: 16, devicePixelRatio: 1, softwareRenderer: true }),
    ).toBe('reduced')

    const normal = generateSpaceVisual(99, 'normal')
    const reduced = generateSpaceVisual(99, 'reduced')

    expect(reduced.stars).toHaveLength(240)
    expect(reduced.dust).toHaveLength(32)
    expect(reduced.nebulas).toHaveLength(2)
    expect(reduced.stars.length).toBeLessThan(normal.stars.length)
  })

  test('mantiene acotada la composición con cero y veinte planetas', () => {
    const empty = createGitHubSystem(profile, [])
    const full = createGitHubSystem(
      profile,
      Array.from({ length: 20 }, (_, index) => repository(index + 1)),
    )

    expect(empty.planets.map((planet) => generatePlanetVisual(planet, 'normal'))).toEqual([])
    const visuals = full.planets.map((planet) => generatePlanetVisual(planet, 'normal'))
    expect(visuals).toHaveLength(20)
    expect(visuals.every((visual) => visual.formations.length <= 16)).toBe(true)
    expectFiniteTree(visuals)
  })

  test('produce detalle superficial distinto y distribuido para cada rasgo', () => {
    const languagesByFeature: Record<PlanetSurfaceFeature, string | null> = {
      bands: 'Python',
      craters: null,
      dunes: 'JavaScript',
      facets: 'TypeScript',
      islands: 'Shell',
      ridges: 'Rust',
    }
    const signatures = new Set<string>()

    for (const [feature, language] of Object.entries(languagesByFeature)) {
      const planet = createGitHubSystem(profile, [repository(1, { language })]).planets[0]
      expect(planet.appearance.surfaceFeature).toBe(feature)
      const visual = generatePlanetVisual(planet, 'normal')

      expect(visual.formations.length).toBeGreaterThanOrEqual(5)
      expect(new Set(visual.formations.map((formation) => formation.position.join(','))).size)
        .toBe(visual.formations.length)
      expect(visual.surfaceSamples).toHaveLength(80)
      expect(visual.surfaceSamples.every((sample) => sample.accentMix >= 0 && sample.accentMix <= 1))
        .toBe(true)
      signatures.add(
        visual.surfaceSamples
          .slice(0, 12)
          .map((sample) => sample.accentMix.toFixed(3))
          .join(','),
      )
    }

    expect(signatures.size).toBe(6)
  })

  test('respeta estados archivado, neutral, vacío y plantilla en el acabado visual', () => {
    const system = createGitHubSystem(profile, [
      repository(1, { archived: true, language: 'Python' }),
      repository(2, { language: null }),
      repository(3, { size: 0, language: 'TypeScript' }),
      repository(4, { is_template: true, language: 'Rust' }),
    ])
    const byId = new Map(
      system.planets.map((planet) => [planet.repository.id, generatePlanetVisual(planet, 'normal')]),
    )

    expect(byId.get(1)).toMatchObject({ atmosphere: null, cloudLayer: false })
    expect(byId.get(1)?.emissiveStrength).toBeLessThan(0.1)
    expect(byId.get(2)).toMatchObject({ atmosphere: null })
    expect(byId.get(3)?.radius).toBe(0.7)
    expect(byId.get(4)?.ringBands).toHaveLength(3)
    expect(byId.get(4)?.atmosphere).not.toBeNull()
  })
})
