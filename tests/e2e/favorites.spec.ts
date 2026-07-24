import { expect, test, type Page } from '@playwright/test'

const profiles = {
  pilot: {
    id: 404,
    login: 'pilot',
    name: 'Galaxy Pilot',
    avatar_url: 'https://avatars.example/pilot.png',
    html_url: 'https://github.com/pilot',
    bio: null,
    followers: 12,
    public_repos: 1,
  },
  navigator: {
    id: 505,
    login: 'navigator',
    name: 'Galaxy Navigator',
    avatar_url: 'https://avatars.example/navigator.png',
    html_url: 'https://github.com/navigator',
    bio: null,
    followers: 7,
    public_repos: 1,
  },
}

function repository(id: number, owner: keyof typeof profiles) {
  return {
    id,
    name: `${owner}-world`,
    html_url: `https://github.com/${owner}/${owner}-world`,
    description: `World of ${owner}`,
    fork: false,
    archived: false,
    is_template: false,
    language: owner === 'pilot' ? 'TypeScript' : 'Rust',
    stargazers_count: owner === 'pilot' ? 10 : 20,
    forks_count: 0,
    size: 120,
    updated_at: '2026-01-03T00:00:00Z',
  }
}

async function interceptGitHub(
  page: Page,
  repositories: Partial<Record<keyof typeof profiles, ReturnType<typeof repository>[]>> = {
    pilot: [repository(1, 'pilot')],
    navigator: [repository(2, 'navigator')],
  },
) {
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    const owner = url.pathname.toLowerCase().includes('navigator') ? 'navigator' : 'pilot'
    await route.fulfill({
      json: url.pathname.endsWith('/repos') ? (repositories[owner] ?? []) : profiles[owner],
      headers: { 'access-control-expose-headers': 'Link' },
    })
  })
}

async function installControlledAudioContext(page: Page) {
  await page.addInitScript(() => {
    class ControlledAudioContext {
      currentTime = 0
      sampleRate = 100
      state: AudioContextState = 'suspended'
      destination = {}
      createGain() { return { gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }, connect() {}, disconnect() {} } }
      createOscillator() { return { type: 'sine', frequency: { value: 440, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }, detune: { value: 0 }, connect() {}, disconnect() {}, start() {}, stop() {} } }
      createBiquadFilter() { return { type: 'lowpass', frequency: { value: 440 }, Q: { value: 1 }, connect() {}, disconnect() {} } }
      createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) } }
      createBufferSource() { return { buffer: null, loop: false, connect() {}, disconnect() {}, start() {}, stop() {} } }
      async resume() { this.state = 'running' }
      async close() { this.state = 'closed' }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: ControlledAudioContext })
  })
}

const favoritesState = (page: Page) => page.getByTestId('favorites-state')

test('alterna con F, evita repetición y conserva favoritos globales entre sistemas y recargas', async ({
  page,
}) => {
  await interceptGitHub(page)
  await page.goto('/pilot')
  await expect(page.getByRole('complementary', { name: 'Ficha de pilot-world' })).toBeVisible()

  await page.keyboard.press('f')
  await expect(page.getByRole('status', { name: 'Estado de favoritos' })).toContainText('Añadido a favoritos')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '1')
  await expect(favoritesState(page)).toHaveAttribute('data-active-favorite', 'true')

  await page.reload()
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '1')
  await page.keyboard.press('f')
  await expect(page.getByRole('status', { name: 'Estado de favoritos' })).toContainText('Eliminado de favoritos')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '0')

  await page.keyboard.down('f')
  await page.waitForTimeout(350)
  await page.keyboard.up('f')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '1')

  await page.goto('/navigator')
  await expect(page.getByRole('complementary', { name: 'Ficha de navigator-world' })).toBeVisible()
  await page.keyboard.press('f')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '2')

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gitgalaxy:favorites')!))
  expect(stored.version).toBe(1)
  expect(stored.favorites.map((favorite: { repositoryId: number }) => favorite.repositoryId)).toEqual([2, 1])
})

test('rechaza la estrella y bloquea F durante pausa y teletransporte', async ({ page }) => {
  await interceptGitHub(page, { pilot: [] })
  await page.goto('/pilot')
  await expect(page.getByRole('complementary', { name: 'Ficha de Galaxy Pilot' })).toBeVisible()

  await page.keyboard.press('f')
  await expect(page.getByRole('status', { name: 'Estado de favoritos' })).toContainText(
    'Acércate a un planeta para añadirlo a favoritos',
  )
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '0')

  await page.keyboard.press('Escape')
  await page.keyboard.press('f')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '0')
  await page.keyboard.press('Escape')

  await page.keyboard.press('r')
  await expect(page.getByRole('status', { name: 'Secuencia de teletransporte' })).toBeVisible()
  await page.keyboard.press('f')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '0')
})

