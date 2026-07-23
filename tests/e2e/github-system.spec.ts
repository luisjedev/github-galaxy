import { expect, test, type Page } from '@playwright/test'

const profile = {
  id: 101,
  login: 'stargazer',
  name: 'Stella Voyager',
  avatar_url: 'https://avatars.example/stargazer.png',
  html_url: 'https://github.com/stargazer',
  bio: 'Explorando código',
  followers: 42,
  public_repos: 101,
}

function repository(id: number) {
  return {
    id,
    name: `project-${id}`,
    html_url: `https://github.com/stargazer/project-${id}`,
    description: null,
    fork: false,
    archived: false,
    is_template: false,
    language: 'TypeScript',
    stargazers_count: id,
    forks_count: 0,
    size: 100,
    updated_at: '2026-01-01T00:00:00Z',
  }
}

async function interceptGitHub(page: Page, repositories = [repository(1)]) {
  const requests: URL[] = []

  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)

    if (url.pathname.toLowerCase() === '/users/stargazer') {
      await new Promise((resolve) => setTimeout(resolve, 100))
      await route.fulfill({ json: profile })
      return
    }

    const pageNumber = Number(url.searchParams.get('page'))
    const start = (pageNumber - 1) * 100
    const pageRepositories = repositories.slice(start, start + 100)
    const headers: Record<string, string> = {
      'access-control-expose-headers': 'Link',
    }
    if (start + 100 < repositories.length) {
      headers.link = `<https://api.github.com/users/stargazer/repos?type=owner&per_page=100&page=${pageNumber + 1}>; rel="next"`
    }

    await route.fulfill({ json: pageRepositories, headers })
  })

  return requests
}

test('abre directamente desde la URL un perfil sin repositorios como estrella solitaria', async ({
  page,
}) => {
  const requests = await interceptGitHub(page, [{ ...repository(1), fork: true }])

  await page.goto('/stargazer')

  await expect(page.getByLabel('Usuario de GitHub')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('Consultando el perfil público de stargazer')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await expect(page.getByText('0 proyectos públicos encontrados')).toHaveCount(0)
  await expect(page.getByText('Una estrella solitaria espera tu visita.')).toBeVisible()
  expect(requests.some((url) => url.pathname === '/users/stargazer')).toBe(true)
  expect(requests.some((url) => url.pathname === '/users/stargazer/repos')).toBe(true)
})

test('reutiliza la caché durante quince minutos y refresca los datos al expirar', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const clockStart = 2_000_000_000_000
    Date.now = () =>
      localStorage.getItem('gitgalaxy-test-expired')
        ? clockStart + 15 * 60 * 1_000 + 1
        : clockStart
  })
  const requests = await interceptGitHub(page)

  await page.goto('/stargazer')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  const initialSeed = await page.getByLabel('Estrella de stargazer').getAttribute('data-star-seed')
  expect(requests).toHaveLength(2)

  await page.reload()
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await expect(page.getByLabel('Estrella de stargazer')).toHaveAttribute(
    'data-star-seed',
    initialSeed!,
  )
  expect(requests).toHaveLength(2)

  await page.evaluate(() => localStorage.setItem('gitgalaxy-test-expired', 'true'))
  await page.reload()
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  expect(requests).toHaveLength(4)
})

