import { expect, test, type Page, type Route } from '@playwright/test'

function profile(login: string, id: number, publicRepos = 15) {
  return {
    id,
    login,
    name: `${login} explorer`,
    avatar_url: `https://avatars.example/${login}.png`,
    html_url: `https://github.com/${login}`,
    bio: null,
    followers: 3,
    public_repos: publicRepos,
  }
}

const origin = profile('origin-pilot', 101, 20)
const destination = profile('destination-pilot', 202, 18)

async function flightNumber(page: Page, attribute: string) {
  return Number(await page.getByTestId('flight-state').getAttribute(attribute))
}

async function crossSystemBoundary(page: Page) {
  const experience = page.locator('[data-app-state="exploration"]')
  await experience.focus()
  await page.keyboard.down('a')
  await expect
    .poll(() => flightNumber(page, 'data-heading'), { timeout: 8_000 })
    .toBeGreaterThan(3)
  await page.keyboard.up('a')
  await page.keyboard.down('w')
  await page.keyboard.down(' ')
  await expect(
    page.getByRole('dialog', { name: 'Estás saliendo del sistema solar' }),
  ).toBeVisible({ timeout: 10_000 })
  await page.keyboard.up(' ')
  await page.keyboard.up('w')
}

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

test('cruzar el cinturón abre una sola decisión, bloquea controles y quedarse no usa Search', async ({
  page,
}) => {
  let searchRequests = 0
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/search/users') searchRequests += 1
    await fulfillSystemRoute(route, origin.login)
  })

  await page.goto(`/${origin.login}`)
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  const spawn = {
    x: await flightNumber(page, 'data-x'),
    z: await flightNumber(page, 'data-z'),
    heading: await flightNumber(page, 'data-heading'),
  }

  await crossSystemBoundary(page)
  const decision = page.getByRole('dialog', { name: 'Estás saliendo del sistema solar' })
  await expect(decision).toHaveCount(1)
  await expect(page.locator('[data-app-state="exploration"]')).toHaveAttribute(
    'data-controls-locked',
    'true',
  )
  await expect(page.getByTestId('flight-state')).toHaveAttribute('data-speed', '0.000')
  await expect(page.locator('.celestial-card:not(.system-exit-dialog)')).toHaveCount(0)

  await page.keyboard.press('m')
  await expect(page.getByRole('dialog', { name: 'Repositorios favoritos' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.keyboard.press('r')
  await page.keyboard.press('e')
  await page.keyboard.down('w')
  await page.waitForTimeout(200)
  await page.keyboard.up('w')
  await expect(decision).toHaveCount(1)
  await expect(page.locator('[data-app-state="pause"]')).toHaveCount(0)
  await expect(page.getByTestId('flight-state')).toHaveAttribute('data-speed', '0.000')

  await page.getByRole('button', { name: 'Quedarme en este sistema' }).click()
  await expect(decision).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`/${origin.login}$`))
  expect(searchRequests).toBe(0)
  expect(await flightNumber(page, 'data-x')).toBeCloseTo(spawn.x, 3)
  expect(await flightNumber(page, 'data-z')).toBeCloseTo(spawn.z, 3)
  expect(await flightNumber(page, 'data-heading')).toBeCloseTo(spawn.heading, 3)
})

test('el menú de pausa permite usar el agujero de gusano sin pilotar hasta el límite', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let searchRequests = 0
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/search/users') {
      searchRequests += 1
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

  await page.goto(`/${origin.login}`)
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await page.keyboard.press('Escape')

  const pauseMenu = page.getByRole('dialog', { name: `Exploración de ${origin.login}` })
  const wormholeButton = pauseMenu.getByRole('button', { name: 'Usar agujero de gusano' })
  await expect(wormholeButton).toBeVisible()
  await expect(pauseMenu.getByRole('button', { name: /audio/i })).toHaveCount(0)
  await wormholeButton.click()

  await expect(pauseMenu).toHaveCount(0)
  await expect(page.getByRole('status', { name: 'Viaje por el agujero de gusano' })).toBeVisible()
  await page.keyboard.press('m')
  await expect(page.getByRole('dialog', { name: 'Repositorios favoritos' })).toHaveCount(0)
  await expect(page.locator('[data-app-state="exploration"]')).toHaveAttribute(
    'data-controls-locked',
    'true',
  )
  await expect(page).toHaveURL(new RegExp(`/${destination.login}$`), { timeout: 4_000 })
  await expect(page.getByRole('heading', { name: `Sistema de ${destination.login}` })).toBeVisible()
  expect(searchRequests).toBe(1)
})

