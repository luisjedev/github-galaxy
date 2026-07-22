import { expect, test, type Page } from '@playwright/test'

const profile = {
  id: 404,
  login: 'pilot',
  name: 'Galaxy Pilot',
  avatar_url: 'https://avatars.example/pilot.png',
  html_url: 'https://github.com/pilot',
  bio: null,
  followers: 12,
  public_repos: 3,
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
  {
    id: 2,
    name: 'rust-engine',
    html_url: 'https://github.com/pilot/rust-engine',
    description: null,
    fork: false,
    archived: false,
    is_template: false,
    language: 'Rust',
    stargazers_count: 4,
    forks_count: 0,
    size: 80,
    updated_at: '2026-01-02T00:00:00Z',
  },
]

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
  const value = await page.getByTestId('flight-state').getAttribute(name)
  return Number(value)
}

test.beforeEach(async ({ page }) => {
  await interceptGitHub(page)
  await page.goto('/pilot')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
})

test('muestra una única nave procedural determinista, la cámara de seguimiento y la ayuda completa', async ({
  page,
}) => {
  const ship = page.getByTestId('player-ship')

  await expect(ship).toHaveCount(1)
  await expect(ship).toHaveAttribute('data-primary-hue', '16')
  await expect(ship).toHaveAttribute('data-accent-hue', '215')
  await expect(ship).toHaveAttribute('data-world-scale', '0.03')
  await expect(ship).toHaveAttribute('data-initial-destination', 'star')
  const outermostOrbitRadius = Math.max(
    ...(await page.locator('[data-orbit-radius]').evaluateAll((orbits) =>
      orbits.map((orbit) => Number(orbit.getAttribute('data-orbit-radius'))),
    )),
  )
  const spawnX = await numberAttribute(page, 'data-x')
  const spawnZ = await numberAttribute(page, 'data-z')
  expect(Math.hypot(spawnX, spawnZ)).toBeCloseTo(outermostOrbitRadius, 2)
  expect(await numberAttribute(page, 'data-altitude')).toBe(7)
  expect(await numberAttribute(page, 'data-heading')).toBeCloseTo(
    Math.atan2(-spawnX, -spawnZ),
    2,
  )
  await expect(
    page.getByRole('img', {
      name: 'Escena tridimensional con cámara automática siguiendo la nave',
    }),
  ).toBeVisible()
  await expect(page.getByText('W / S', { exact: true })).toBeVisible()
  await expect(page.getByText('Avanzar · frenar / reversa', { exact: true })).toBeVisible()
  await expect(page.getByText('A / D', { exact: true })).toBeVisible()
  await expect(page.getByText('Girar a la izquierda · derecha', { exact: true })).toBeVisible()
  await expect(page.getByText('J / K', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Inclinar abajo · arriba (combinar con W / S)', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Espacio', { exact: true })).toBeVisible()
  await expect(page.getByText('E', { exact: true })).toBeVisible()
  await expect(page.getByText('R', { exact: true })).toBeVisible()
  await expect(page.getByText('Esc', { exact: true })).toBeVisible()
})

