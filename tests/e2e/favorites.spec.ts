import { expect, test, type Page } from '@playwright/test'

const profiles = {
  pilot: {
    id: 404,
    login: 'pilot',
    name: 'Galaxy Pilot',
    avatar_url: 'https://avatars.example/pilot.png',
    html_url: 'https://github.com/pilot',
    bio: null,
    followers: 12,
    public_repos: 1,
  },
  navigator: {
    id: 505,
    login: 'navigator',
    name: 'Galaxy Navigator',
    avatar_url: 'https://avatars.example/navigator.png',
    html_url: 'https://github.com/navigator',
    bio: null,
    followers: 7,
    public_repos: 1,
  },
}

function repository(id: number, owner: keyof typeof profiles) {
  return {
    id,
    name: `${owner}-world`,
    html_url: `https://github.com/${owner}/${owner}-world`,
    description: `World of ${owner}`,
    fork: false,
    archived: false,
    is_template: false,
    language: owner === 'pilot' ? 'TypeScript' : 'Rust',
    stargazers_count: owner === 'pilot' ? 10 : 20,
    forks_count: 0,
    size: 120,
    updated_at: '2026-01-03T00:00:00Z',
  }
}

async function interceptGitHub(
  page: Page,
  repositories: Partial<Record<keyof typeof profiles, ReturnType<typeof repository>[]>> = {
    pilot: [repository(1, 'pilot')],
    navigator: [repository(2, 'navigator')],
  },
) {
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    const owner = url.pathname.toLowerCase().includes('navigator') ? 'navigator' : 'pilot'
    await route.fulfill({
      json: url.pathname.endsWith('/repos') ? (repositories[owner] ?? []) : profiles[owner],
      headers: { 'access-control-expose-headers': 'Link' },
    })
  })
}

const favoritesState = (page: Page) => page.getByTestId('favorites-state')

test('alterna con F, evita repetición y conserva favoritos globales entre sistemas y recargas', async ({
  page,
}) => {
  await interceptGitHub(page)
  await page.goto('/pilot')
  await expect(page.getByRole('complementary', { name: 'Ficha de pilot-world' })).toBeVisible()

  await page.keyboard.press('f')
  await expect(page.getByRole('status', { name: 'Estado de favoritos' })).toContainText('Añadido a favoritos')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '1')
  await expect(favoritesState(page)).toHaveAttribute('data-active-favorite', 'true')

  await page.reload()
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '1')
  await page.keyboard.press('f')
  await expect(page.getByRole('status', { name: 'Estado de favoritos' })).toContainText('Eliminado de favoritos')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '0')

  await page.keyboard.down('f')
  await page.waitForTimeout(350)
  await page.keyboard.up('f')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '1')

  await page.goto('/navigator')
  await expect(page.getByRole('complementary', { name: 'Ficha de navigator-world' })).toBeVisible()
  await page.keyboard.press('f')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '2')

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gitgalaxy:favorites')!))
  expect(stored.version).toBe(1)
  expect(stored.favorites.map((favorite: { repositoryId: number }) => favorite.repositoryId)).toEqual([2, 1])
})

test('rechaza la estrella y bloquea F durante pausa y teletransporte', async ({ page }) => {
  await interceptGitHub(page, { pilot: [] })
  await page.goto('/pilot')
  await expect(page.getByRole('complementary', { name: 'Ficha de Galaxy Pilot' })).toBeVisible()

  await page.keyboard.press('f')
  await expect(page.getByRole('status', { name: 'Estado de favoritos' })).toContainText(
    'Acércate a un planeta para añadirlo a favoritos',
  )
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '0')

  await page.keyboard.press('Escape')
  await page.keyboard.press('f')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '0')
  await page.keyboard.press('Escape')

  await page.keyboard.press('r')
  await expect(page.getByRole('status', { name: 'Secuencia de teletransporte' })).toBeVisible()
  await page.keyboard.press('f')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '0')
})

test('un localStorage corrupto usa memoria, avisa una vez y permite seguir explorando', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('gitgalaxy:favorites', '{invalid'))
  await interceptGitHub(page)
  await page.goto('/pilot')

  await expect(page.getByRole('alert')).toContainText(
    'Los favoritos no podrán conservarse al cerrar esta pestaña',
  )
  await page.keyboard.press('f')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '1')
  await page.keyboard.press('f')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '0')
  await expect(page.getByText('Los favoritos no podrán conservarse al cerrar esta pestaña')).toHaveCount(1)
  expect(await page.evaluate(() => localStorage.getItem('gitgalaxy:favorites'))).toBe('{invalid')
})
