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

test('el turbo se detiene ante la atmósfera sin rebote y la nave puede separarse', async ({
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
  await page.keyboard.down(' ')

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
  expect(Math.hypot(contactX, contactZ)).toBeGreaterThanOrEqual(collisionRadius - 0.01)
  expect(contactZ).toBeLessThan(0)

  await page.waitForTimeout(500)
  expect(await numberAttribute(page, 'data-x')).toBeCloseTo(contactX, 1)
  expect(await numberAttribute(page, 'data-z')).toBeCloseTo(contactZ, 1)
  expect(await numberAttribute(page, 'data-speed')).toBe(0)

  await page.keyboard.up(' ')
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

test('los planetas orbitales aplican el mismo límite atmosférico', async ({ page }) => {
  await interceptGitHub(page, repositories)
  await page.goto('/?user=pilot')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()

  await page.keyboard.down('w')
  await page.keyboard.down(' ')

  const warning = page.getByRole('alert', { name: 'Peligro atmosférico' })
  await expect(warning).toBeVisible()
  await expect(page.getByTestId('flight-state')).toHaveAttribute(
    'data-atmosphere-contact',
    'planet:1',
  )
  await expect.poll(async () => await numberAttribute(page, 'data-speed')).toBe(0)

  const contactX = await numberAttribute(page, 'data-x')
  await page.keyboard.up(' ')
  await page.keyboard.up('w')
  await page.keyboard.down('s')
  await expect
    .poll(async () => await numberAttribute(page, 'data-x'))
    .toBeLessThan(contactX - 0.1)
  await page.keyboard.up('s')
  await expect(warning).toBeVisible()
})