test('representa una escena sembrada con biomas y estados procedurales distinguibles', async ({
  page,
}, testInfo) => {
  await interceptGitHub(page, [
    { ...repository(1), language: 'TypeScript' },
    { ...repository(2), language: null },
    { ...repository(3), language: 'Python', archived: true },
    { ...repository(4), language: 'JavaScript', size: 0 },
    { ...repository(5), language: 'TypeScript', is_template: true },
  ])

  await page.goto('/stargazer')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()

  const normal = page.locator('[data-repository-id="1"] .procedural-planet')
  const neutral = page.locator('[data-repository-id="2"] .procedural-planet')
  const archived = page.locator('[data-repository-id="3"] .procedural-planet')
  const empty = page.locator('[data-repository-id="4"] .procedural-planet')
  const template = page.locator('[data-repository-id="5"] .procedural-planet')

  await expect(normal).toHaveAttribute('data-biome', 'crystalline')
  await expect(normal).toHaveAttribute('data-surface-feature', 'facets')
  await expect(normal).toHaveAttribute('data-surface-seed', /\d+/)
  await expect(normal).toHaveAttribute('data-stars', '1')
  await expect(normal).toHaveAttribute('data-forks', '0')
  await expect(neutral).toHaveAttribute('data-appearance-state', 'neutral')
  await expect(neutral).toHaveAttribute('data-biome', 'rocky')
  await expect(archived).toHaveAttribute('data-appearance-state', 'archived')
  await expect(archived).toHaveAttribute('data-biome', 'dead')
  await expect(empty).toHaveAttribute('data-size-state', 'empty')
  await expect(template).toHaveAttribute('data-template', 'true')
  await expect(template.locator('.planet-ring')).toHaveCount(1)
  expect(await normal.getAttribute('data-surface-seed')).not.toBe(
    await template.getAttribute('data-surface-seed'),
  )

  const star = page.getByLabel('Estrella de stargazer')
  await expect(star).toHaveAttribute('data-primary-hue', '38')
  await expect(star).toHaveAttribute('data-language-families', 'typescript,javascript,python')
  await expect(star).toHaveAttribute('data-stellar-palette', 'solar')
  await expect(star).toHaveAttribute('data-visual-atmosphere', 'none')

  const scene = page.getByRole('img', {
    name: 'Escena tridimensional con cámara automática siguiendo la nave',
  })
  const starSeed = await star.getAttribute('data-star-seed')
  await expect(scene).toHaveAttribute('data-visual-seed', starSeed!)
  await expect(scene).toHaveAttribute('data-visual-quality', /normal|reduced/)
  await expect(scene).toHaveAttribute('data-star-count', /240|960/)
  await expect(scene).toHaveAttribute('data-dust-count', /32|120/)
  await expect(scene).toHaveAttribute('data-nebula-count', /[2-4]/)
  await expect(scene).toHaveAttribute('data-distant-galaxy-count', /[2-6]/)
  await expect(scene).toHaveAttribute('data-moon-count', /\d+/)
  await expect(scene).toHaveAttribute('data-ring-count', /[1-5]/)
  await expect(scene).toHaveAttribute('data-artificial-object-count', /\d+/)
  await expect(scene).toHaveAttribute('data-inner-rock-cluster-count', /[1-4]/)
  await expect(scene).toHaveAttribute('data-asteroid-count', /96|320/)
  await expect(scene).toHaveAttribute('data-shooting-star-event-count', /0|8/)

  const sceneDetails = await scene.evaluate((element) => ({
    quality: element.getAttribute('data-visual-quality'),
    moons: Number(element.getAttribute('data-moon-count')),
    asteroids: Number(element.getAttribute('data-asteroid-count')),
    shootingStars: Number(element.getAttribute('data-shooting-star-event-count')),
    beltInnerRadius: Number(element.getAttribute('data-asteroid-belt-inner-radius')),
  }))
  expect(sceneDetails.moons).toBeGreaterThanOrEqual(5)
  expect(sceneDetails.asteroids).toBe(sceneDetails.quality === 'normal' ? 320 : 96)
  expect(sceneDetails.shootingStars).toBe(sceneDetails.quality === 'normal' ? 8 : 0)
  const furthestPlanetSurface = await page.locator('.planet-orbit').evaluateAll((orbits) =>
    Math.max(...orbits.map((orbit) =>
      Number(orbit.getAttribute('data-orbit-radius')) +
      Number(orbit.getAttribute('data-planet-radius')),
    )),
  )
  expect(sceneDetails.beltInnerRadius).toBeGreaterThan(furthestPlanetSurface)

  await testInfo.attach('composicion-sembrada.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
})

test('reduce parpadeo, pulsaciones y partículas cuando el sistema solicita menos movimiento', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await interceptGitHub(page)

  await page.goto('/stargazer')

  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await expect(
    page.getByRole('img', {
      name: 'Escena tridimensional con cámara automática siguiendo la nave',
    }),
  ).toHaveAttribute('data-reduced-motion', 'true')
})

test('carga y comparte desde el menú un sistema obtenido de todas las páginas de GitHub', async ({
  page,
}) => {
  const requests = await interceptGitHub(
    page,
    Array.from({ length: 101 }, (_, index) => repository(index + 1)),
  )

  await page.goto('/')
  await page.getByLabel('Usuario de GitHub').fill('StarGazer')
  await page.getByRole('button', { name: 'Explorar sistema' }).click()

  await expect(page).toHaveURL(/\/StarGazer$/)
  await expect(page.getByRole('status')).toContainText('Consultando el perfil público de StarGazer')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await expect(page).toHaveURL(/\/stargazer$/)
  await expect(page.getByRole('heading', { name: 'Sistema de stargazer' })).toBeVisible()
  await expect(page.getByLabel('Estrella de stargazer')).toHaveAttribute('data-star-seed', /\d+/)
  await expect(page.getByText('101 proyectos públicos encontrados')).toHaveCount(0)
  await expect(page.locator('[data-celestial-body="planet"]')).toHaveCount(20)
  await expect(page.locator('[data-repository-id="101"]')).toHaveCount(1)
  await expect(page.locator('[data-repository-id="81"]')).toHaveCount(0)

  const orbitGeometry = await page.locator('.planet-orbit').evaluateAll((orbits) =>
    orbits
      .map((orbit) => ({
        orbitRadius: Number(orbit.getAttribute('data-orbit-radius')),
        planetRadius: Number(orbit.getAttribute('data-planet-radius')),
      }))
      .sort((left, right) => left.orbitRadius - right.orbitRadius),
  )
  for (let index = 1; index < orbitGeometry.length; index += 1) {
    const inner = orbitGeometry[index - 1]
    const outer = orbitGeometry[index]
    const visibleGap =
      outer.orbitRadius - inner.orbitRadius - outer.planetRadius - inner.planetRadius
    expect(visibleGap).toBeGreaterThanOrEqual(0)
  }

  const repositoryRequests = requests.filter((url) => url.pathname.endsWith('/repos'))
  expect(repositoryRequests).toHaveLength(2)
  expect(repositoryRequests.map((url) => url.searchParams.get('page'))).toEqual(['1', '2'])
  expect(repositoryRequests.every((url) => url.searchParams.get('per_page') === '100')).toBe(true)
  expect(repositoryRequests.every((url) => url.searchParams.get('type') === 'owner')).toBe(true)
})
