import { expect, test, type Page } from '@playwright/test'

const profile = {
  id: 404,
  login: 'navigator',
  name: 'Galaxy Navigator',
  avatar_url: 'https://avatars.example/navigator.png',
  html_url: 'https://github.com/navigator',
  bio: null,
  followers: 12,
  public_repos: 8,
}

const repositories = Array.from({ length: 8 }, (_, index) => {
  const id = index + 1
  return {
    id,
    name: `destination-${id}`,
    html_url: `https://github.com/navigator/destination-${id}`,
    description: null,
    fork: false,
    archived: false,
    is_template: false,
    language: id % 2 === 0 ? 'Rust' : 'TypeScript',
    stargazers_count: 90 - index * 10,
    forks_count: 0,
    size: 80 + id * 10,
    updated_at: `2026-01-${String(9 - id).padStart(2, '0')}T00:00:00Z`,
  }
})

async function interceptGitHub(page: Page) {
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    await route.fulfill({
      json: url.pathname.endsWith('/repos') ? repositories : profile,
      headers: { 'access-control-expose-headers': 'Link' },
    })
  })
}

async function numberAttribute(page: Page, name: string) {
  return Number(await page.getByTestId('flight-state').getAttribute(name))
}

test.beforeEach(async ({ page }) => {
  await interceptGitHub(page)
  await page.goto('/?user=navigator')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
})

test('la guía señala la estrella fuera de pantalla y se retira cuando vuelve a verse', async ({
  page,
}) => {
  const guide = page.locator('[data-star-guide]')
  await expect(guide).toHaveCount(1)

  await page.keyboard.down('a')
  await expect
    .poll(async () => guide.getAttribute('data-guide-status'), { timeout: 8_000 })
    .toBe('visible')
  await page.keyboard.up('a')
  await expect(guide).toHaveAttribute('data-guide-direction', /right/)
  await expect(guide).toHaveAccessibleName(/derecha/)
  await expect(guide).toBeVisible()
  const { guideScreenX, guideScreenY, guideAngle } = await guide.evaluate((element) => ({
    guideScreenX: Number(element.getAttribute('data-screen-x')),
    guideScreenY: Number(element.getAttribute('data-screen-y')),
    guideAngle: Number(element.getAttribute('data-guide-angle')),
  }))
  const viewport = page.viewportSize()!
  const positionAngle =
    (Math.atan2(
      (guideScreenY - 50) * viewport.height,
      (guideScreenX - 50) * viewport.width,
    ) *
      180) /
    Math.PI
  expect(guideScreenX).toBeGreaterThanOrEqual(90)
  expect(guideAngle).toBeCloseTo(positionAngle, 0)

  await page.keyboard.down('a')
  await expect.poll(async () => numberAttribute(page, 'data-heading')).toBeGreaterThan(Math.PI)
  await page.keyboard.up('a')
  await page.waitForTimeout(600)
  await expect(guide).toHaveAttribute('data-star-status', 'behind')
  await expect(guide).toHaveAttribute('data-guide-direction', /^(left|right)$/)

  await page.keyboard.down('d')
  await expect
    .poll(async () => guide.getAttribute('data-guide-status'), { timeout: 8_000 })
    .toBe('hidden')
  await page.keyboard.up('d')
  await expect(guide).toBeHidden()

  await page.keyboard.down('d')
  await expect
    .poll(async () => guide.getAttribute('data-guide-status'), { timeout: 8_000 })
    .toBe('visible')
  await page.keyboard.up('d')
  await expect(guide).toHaveAttribute('data-guide-direction', /left/)
  await expect(guide).toHaveAccessibleName(/izquierda/)
  await expect(guide).toBeVisible()
  expect(Number(await guide.getAttribute('data-screen-x'))).toBeLessThanOrEqual(10)
})

test('mantiene pocos marcadores actualizados y oculta los cuerpos detrás de la cámara', async ({
  page,
}) => {
  const markers = page.locator('[data-marker-body]')
  await expect.poll(async () => markers.count()).toBeGreaterThan(0)
  expect(await markers.count()).toBeLessThanOrEqual(6)
  await expect(page.locator('[data-marker-body="star"]')).toHaveCount(1)

  await expect
    .poll(async () => page.locator('[data-marker-status="visible"]').count())
    .toBeGreaterThan(0)

  const viewport = page.viewportSize()
  const visibleBoxes = await page.locator('[data-marker-status="visible"]').evaluateAll(
    (elements) => elements.map((element) => element.getBoundingClientRect().toJSON()),
  )
  expect(viewport).not.toBeNull()
  expect(
    visibleBoxes.every(
      ({ x, y, width, height }) =>
        x >= 0 &&
        y >= 0 &&
        x + width <= viewport!.width &&
        y + height <= viewport!.height,
    ),
  ).toBe(true)

  await expect
    .poll(async () => page.locator('[data-marker-status="visible"][data-marker-body^="planet:"]').count())
    .toBeGreaterThan(0)
  const trackedPlanet = page
    .locator('[data-marker-status="visible"][data-marker-body^="planet:"]')
    .first()
  const initialScreenX = Number(await trackedPlanet.getAttribute('data-screen-x'))
  const initialScreenY = Number(await trackedPlanet.getAttribute('data-screen-y'))
  await expect
    .poll(async () => {
      const screenX = Number(await trackedPlanet.getAttribute('data-screen-x'))
      const screenY = Number(await trackedPlanet.getAttribute('data-screen-y'))
      return Math.abs(screenX - initialScreenX) + Math.abs(screenY - initialScreenY)
    })
    .toBeGreaterThan(0.01)

  const initialHeading = await numberAttribute(page, 'data-heading')
  await page.keyboard.down('a')
  await expect
    .poll(async () => numberAttribute(page, 'data-heading'))
    .toBeGreaterThan(initialHeading + 2.8)
  await page.keyboard.up('a')

  await expect
    .poll(async () => page.locator('[data-marker-status="behind"]').count())
    .toBeGreaterThan(0)
  expect(
    await page.locator('[data-marker-status="behind"]').evaluateAll((elements) =>
      elements.every(
        (element) => element.hasAttribute('hidden') && getComputedStyle(element).display === 'none',
      ),
    ),
  ).toBe(true)
})