test('abre y cierra el menú vacío con M o Esc sin activar pausa y bloquea otros modos', async ({ page }) => {
  await interceptGitHub(page)
  await page.goto('/pilot')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()

  await page.keyboard.down('m')
  await page.keyboard.down('m')
  await page.keyboard.up('m')
  const menu = page.getByRole('dialog', { name: 'Repositorios favoritos' })
  await expect(menu).toBeVisible()
  await expect(menu).toHaveCount(1)
  await expect(menu).toHaveAttribute('data-favorite-count', '0')
  await expect(menu.getByRole('status')).toHaveText('Acércate a un planeta y pulsa F')
  await expect(page.locator('[data-simulation-state="paused"]')).toBeVisible()
  await expect(page.locator('[data-controls-locked="true"]')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Exploración de pilot' })).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Exploración de pilot' })).toBeVisible()
  await page.keyboard.press('m')
  await expect(menu).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.keyboard.press('r')
  await expect(page.getByRole('status', { name: 'Secuencia de teletransporte' })).toBeVisible()
  await page.keyboard.press('m')
  await expect(menu).toHaveCount(0)
})

test('lista snapshots recientes sin red, navega circularmente y recuerda selección con scroll', async ({ page }) => {
  const snapshots = Array.from({ length: 9 }, (_, index) => ({
    repositoryId: index + 10,
    owner: `owner-${index}`,
    name: `repo-${index}`,
    description: `Descripción ${index}`,
    language: index % 2 ? 'Rust' : 'TypeScript',
    stars: index * 11,
    url: `https://github.com/owner-${index}/repo-${index}`,
    addedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  }))
  await page.addInitScript((favorites) => {
    localStorage.setItem('gitgalaxy:favorites', JSON.stringify({ version: 1, favorites }))
  }, snapshots)
  let requests = 0
  await page.route('https://api.github.com/**', async (route) => {
    requests += 1
    const url = new URL(route.request().url())
    await route.fulfill({
      json: url.pathname.endsWith('/repos') ? [repository(1, 'pilot')] : profiles.pilot,
      headers: { 'access-control-expose-headers': 'Link' },
    })
  })
  await page.goto('/pilot')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  const requestsBeforeMenu = requests

  await page.keyboard.press('m')
  const menu = page.getByRole('dialog', { name: 'Repositorios favoritos' })
  const options = menu.getByRole('option')
  await expect(options).toHaveCount(9)
  await expect(options.first()).toContainText('owner-8/repo-8')
  await expect(options.first()).toContainText('Descripción 8')
  await expect(options.first()).toContainText('TypeScript')
  await expect(options.first()).toContainText('88 estrellas')
  expect(requests).toBe(requestsBeforeMenu)

  await page.keyboard.press('k')
  await expect(options.last()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('j')
  await expect(options.first()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.down('j')
  await page.keyboard.down('j')
  await page.keyboard.up('j')
  await expect(options.nth(2)).toHaveAttribute('aria-selected', 'true')
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('j')
  await expect(options.last()).toHaveAttribute('aria-selected', 'true')
  const visibleBounds = await menu.locator('[data-testid="favorites-list"]').evaluate((list) => {
    const selected = list.querySelector('[aria-selected="true"]')!
    const listBox = list.getBoundingClientRect()
    const rowBox = selected.getBoundingClientRect()
    return { top: rowBox.top >= listBox.top, bottom: rowBox.bottom <= listBox.bottom + 1 }
  })
  expect(visibleBounds).toEqual({ top: true, bottom: true })

  await page.keyboard.press('m')
  await page.keyboard.press('m')
  await expect(options.last()).toHaveAttribute('aria-selected', 'true')
})

test('abre y elimina el favorito seleccionado sin filtrar E, F o J/K al vuelo', async ({ page, context }) => {
  const snapshots = [
    { repositoryId: 3, owner: 'third', name: 'world', description: null, language: null, stars: 3, url: 'https://github.com/third/world', addedAt: '2026-03-01T00:00:00Z' },
    { repositoryId: 2, owner: 'second', name: 'world', description: 'Second', language: 'Go', stars: 2, url: 'https://github.com/second/world', addedAt: '2026-02-01T00:00:00Z' },
    { repositoryId: 1, owner: 'pilot', name: 'pilot-world', description: 'Pilot', language: 'TypeScript', stars: 1, url: 'https://github.com/pilot/pilot-world', addedAt: '2026-01-01T00:00:00Z' },
  ]
  await page.addInitScript((favorites) => {
    localStorage.setItem('gitgalaxy:favorites', JSON.stringify({ version: 1, favorites }))
  }, snapshots)
  await interceptGitHub(page)
  await page.goto('/pilot')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  const altitudeBefore = await page.getByTestId('flight-state').getAttribute('data-altitude')
  await page.keyboard.press('m')
  const menu = page.getByRole('dialog', { name: 'Repositorios favoritos' })
  await expect(menu).toBeVisible()

  await page.keyboard.down('j')
  await page.waitForTimeout(120)
  await page.keyboard.up('j')
  await expect(menu.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('flight-state')).toHaveAttribute('data-altitude', altitudeBefore!)

  const popupPromise = context.waitForEvent('page')
  await page.keyboard.down('e')
  await page.keyboard.down('e')
  await page.keyboard.up('e')
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  expect(popup.url()).toBe('https://github.com/second/world')
  expect(await popup.evaluate(() => window.opener)).toBeNull()
  expect(context.pages()).toHaveLength(2)
  await popup.close()
  await expect(menu.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.down('f')
  await page.keyboard.down('f')
  await page.keyboard.up('f')
  await expect(menu).toHaveAttribute('data-favorite-count', '2')
  await expect(menu.getByRole('status', { name: 'Confirmación de favoritos' })).toContainText('Eliminado de favoritos')
  await expect(menu.getByRole('option').nth(1)).toContainText('pilot/pilot-world')
  await expect(menu.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '2')

  await page.keyboard.press('f')
  await page.keyboard.press('f')
  await expect(menu).toHaveAttribute('data-favorite-count', '0')
  await expect(menu.getByRole('status', { name: 'Favoritos vacíos' })).toHaveText('Acércate a un planeta y pulsa F')
  await expect(page.getByRole('complementary', { name: 'Ficha de pilot-world' })).toBeVisible()
})

test('un localStorage corrupto usa memoria, avisa una vez y permite seguir explorando', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('gitgalaxy:favorites', '{invalid'))
  await interceptGitHub(page)
  await page.goto('/pilot')

  await expect(page.getByRole('alert')).toContainText(
    'Los favoritos no podrán conservarse al cerrar esta pestaña',
  )
  await page.keyboard.press('f')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '1')
  await page.keyboard.press('f')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '0')
  await expect(page.getByText('Los favoritos no podrán conservarse al cerrar esta pestaña')).toHaveCount(1)
  expect(await page.evaluate(() => localStorage.getItem('gitgalaxy:favorites'))).toBe('{invalid')
})