test('viajar consulta Search, mantiene el túnel hasta cargar y llega al respawn compartible', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let releaseRepositories!: () => void
  const repositoriesReady = new Promise<void>((resolve) => {
    releaseRepositories = resolve
  })
  const searchUrls: URL[] = []

  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/search/users') {
      searchUrls.push(url)
      await route.fulfill({
        json: {
          total_count: 1,
          incomplete_results: false,
          items: [{ login: destination.login }],
        },
      })
      return
    }
    if (url.pathname === `/users/${destination.login}/repos`) {
      await repositoriesReady
    }
    await fulfillSystemRoute(
      route,
      url.pathname.toLowerCase().includes(destination.login) ? destination.login : origin.login,
    )
  })

  await page.goto(`/${origin.login}`)
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  const audioControl = page.getByTestId('audio-control')
  await audioControl.click()
  await expect(audioControl).toHaveAttribute('data-audio-state', 'active')
  await audioControl.click()
  await expect(audioControl).toHaveAttribute('data-audio-state', 'muted')
  await crossSystemBoundary(page)
  const startedAt = Date.now()
  await page.getByRole('button', { name: 'Atravesar el agujero de gusano' }).click()

  const tunnel = page.getByRole('status', { name: 'Viaje por el agujero de gusano' })
  await expect(tunnel).toBeVisible()
  await expect(tunnel).toHaveClass(/wormhole-overlay--reduced-motion/)
  await expect(page.getByTestId('wormhole-ship')).toBeVisible()
  await expect(page.getByTestId('audio-reactivity')).toHaveAttribute('data-audio-cue', 'muted')
  await expect.poll(() => searchUrls.length).toBe(1)
  expect(searchUrls[0].searchParams.get('q')).toBe('type:user repos:>=15')
  expect(searchUrls[0].searchParams.get('per_page')).toBe('100')
  expect(searchUrls[0].searchParams.get('page')).toBe('1')

  await page.keyboard.press('Escape')
  await page.keyboard.press('r')
  await page.keyboard.press('e')
  await page.waitForTimeout(800)
  await expect(tunnel).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/${origin.login}$`))

  await testInfo.attach('tunel-agujero-de-gusano.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  releaseRepositories()

  await expect(page).toHaveURL(new RegExp(`/${destination.login}$`), {
    timeout: 4_000,
  })
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(700)
  await expect(page.getByRole('heading', { name: `Sistema de ${destination.login}` })).toBeVisible()
  await expect(page.locator('[data-origin-user]')).toHaveAttribute(
    'data-origin-user',
    destination.login,
  )
  await expect(page.getByTestId('flight-state')).toHaveAttribute('data-speed', '0.000')
  expect(await flightNumber(page, 'data-z')).toBeCloseTo(-10, 3)
})

test('fallos de red y rate limit conservan el origen y ofrecen reintentar o quedarse', async ({
  page,
}) => {
  let searches = 0
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/search/users') {
      searches += 1
      if (searches === 1) {
        await route.abort('internetdisconnected')
      } else {
        await route.fulfill({
          status: 403,
          json: { message: 'API rate limit exceeded' },
          headers: {
            'access-control-expose-headers': 'X-RateLimit-Remaining, Retry-After',
            'x-ratelimit-remaining': '0',
            'retry-after': '60',
          },
        })
      }
      return
    }
    await fulfillSystemRoute(route, origin.login)
  })

  await page.goto(`/${origin.login}`)
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await crossSystemBoundary(page)
  await page.getByRole('button', { name: 'Atravesar el agujero de gusano' }).click()

  const errorDialog = page.getByRole('dialog')
  await expect(errorDialog).toContainText('Se ha perdido la conexión durante el viaje')
  await expect(page).toHaveURL(new RegExp(`/${origin.login}$`))
  await expect(page.getByTestId('flight-state')).toHaveAttribute('data-speed', '0.000')

  await page.getByRole('button', { name: 'Reintentar el viaje' }).click()
  await expect(errorDialog).toContainText('GitHub Search ha limitado el viaje')
  await expect(errorDialog).toContainText('1 minuto')
  expect(searches).toBe(2)

  await page.getByRole('button', { name: 'Quedarme en este sistema' }).click()
  await expect(errorDialog).toHaveCount(0)
  await expect(page.locator('[data-app-state="exploration"]')).toHaveAttribute(
    'data-controls-locked',
    'false',
  )
  await expect(page).toHaveURL(new RegExp(`/${origin.login}$`))
})

test('un candidato actual repetido agota intentos sin viajes superpuestos y permite reintentar', async ({
  page,
}) => {
  let travelAttempts = 0
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/search/users') {
      travelAttempts += 1
      await route.fulfill({
        json: {
          total_count: 1,
          incomplete_results: false,
          items: [{ login: travelAttempts === 1 ? origin.login.toUpperCase() : destination.login }],
        },
      })
      return
    }
    await fulfillSystemRoute(
      route,
      url.pathname.toLowerCase().includes(destination.login) ? destination.login : origin.login,
    )
  })

  await page.goto(`/${origin.login}`)
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await crossSystemBoundary(page)
  const travelButton = page.getByRole('button', { name: 'Atravesar el agujero de gusano' })
  await travelButton.dblclick()

  const errorDialog = page.getByRole('dialog')
  await expect(errorDialog).toContainText('No hemos podido confirmar un destino distinto')
  expect(travelAttempts).toBe(1)
  await page.getByRole('button', { name: 'Reintentar el viaje' }).click()
  await expect(page).toHaveURL(new RegExp(`/${destination.login}$`), {
    timeout: 4_000,
  })
  expect(travelAttempts).toBe(2)
})
