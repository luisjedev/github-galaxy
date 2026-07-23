import { expect, test, type Page } from '@playwright/test'

const profile = {
  id: 404,
  login: 'pilot',
  name: 'Galaxy Pilot',
  avatar_url: 'https://avatars.example/pilot.png',
  html_url: 'https://github.com/pilot',
  bio: null,
  followers: 12,
  public_repos: 1,
}

const repositories = [
  {
    id: 1,
    name: 'typescript-flight',
    html_url: 'https://github.com/pilot/typescript-flight',
    description: null,
    fork: false,
    archived: false,
    is_template: false,
    language: 'TypeScript',
    stargazers_count: 10,
    forks_count: 0,
    size: 120,
    updated_at: '2026-01-03T00:00:00Z',
  },
]

const navigatorProfile = {
  ...profile,
  id: 505,
  login: 'navigator',
  name: 'Galaxy Navigator',
  html_url: 'https://github.com/navigator',
}

const navigatorRepositories = [
  {
    ...repositories[0],
    id: 2,
    name: 'new-horizons',
    html_url: 'https://github.com/navigator/new-horizons',
  },
]

async function interceptGitHub(page: Page) {
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    const isNavigatorRequest = url.pathname.includes('/users/navigator')
    await route.fulfill({
      json: url.pathname.endsWith('/repos')
        ? isNavigatorRequest
          ? navigatorRepositories
          : repositories
        : isNavigatorRequest
          ? navigatorProfile
          : profile,
      headers: { 'access-control-expose-headers': 'Link' },
    })
  })
}

async function flightPosition(page: Page) {
  const hud = page.getByTestId('flight-state')
  return {
    x: Number(await hud.getAttribute('data-x')),
    z: Number(await hud.getAttribute('data-z')),
  }
}

test('Esc pausa y reanuda la exploración sin aceptar controles de pilotaje durante la pausa', async ({
  page,
}) => {
  await interceptGitHub(page)
  await page.goto('/pilot')
  const exploration = page.locator('[data-app-state="exploration"]')
  await expect(exploration).toBeVisible()
  await expect(exploration).toBeFocused()

  await page.keyboard.press('Escape')

  const pauseMenu = page.getByRole('dialog', { name: 'Exploración de pilot' })
  await expect(page.locator('[data-app-state="pause"]')).toBeVisible()
  await expect(pauseMenu).toContainText('Sistema en pausa')
  const continueButton = pauseMenu.getByRole('button', { name: 'Continuar explorando' })
  const wormholeButton = pauseMenu.getByRole('button', { name: 'Usar agujero de gusano' })
  const menuButton = pauseMenu.getByRole('button', { name: 'Volver al menú principal' })
  await expect(continueButton).toBeVisible()
  await expect(wormholeButton).toBeVisible()
  await expect(menuButton).toBeVisible()
  await expect(continueButton).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(menuButton).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(continueButton).toBeFocused()

  const pausedPosition = await flightPosition(page)
  await page.keyboard.down('w')
  await page.waitForTimeout(350)
  await page.keyboard.up('w')
  expect(await flightPosition(page)).toEqual(pausedPosition)

  await page.keyboard.press('Escape')
  await expect(pauseMenu).toHaveCount(0)
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()

  await page.keyboard.down('w')
  await expect
    .poll(async () => {
      const resumedPosition = await flightPosition(page)
      return Math.hypot(
        resumedPosition.x - pausedPosition.x,
        resumedPosition.z - pausedPosition.z,
      )
    })
    .toBeGreaterThan(0.2)
  await page.keyboard.up('w')
})

test('volver al menú limpia la exploración anterior y permite cargar otro perfil reflejado en la URL', async ({
  context,
  page,
}) => {
  await interceptGitHub(page)
  await page.goto('/pilot')
  await expect(page.getByRole('heading', { name: 'Sistema de pilot' })).toBeVisible()
  await expect(page.locator('[data-app-state="exploration"]')).toBeFocused()

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Volver al menú principal' }).click()

  await expect(page.locator('[data-app-state="menu"]')).toBeVisible()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Sistema de pilot' })).toHaveCount(0)
  await expect(page.getByTestId('flight-state')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: /^Ficha de/ })).toHaveCount(0)
  await page.keyboard.press('e')
  await page.waitForTimeout(200)
  expect(context.pages()).toHaveLength(1)

  await page.getByLabel('Usuario de GitHub').fill('navigator')
  await page.getByRole('button', { name: 'Explorar sistema' }).click()

  await expect(page.getByRole('heading', { name: 'Sistema de navigator' })).toBeVisible()
  await expect(page).toHaveURL('/navigator')
  await expect(page.getByLabel('Planeta new-horizons, crystalline')).toBeAttached()
  await expect(page.getByLabel('Planeta typescript-flight, crystalline')).toHaveCount(0)
})