test('observa feedback visual y sonoro diferenciado al añadir, quitar y eliminar desde el menú', async ({ page }) => {
  await installControlledAudioContext(page)
  await interceptGitHub(page)
  await page.goto('/pilot')
  await expect(page.getByRole('complementary', { name: 'Ficha de pilot-world' })).toBeVisible()

  await page.keyboard.press('f')
  const effect = page.getByTestId('favorite-effect')
  await expect(effect).toHaveAttribute('data-favorite-action', 'added')
  await expect(effect).toHaveAttribute('data-repository-id', '1')
  await expect(effect).toHaveAttribute('data-favorite-audio', 'ascending')
  await expect(effect).toHaveAttribute('data-favorite-phase', /^(flash|travel)$/)
  await expect(page.getByTestId('favorite-feedback')).toContainText('pilot/pilot-world')
  await expect(effect).toHaveCount(0, { timeout: 2_500 })

  await page.keyboard.press('f')
  await expect(effect).toHaveAttribute('data-favorite-action', 'removed')
  await expect(effect).toHaveAttribute('data-favorite-audio', 'descending')
  await expect(page.getByTestId('favorite-feedback')).toContainText('pilot/pilot-world')
  await expect(effect).toHaveCount(0, { timeout: 2_500 })

  await page.keyboard.press('f')
  await page.keyboard.press('m')
  await page.keyboard.press('f')
  const menu = page.getByRole('dialog', { name: 'Repositorios favoritos' })
  const departing = menu.locator('.favorite-row--departing')
  await expect(menu).toHaveAttribute('data-favorite-count', '0')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gitgalaxy:favorites')!).favorites)).toEqual([])
  await expect(departing).toHaveAttribute('data-favorite-phase', /^(flash|collapse)$/)
  await expect(departing).toHaveAttribute('data-favorite-audio', 'descending')
  await expect(menu.getByRole('status', { name: 'Confirmación de favoritos' })).toContainText('pilot/pilot-world')
  await expect(departing).toHaveCount(0, { timeout: 2_500 })
})

test('el silencio suprime la señal y el movimiento reducido conserva la confirmación', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installControlledAudioContext(page)
  await interceptGitHub(page)
  await page.goto('/pilot')
  const audioControl = page.getByTestId('audio-control')
  await audioControl.click()
  await expect(audioControl).toHaveAttribute('data-audio-state', 'active')
  await audioControl.click()
  await expect(audioControl).toHaveAttribute('data-audio-state', 'muted')

  await page.keyboard.press('f')
  const effect = page.getByTestId('favorite-effect')
  await expect(effect).toHaveAttribute('data-favorite-audio', 'muted')
  await expect(effect).toHaveClass(/favorite-planet-effect--reduced-motion/)
  await expect(effect.locator('.favorite-planet-effect__energy')).toHaveCSS('display', 'none')
  await expect(page.getByTestId('favorite-feedback')).toContainText('Añadido a favoritos')
  await expect(favoritesState(page)).toHaveAttribute('data-favorite-count', '1')
})
