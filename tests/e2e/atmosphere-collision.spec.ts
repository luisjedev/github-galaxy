import { expect, test, type Page } from '@playwright/test'

const profile = {
  id: 404,
  login: 'pilot',
  name: 'Galaxy Pilot',
  avatar_url: 'https://avatars.example/pilot.png',
  html_url: 'https://github.com/pilot',
  bio: null,
  followers: 12,
  public_repos: 0,
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

async function interceptGitHub(page: Page, profileRepositories: typeof repositories = []) {
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    await route.fulfill({
      json: url.pathname.endsWith('/repos') ? profileRepositories : profile,
      headers: { 'access-control-expose-headers': 'Link' },
    })
  })
}

async function numberAttribute(page: Page, name: string) {
  const value = await page.getByTestId('flight-state').getAttribute(name)
  return Number(value)
}

test('el avance descendente se detiene ante la atmósfera y la nave puede separarse', async ({
  page,
}) => {
  await interceptGitHub(page)
  await page.goto('/?user=pilot')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()

  const star = page.getByLabel('Estrella de pilot')
  const atmosphereRadius = Number(await star.getAttribute('data-atmosphere-radius'))
  const collisionRadius = Number(await star.getAttribute('data-collision-radius'))
  const bodyRadius = Number(await star.getAttribute('data-body-radius'))
  expect(collisionRadius - bodyRadius).toBeLessThanOrEqual(0.25)
  expect(atmosphereRadius).toBeGreaterThan(collisionRadius)

  await page.keyboard.down('w')
  await page.keyboard.down('j')

  const warning = page.getByRole('alert', { name: 'Peligro atmosférico' })
  await expect(warning).toContainText('La nave no está preparada para atravesar la atmósfera', {
    timeout: 10_000,
  })
  await expect(page.getByTestId('flight-state')).toHaveAttribute(
    'data-atmosphere-contact',
    'star',
  )

  await expect.poll(async () => await numberAttribute(page, 'data-speed')).toBe(0)
  const contactX = await numberAttribute(page, 'data-x')
  const contactZ = await numberAttribute(page, 'data-z')
  const contactAltitude = await numberAttribute(page, 'data-altitude')
  expect(Math.hypot(contactX, contactAltitude, contactZ)).toBeGreaterThanOrEqual(
    collisionRadius - 0.01,
  )
  expect(contactZ).toBeLessThan(0)

  await page.waitForTimeout(500)
  expect(
    Math.hypot(
      await numberAttribute(page, 'data-x'),
      await numberAttribute(page, 'data-altitude'),
      await numberAttribute(page, 'data-z'),
    ),
  ).toBeGreaterThanOrEqual(collisionRadius - 0.01)
  expect(await numberAttribute(page, 'data-speed')).toBe(0)

  await page.keyboard.up('j')
  await page.keyboard.up('w')
  await page.keyboard.down('s')
  await expect
    .poll(async () => await numberAttribute(page, 'data-z'))
    .toBeLessThan(contactZ - 0.2)
  await expect(page.getByTestId('flight-state')).toHaveAttribute(
    'data-atmosphere-contact',
    'none',
    { timeout: 15_000 },
  )
  await page.keyboard.up('s')

  await expect(warning).toHaveCount(0)
})

test('el respawn sobre la última órbita queda fuera de la atmósfera planetaria', async ({
  page,
}) => {
  await interceptGitHub(page, repositories)
  await page.goto('/?user=pilot')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()

  const planet = page.locator('[data-repository-id="1"]')
  const orbitRadius = Number(await planet.getAttribute('data-orbit-radius'))
  const collisionRadius = Number(await planet.getAttribute('data-collision-radius'))
  const atmosphereRadius = Number(await planet.getAttribute('data-atmosphere-radius'))
  const spawnX = await numberAttribute(page, 'data-x')
  const spawnZ = await numberAttribute(page, 'data-z')

  expect(Math.hypot(spawnX, spawnZ)).toBeCloseTo(orbitRadius, 2)
  expect(await numberAttribute(page, 'data-altitude')).toBe(7)
  expect(atmosphereRadius).toBeGreaterThan(collisionRadius)
  await expect(page.getByTestId('flight-state')).toHaveAttribute(
    'data-atmosphere-contact',
    'none',
  )
  await expect(page.getByRole('alert', { name: 'Peligro atmosférico' })).toHaveCount(0)
})