test('permite avanzar, girar, cambiar altitud y aplicar reversa con teclado', async ({ page }) => {
  const initialX = await numberAttribute(page, 'data-x')
  const initialZ = await numberAttribute(page, 'data-z')
  const initialHeading = await numberAttribute(page, 'data-heading')

  await page.keyboard.down('w')
  await expect
    .poll(
      async () =>
        Math.abs((await numberAttribute(page, 'data-x')) - initialX) +
        Math.abs((await numberAttribute(page, 'data-z')) - initialZ),
    )
    .toBeGreaterThan(0.2)
  await page.keyboard.up('w')

  await page.keyboard.down('a')
  await expect
    .poll(async () => await numberAttribute(page, 'data-heading'))
    .toBeGreaterThan(initialHeading + 0.1)
  await expect.poll(async () => await numberAttribute(page, 'data-bank')).toBeLessThan(-0.05)
  await page.keyboard.up('a')

  const headingAfterLeftTurn = await numberAttribute(page, 'data-heading')
  await page.keyboard.down('d')
  await expect
    .poll(async () => await numberAttribute(page, 'data-heading'))
    .toBeLessThan(headingAfterLeftTurn - 0.1)
  await expect.poll(async () => await numberAttribute(page, 'data-bank')).toBeGreaterThan(0.05)
  await page.keyboard.up('d')

  await page.keyboard.down('k')
  await expect.poll(async () => await numberAttribute(page, 'data-pitch')).toBeLessThan(-0.05)
  const altitudeWhileTiltingUp = await numberAttribute(page, 'data-altitude')
  await page.waitForTimeout(250)
  expect(await numberAttribute(page, 'data-altitude')).toBeCloseTo(altitudeWhileTiltingUp, 2)
  await page.keyboard.down('w')
  await expect
    .poll(async () => await numberAttribute(page, 'data-altitude'))
    .toBeGreaterThan(altitudeWhileTiltingUp)
  await page.keyboard.up('w')
  await page.keyboard.up('k')

  await page.keyboard.down('j')
  await expect.poll(async () => await numberAttribute(page, 'data-pitch')).toBeGreaterThan(0.05)
  const altitudeWhileTiltingDown = await numberAttribute(page, 'data-altitude')
  await page.waitForTimeout(250)
  expect(await numberAttribute(page, 'data-altitude')).toBeCloseTo(altitudeWhileTiltingDown, 2)
  await page.keyboard.down('s')
  await expect
    .poll(async () => await numberAttribute(page, 'data-altitude'))
    .toBeLessThan(altitudeWhileTiltingDown)
  await page.keyboard.up('s')
  await page.keyboard.up('j')

  await page.keyboard.down('s')
  await expect
    .poll(async () => await numberAttribute(page, 'data-speed'), { timeout: 5_000 })
    .toBeLessThan(0)
  await page.keyboard.up('s')
})

test('R devuelve la nave al mismo punto de entrada del sistema', async ({ page }) => {
  const exploration = page.locator('[data-app-state="exploration"]')
  const teleport = page.getByRole('status', { name: 'Secuencia de teletransporte' })
  const initialFlight = {
    x: await numberAttribute(page, 'data-x'),
    z: await numberAttribute(page, 'data-z'),
    altitude: await numberAttribute(page, 'data-altitude'),
    heading: await numberAttribute(page, 'data-heading'),
  }

  await exploration.focus()
  await page.keyboard.down('w')
  await expect
    .poll(
      async () =>
        Math.abs((await numberAttribute(page, 'data-x')) - initialFlight.x) +
        Math.abs((await numberAttribute(page, 'data-z')) - initialFlight.z),
    )
    .toBeGreaterThan(0.5)
  await page.keyboard.up('w')
  await page.keyboard.press('r')

  await expect(teleport).toHaveAttribute('data-teleport-phase', 'charging')
  await expect(teleport).toHaveCount(0, { timeout: 3_000 })
  expect(await numberAttribute(page, 'data-x')).toBeCloseTo(initialFlight.x, 3)
  expect(await numberAttribute(page, 'data-z')).toBeCloseTo(initialFlight.z, 3)
  expect(await numberAttribute(page, 'data-altitude')).toBeCloseTo(initialFlight.altitude, 3)
  expect(await numberAttribute(page, 'data-heading')).toBeCloseTo(initialFlight.heading, 3)
})

test('mantener Espacio activa el turbo sin desplazar el navegador cuando la experiencia tiene foco', async ({
  page,
}) => {
  await page.evaluate(() => {
    document.body.style.height = '300vh'
  })
  await page.locator('[data-app-state="exploration"]').focus()
  const initialScroll = await page.evaluate(() => window.scrollY)
  const initialHeading = await numberAttribute(page, 'data-heading')

  await page.keyboard.down('a')
  await expect
    .poll(async () => await numberAttribute(page, 'data-heading'), { timeout: 8_000 })
    .toBeGreaterThan(initialHeading + 2.5)
  await page.keyboard.up('a')

  await page.keyboard.down('w')
  await page.keyboard.down(' ')
  await expect(page.getByTestId('flight-state')).toHaveAttribute('data-turbo', 'true')
  await expect.poll(async () => await numberAttribute(page, 'data-speed')).toBeGreaterThan(0.5)
  expect(await page.evaluate(() => window.scrollY)).toBe(initialScroll)

  await page.keyboard.up(' ')
  await page.keyboard.up('w')
  await expect(page.getByTestId('flight-state')).toHaveAttribute('data-turbo', 'false')
})
