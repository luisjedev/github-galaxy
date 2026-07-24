import { expect, test, type Page } from '@playwright/test'

const profile = {
  id: 4242,
  login: 'cockpit-pilot',
  name: 'Cockpit Pilot',
  avatar_url: 'https://avatars.example/cockpit-pilot.png',
  html_url: 'https://github.com/cockpit-pilot',
  bio: null,
  followers: 12,
  public_repos: 0,
}

async function openCockpit(page: Page) {
  await page.route('https://api.github.com/**', async (route) => {
    await route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith('/repos') ? [] : profile,
      headers: { 'access-control-expose-headers': 'Link' },
    })
  })
  await page.goto(`/${profile.login}`)
  const experience = page.locator('[data-app-state="exploration"]')
  await expect(experience).toBeVisible()
  await experience.focus()
  await page.keyboard.press('c')
  await expect(page.getByTestId('active-camera')).toHaveAttribute('data-camera-mode', 'first-person')
}

test('la primera persona presenta una cabina procedural completa y sin ocupante', async ({ page }) => {
  await openCockpit(page)

  const cockpit = page.getByTestId('cockpit')
  const ship = page.getByTestId('player-ship')
  await expect(cockpit).toBeVisible()
  await expect(cockpit).toHaveAttribute('data-cockpit-components', 'glass,frames,dashboard,controls,nose,wings')
  await expect(cockpit).toHaveAttribute('data-interior-coverage', '0.28')
  await expect(cockpit).toHaveAttribute('data-exterior-composition', 'controlled')
  await expect(cockpit).toHaveAttribute('data-occupant', 'none')
  await expect(cockpit).toHaveAttribute('data-primary-hue', await ship.getAttribute('data-primary-hue') ?? '')
  await expect(cockpit).toHaveAttribute('data-accent-hue', await ship.getAttribute('data-accent-hue') ?? '')

  const quality = await page.getByTestId('active-camera').getAttribute('data-visual-quality')
  await expect(cockpit).toHaveAttribute('data-geometry-detail', quality === 'normal' ? 'full' : 'simplified')
  await expect(page.getByTestId('exterior-ship-state')).toHaveAttribute('data-visible', 'false')
})

test('los instrumentos reaccionan al vuelo y sustituyen el HUD exterior', async ({ page }) => {
  await openCockpit(page)

  const cockpit = page.getByTestId('cockpit')
  const flight = page.getByTestId('flight-state')
  await expect(cockpit).toHaveAttribute('data-speed', '0.0')
  await expect(cockpit).toHaveAttribute('data-altitude', '7')
  await expect(cockpit).toHaveAttribute('data-turbo', 'idle')
  await expect(flight).toHaveAttribute('data-presentation', 'instrumentation-only')
  await expect(page.locator('.flight-hud__readout')).toBeHidden()

  await page.keyboard.down('w')
  await page.keyboard.down('k')
  await expect.poll(async () => Number(await cockpit.getAttribute('data-speed'))).toBeGreaterThan(0.3)
  await expect.poll(async () => Number(await cockpit.getAttribute('data-altitude'))).toBeGreaterThan(7)
  await page.keyboard.down(' ')
  await expect(cockpit).toHaveAttribute('data-turbo', 'active')
  await page.keyboard.up(' ')
  await page.keyboard.up('k')
  await page.keyboard.up('w')

  await expect(page.getByRole('heading', { name: `Sistema de ${profile.login}` })).toBeVisible()
  await expect(page.locator('.celestial-markers')).toBeAttached()
  await expect(page.locator('[data-star-guide]')).toBeAttached()
})

test('la tercera persona conserva la nave y el HUD actuales', async ({ page }) => {
  await openCockpit(page)
  await page.keyboard.press('c')

  await expect(page.getByTestId('active-camera')).toHaveAttribute('data-camera-mode', 'third-person')
  await expect(page.getByTestId('cockpit')).toBeHidden()
  await expect(page.getByTestId('exterior-ship-state')).toHaveAttribute('data-visible', 'true')
  await expect(page.getByTestId('flight-state')).toHaveAttribute('data-presentation', 'exterior-hud')
  await expect(page.locator('.flight-hud__readout')).toBeVisible()
})
