import { expect, test, type Page, type Route } from '@playwright/test'

function profile(login: string, id: number) {
  return {
    id,
    login,
    name: `${login} pilot`,
    avatar_url: `https://avatars.example/${login}.png`,
    html_url: `https://github.com/${login}`,
    bio: null,
    followers: 7,
    public_repos: 15,
  }
}

const origin = profile('camera-pilot', 301)
const destination = profile('camera-destination', 302)

async function fulfillSystemRoute(route: Route, login: string) {
  const url = new URL(route.request().url())
  await route.fulfill({
    json: url.pathname.endsWith('/repos')
      ? []
      : login === origin.login
        ? origin
        : destination,
    headers: { 'access-control-expose-headers': 'Link' },
  })
}

async function interceptGitHub(page: Page) {
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/search/users') {
      await route.fulfill({
        json: {
          total_count: 1,
          incomplete_results: false,
          items: [{ login: destination.login }],
        },
      })
      return
    }
    await fulfillSystemRoute(
      route,
      url.pathname.toLowerCase().includes(destination.login) ? destination.login : origin.login,
    )
  })
}

const camera = (page: Page) => page.getByTestId('active-camera')

async function flightSnapshot(page: Page) {
  return page.getByTestId('flight-state').evaluate((element) => ({
    x: element.getAttribute('data-x'),
    z: element.getAttribute('data-z'),
    altitude: element.getAttribute('data-altitude'),
    heading: element.getAttribute('data-heading'),
    bank: element.getAttribute('data-bank'),
    pitch: element.getAttribute('data-pitch'),
    speed: element.getAttribute('data-speed'),
    turbo: element.getAttribute('data-turbo'),
  }))
}

test.beforeEach(async ({ page }) => {
  await interceptGitHub(page)
  await page.goto(`/${origin.login}`)
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
})

test('C alterna la cámara sin modificar el vuelo y las repeticiones se ignoran', async ({ page }) => {
  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'third-person')
  await expect(page.getByText('C', { exact: true })).toBeVisible()
  await expect(page.getByText('Cambiar cámara', { exact: true })).toBeVisible()
  const before = await flightSnapshot(page)

  const transitionStartedAt = Date.now()
  await page.keyboard.press('c')

  await expect(camera(page)).toHaveAttribute('data-camera-transition', 'active')
  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'first-person')
  await expect(camera(page)).toHaveAttribute('data-camera-transition-ms', '400')
  await expect(camera(page)).toHaveAttribute('data-camera-attitude-scale', '0.3')
  expect(await flightSnapshot(page)).toEqual(before)
  await expect(camera(page)).toHaveAttribute('data-camera-transition', 'idle', { timeout: 1_000 })
  const transitionDuration = Date.now() - transitionStartedAt
  expect(transitionDuration).toBeGreaterThanOrEqual(300)
  // Playwright's attribute polling may observe completion after the 400 ms render transition.
  expect(transitionDuration).toBeLessThan(1_200)

  await page.locator('[data-app-state="exploration"]').dispatchEvent('keydown', {
    key: 'c',
    repeat: true,
    bubbles: true,
  })
  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'first-person')

  await page.keyboard.press('c')
  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'third-person')
})

test('marcadores y guía de la estrella responden a la cámara activa', async ({ page }) => {
  const starMarker = page.locator('[data-marker-body="star"]')
  await expect(starMarker).toHaveAttribute('data-marker-status', 'visible')
  await page.keyboard.press('c')
  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'first-person')

  await page.keyboard.down('a')
  await expect
    .poll(async () => Number(await page.getByTestId('flight-state').getAttribute('data-heading')), {
      timeout: 8_000,
    })
    .toBeGreaterThan(2.5)
  await page.keyboard.up('a')

  await expect(starMarker).toHaveAttribute('data-marker-status', 'behind')
  await expect(page.locator('[data-star-guide]')).toHaveAttribute('data-guide-status', 'visible')
})

test('el cambio es inmediato con movimiento reducido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()

  await page.keyboard.press('c')

  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'first-person')
  await expect(camera(page)).toHaveAttribute('data-camera-transition-ms', '0')
  await expect(camera(page)).toHaveAttribute('data-camera-transition', 'idle')
})

test('C queda bloqueada con pausa, favoritos y teletransporte', async ({ page }) => {
  await page.keyboard.press('Escape')
  await page.keyboard.press('c')
  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'third-person')
  await page.keyboard.press('Escape')

  await page.keyboard.press('m')
  await expect(page.getByRole('dialog', { name: 'Repositorios favoritos' })).toBeVisible()
  await page.keyboard.press('c')
  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'third-person')
  await page.keyboard.press('m')

  await page.keyboard.press('r')
  await expect(page.getByRole('status', { name: 'Secuencia de teletransporte' })).toBeVisible()
  await page.keyboard.press('c')
  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'third-person')
})

test('la cámara elegida sobrevive a un viaje y una sesión nueva empieza en tercera persona', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await page.keyboard.press('c')
  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'first-person')

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Usar agujero de gusano' }).click()
  await page.keyboard.press('c')
  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'first-person')
  await expect(page).toHaveURL(new RegExp(`/${destination.login}$`), { timeout: 4_000 })
  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'first-person')

  await page.reload()
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await expect(camera(page)).toHaveAttribute('data-camera-mode', 'third-person')
})
