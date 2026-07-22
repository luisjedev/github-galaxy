import { describe, expect, test } from 'vitest'
import {
  calculateRandomSearchLocation,
  calculateSystemExitRadius,
  DestinationSelectionError,
  evaluateSystemBoundary,
  selectRandomDestination,
  SYSTEM_EXIT_HYSTERESIS,
  SYSTEM_EXIT_MARGIN,
} from './wormhole'

describe('límite del sistema', () => {
  test('activa una salida solamente al cruzar de dentro hacia fuera', () => {
    expect(
      evaluateSystemBoundary(
        { armed: true, previousDistance: 24.9 },
        { x: 25.1, z: 0 },
        25,
      ),
    ).toEqual({ armed: false, previousDistance: 25.1, crossed: true })
  })

  test('ignora la altitud y usa solamente la distancia horizontal', () => {
    const position = { x: 0, z: 25.1, altitude: 9_999 }
    expect(
      evaluateSystemBoundary(
        { armed: true, previousDistance: 24.9 },
        position,
        25,
      ).crossed,
    ).toBe(true)
  })

  test('permanece desarmado fuera y solo se rearma claramente dentro', () => {
    const outside = evaluateSystemBoundary(
      { armed: false, previousDistance: 26 },
      { x: 28, z: 0 },
      25,
    )
    const nearInside = evaluateSystemBoundary(outside, { x: 24, z: 0 }, 25)
    const clearlyInside = evaluateSystemBoundary(nearInside, { x: 22, z: 0 }, 25)
    const secondCrossing = evaluateSystemBoundary(clearlyInside, { x: 26, z: 0 }, 25)

    expect(outside).toMatchObject({ armed: false, crossed: false })
    expect(nearInside).toMatchObject({ armed: false, crossed: false })
    expect(clearlyInside).toMatchObject({ armed: true, crossed: false })
    expect(secondCrossing).toMatchObject({ armed: false, crossed: true })
    expect(SYSTEM_EXIT_HYSTERESIS).toBe(2)
  })

  test('deriva el radio lógico del borde exterior con un margen explícito', () => {
    expect(calculateSystemExitRadius(31.25)).toBe(32.75)
    expect(SYSTEM_EXIT_MARGIN).toBe(1.5)
  })
})

describe('posición aleatoria de GitHub Search', () => {
  test.each([
    { total: 0, expected: null },
    { total: 1, expected: { index: 0, page: 1, position: 0, accessibleCount: 1 } },
    { total: 999, expected: { index: 998, page: 10, position: 98, accessibleCount: 999 } },
    { total: 1_000, expected: { index: 999, page: 10, position: 99, accessibleCount: 1_000 } },
    { total: 8_642, expected: { index: 999, page: 10, position: 99, accessibleCount: 1_000 } },
  ])('calcula página y posición para $total resultados', ({ total, expected }) => {
    expect(calculateRandomSearchLocation(total, 0.999_999)).toEqual(expected)
  })
})

describe('selección de destinos', () => {
  test('excluye el usuario actual, recientes y perfiles que ya no cumplen el mínimo', async () => {
    const candidates = ['PILOT', 'recent', 'stale', 'destination']
    let randomIndex = 0
    const loaded: string[] = []

    const destination = await selectRandomDestination({
      currentLogin: 'pilot',
      recentLogins: ['RECENT'],
      maxAttempts: 4,
      random: () => (randomIndex++ + 0.1) / candidates.length,
      searchPage: async () => ({
        totalCount: candidates.length,
        incomplete: false,
        logins: candidates,
      }),
      loadSystem: async (login) => {
        loaded.push(login)
        return {
          profile: {
            login,
            public_repos: login === 'stale' ? 14 : 15,
          },
        }
      },
    })

    expect(destination.profile.login).toBe('destination')
    expect(loaded).toEqual(['stale', 'destination'])
  })

  test('trata páginas vacías e incompletas como recuperables y acota los intentos', async () => {
    let searches = 0
    await expect(
      selectRandomDestination({
        currentLogin: 'origin',
        recentLogins: [],
        maxAttempts: 3,
        random: () => 0,
        searchPage: async () => {
          searches += 1
          return searches === 1
            ? { totalCount: 1, incomplete: true, logins: ['candidate'] }
            : { totalCount: 1, incomplete: false, logins: [] }
        },
        loadSystem: async () => {
          throw new Error('no debe cargar un candidato inexistente')
        },
      }),
    ).rejects.toEqual(new DestinationSelectionError('exhausted'))
    expect(searches).toBe(3)
  })

  test('permite un usuario reciente solamente cuando no aparece una alternativa', async () => {
    const destination = await selectRandomDestination({
      currentLogin: 'origin',
      recentLogins: ['visited'],
      maxAttempts: 2,
      random: () => 0,
      searchPage: async () => ({
        totalCount: 1,
        incomplete: false,
        logins: ['visited'],
      }),
      loadSystem: async (login) => ({ profile: { login, public_repos: 20 } }),
    })

    expect(destination.profile.login).toBe('visited')
  })

  test('informa cuando Search no contiene candidatos', async () => {
    await expect(
      selectRandomDestination({
        currentLogin: 'origin',
        recentLogins: [],
        random: () => 0,
        searchPage: async () => ({ totalCount: 0, incomplete: false, logins: [] }),
        loadSystem: async (login) => ({ profile: { login, public_repos: 20 } }),
      }),
    ).rejects.toEqual(new DestinationSelectionError('none'))
  })
})
