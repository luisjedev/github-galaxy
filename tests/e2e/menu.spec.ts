import { expect, test } from '@playwright/test'

test('presenta GitGalaxy, los requisitos y los controles de teclado', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'GitGalaxy', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pilota tu nave. Descubre sistemas.' })).toBeVisible()
  await expect(page.getByLabel('Tu usuario de GitHub')).toBeVisible()
  await expect(page.getByText(/viaja a los sistemas de otros usuarios/i)).toBeVisible()
  const exploreButton = page.getByRole('button', { name: 'Explorar sistema' })
  const randomButton = page.getByRole('button', { name: 'Visitar un sistema aleatorio' })
  await expect(exploreButton).toBeVisible()
  await expect(randomButton).toBeVisible()
  const [exploreBox, randomBox] = await Promise.all([
    exploreButton.boundingBox(),
    randomButton.boundingBox(),
  ])
  expect(exploreBox!.y).toBe(randomBox!.y)
  expect(exploreBox!.width).toBeCloseTo(randomBox!.width, 0)
  await expect(page.getByText(/experiencia de escritorio con teclado/i)).toBeVisible()
  await expect(page.getByText('W / S', { exact: true })).toBeVisible()
  await expect(page.getByText('A / D')).toBeVisible()
  await expect(page.getByText('J / K')).toBeVisible()
  await expect(page.getByText('Espacio')).toBeVisible()
  await expect(page.getByText('E', { exact: true })).toBeVisible()
  await expect(page.getByText('F', { exact: true })).toBeVisible()
  await expect(page.getByText('R', { exact: true })).toBeVisible()
  await expect(page.getByText('Esc', { exact: true })).toBeVisible()
  await expect(page.getByText(/táctil/i)).toHaveCount(0)
  await expect(page.getByText(/API pública de GitHub sin autenticación/i)).toBeVisible()
  await expect(page.getByText(/límite de solicitudes/i)).toBeVisible()
  await expect(page.getByLabel(/token/i)).toHaveCount(0)
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
  ).toBe(true)

  const heroHeader = page.locator('.hero__header')
  const brand = heroHeader.getByLabel('GitGalaxy')
  const credit = heroHeader.getByLabel('Créditos de autor')
  await expect(brand).toBeVisible()
  await expect(credit).toBeVisible()
  const [brandBox, creditBox] = await Promise.all([brand.boundingBox(), credit.boundingBox()])
  expect(creditBox!.x).toBeGreaterThan(brandBox!.x + brandBox!.width)
  await expect(credit).toContainText('Done with')
  await expect(credit).toContainText('by @luisjedev')
  await expect(credit.getByRole('img', { name: 'amor' })).toBeVisible()
  await expect(credit.getByRole('link', { name: 'GitHub de @luisjedev' })).toHaveAttribute(
    'href',
    'https://github.com/luisjedev',
  )
  await expect(credit.getByRole('link', { name: 'LinkedIn de @luisjedev' })).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/luisjedev/',
  )
})

test('permite continuar con Enter y expone el estado de carga', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Usuario de GitHub').fill('octocat')
  await page.getByLabel('Usuario de GitHub').press('Enter')

  await expect(page.getByRole('status')).toContainText('Preparando el sistema de octocat')
})

test('permite continuar con el botón principal', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Usuario de GitHub').fill('torvalds')
  await page.getByRole('button', { name: 'Explorar sistema' }).click()

  await expect(page.getByRole('status')).toContainText('Preparando el sistema de torvalds')
})

test('permite despegar directamente hacia un sistema aleatorio', async ({ page }) => {
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/search/users') {
      await route.fulfill({
        json: {
          total_count: 1,
          incomplete_results: false,
          items: [{ login: 'random-pilot' }],
        },
      })
      return
    }

    await route.fulfill({
      json: url.pathname.endsWith('/repos')
        ? []
        : {
            id: 42,
            login: 'random-pilot',
            name: 'Random Pilot',
            avatar_url: 'https://avatars.example/random-pilot.png',
            html_url: 'https://github.com/random-pilot',
            bio: null,
            followers: 7,
            public_repos: 15,
          },
      headers: { 'access-control-expose-headers': 'Link' },
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Visitar un sistema aleatorio' }).click()

  await expect(page.getByRole('status')).toContainText('Buscando un sistema aleatorio')
  await expect(page.locator('[data-app-state="exploration"]')).toHaveAttribute(
    'data-origin-user',
    'random-pilot',
  )
  await expect(page).toHaveURL(/\/random-pilot$/)
})
