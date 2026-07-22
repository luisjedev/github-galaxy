import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'

const profile = {
  id: 404,
  login: 'pilot',
  name: 'Galaxy Pilot',
  avatar_url: 'https://avatars.example/pilot.png',
  html_url: 'https://github.com/pilot',
  bio: 'Explorando galaxias de código abierto.',
  followers: 12,
  public_repos: 2,
}

const repositories = [
  {
    id: 1,
    name: 'typescript-flight',
    html_url: 'https://github.com/pilot/typescript-flight',
    description: 'Controles de vuelo para explorar el espacio.',
    fork: false,
    archived: false,
    is_template: false,
    language: 'TypeScript',
    stargazers_count: 10,
    forks_count: 3,
    size: 120,
    updated_at: '2026-01-03T00:00:00Z',
  },
  {
    id: 2,
    name: 'rust-engine',
    html_url: 'https://github.com/pilot/rust-engine',
    description: 'Un motor orbital.',
    fork: false,
    archived: false,
    is_template: false,
    language: 'Rust',
    stargazers_count: 4,
    forks_count: 1,
    size: 80,
    updated_at: '2026-01-02T00:00:00Z',
  },
]

async function interceptGitHub(page: Page, profileRepositories = repositories) {
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    await route.fulfill({
      json: url.pathname.endsWith('/repos') ? profileRepositories : profile,
      headers: { 'access-control-expose-headers': 'Link' },
    })
  })
}

async function interceptDestinations(context: BrowserContext) {
  await context.route('https://github.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>GitHub destination</title>' }),
  )
}

async function expectInformationOutsideAtmosphere(body: Locator) {
  const atmosphereRadius = Number(await body.getAttribute('data-atmosphere-radius'))
  const informationRadius = Number(await body.getAttribute('data-information-radius'))
  expect(informationRadius).toBeGreaterThan(atmosphereRadius)
}

test('muestra la ficha completa de la estrella y E abre el perfil explícitamente', async ({
  context,
  page,
}) => {
  await interceptDestinations(context)
  await interceptGitHub(page, [])
  await page.goto('/?user=pilot')

  const card = page.getByRole('complementary', { name: 'Ficha de Galaxy Pilot' })
  await expect(card).toBeVisible()
  await expectInformationOutsideAtmosphere(page.getByLabel('Estrella de pilot'))
  await expect(card.getByRole('img', { name: 'Avatar de Galaxy Pilot' })).toHaveAttribute(
    'src',
    profile.avatar_url,
  )
  await expect(card).toContainText('Galaxy Pilot')
  await expect(card).toContainText('@pilot')
  await expect(card).toContainText('Explorando galaxias de código abierto.')
  await expect(card).toContainText('12 seguidores')
  await expect(card.getByRole('link', { name: 'Ver perfil en GitHub' })).toHaveAttribute(
    'href',
    profile.html_url,
  )
  await expect(card.getByRole('link', { name: 'Ver perfil en GitHub' })).toHaveAttribute(
    'target',
    '_blank',
  )

  await page.waitForTimeout(300)
  expect(context.pages()).toHaveLength(1)
  const popupPromise = context.waitForEvent('page')
  await page.keyboard.press('e')
  const popup = await popupPromise
  await expect.poll(() => popup.url()).toBe(profile.html_url)
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await popup.close()
})

test('selecciona una única ficha planetaria y solo E abre su repositorio en otra pestaña', async ({
  context,
  page,
}) => {
  await interceptDestinations(context)
  await interceptGitHub(page)
  await page.goto('/?user=pilot')

  const cards = page.getByRole('complementary', { name: /^Ficha de/ })
  const card = page.getByRole('complementary', { name: 'Ficha de typescript-flight' })
  await expect(cards).toHaveCount(1)
  const starCard = page.getByRole('complementary', { name: 'Ficha de Galaxy Pilot' })
  if (await starCard.isVisible()) {
    await page.keyboard.down('w')
    await page.keyboard.down(' ')
    await expect(card).toBeVisible({ timeout: 8_000 })
    await page.keyboard.up(' ')
    await page.keyboard.up('w')
  }

  await expect(cards).toHaveCount(1)
  await expect(card).toBeVisible()
  await expectInformationOutsideAtmosphere(page.locator('[data-repository-id="1"]'))
  await expect(card).toContainText('Controles de vuelo para explorar el espacio.')
  await expect(card).toContainText('TypeScript')
  await expect(card).toContainText('10 estrellas')
  await expect(card).toContainText('3 forks')
  await expect(card).toContainText('120 KB')
  await expect(card.locator('time')).toHaveAttribute('datetime', repositories[0].updated_at)
  await expect(card.getByRole('link', { name: 'Ver repositorio en GitHub' })).toHaveAttribute(
    'href',
    repositories[0].html_url,
  )

  await page.waitForTimeout(300)
  expect(context.pages()).toHaveLength(1)
  await expect(page).toHaveURL(/\?user=pilot$/)

  const popupPromise = context.waitForEvent('page')
  await page.keyboard.press('e')
  const popup = await popupPromise
  await expect.poll(() => popup.url()).toBe(repositories[0].html_url)
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await popup.close()

  await page.keyboard.down('w')
  await page.keyboard.down(' ')
  await expect(cards).toHaveCount(0, { timeout: 6_000 })
  await page.keyboard.up(' ')
  await page.keyboard.up('w')

  await page.keyboard.press('e')
  await page.waitForTimeout(300)
  expect(context.pages()).toHaveLength(1)
  await expect(page).toHaveURL(/\?user=pilot$/)
})
