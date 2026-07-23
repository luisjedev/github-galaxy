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

async function interceptGitHub(page: Page) {
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    await route.fulfill({
      json: url.pathname.endsWith('/repos') ? [] : profile,
      headers: { 'access-control-expose-headers': 'Link' },
    })
  })
}

async function installFailingAudioContext(page: Page) {
  await page.addInitScript(() => {
    class FailingAudioContext {
      constructor() {
        throw new Error('Audio device unavailable')
      }
    }
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FailingAudioContext,
    })
  })
}

async function installControlledAudioContext(page: Page) {
  await page.addInitScript(() => {
    const audioState = { constructions: 0, resumes: 0 }
    Object.defineProperty(window, '__audioTestState', { value: audioState })

    class ControlledAudioContext {
      currentTime = 0
      state: AudioContextState = 'suspended'
      destination = {}

      constructor() {
        audioState.constructions += 1
      }

      createGain() {
        return {
          gain: {
            value: 1,
            cancelScheduledValues() {},
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
            setTargetAtTime() {},
          },
          connect() {},
          disconnect() {},
        }
      }

      createOscillator() {
        return {
          type: 'sine',
          frequency: {
            value: 440,
            cancelScheduledValues() {},
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
            setTargetAtTime() {},
          },
          detune: { value: 0 },
          connect() {},
          disconnect() {},
          start() {},
          stop() {},
        }
      }

      createBiquadFilter() {
        return {
          type: 'lowpass',
          frequency: { value: 440 },
          Q: { value: 1 },
          connect() {},
          disconnect() {},
        }
      }

      createBuffer(channels: number, length: number) {
        return {
          getChannelData: () => new Float32Array(length),
          numberOfChannels: channels,
        }
      }

      createBufferSource() {
        return {
          buffer: null,
          loop: false,
          connect() {},
          disconnect() {},
          start() {},
          stop() {},
        }
      }

      async resume() {
        audioState.resumes += 1
        this.state = 'running'
      }
    }

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: ControlledAudioContext,
    })
  })
}

test('una entrada directa activa el audio por defecto con la primera interacción', async ({
  page,
}) => {
  await installControlledAudioContext(page)
  await interceptGitHub(page)
  await page.goto('/pilot')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()

  await expect(page.getByTestId('audio-control')).toHaveAttribute('data-audio-state', 'waiting')
  expect(
    await page.evaluate(() =>
      (window as Window & { __audioTestState: { constructions: number } }).__audioTestState
        .constructions,
    ),
  ).toBe(0)

  const audioReactivity = page.getByTestId('audio-reactivity')
  await expect(audioReactivity).toHaveAttribute('data-proximity-state', 'active')
  await page.locator('[data-app-state="exploration"]').focus()
  await page.keyboard.down('w')

  await expect(page.getByTestId('audio-control')).toHaveAttribute('data-audio-state', 'active')
  expect(
    await page.evaluate(() =>
      (window as Window & { __audioTestState: { constructions: number; resumes: number } })
        .__audioTestState,
    ),
  ).toEqual({ constructions: 1, resumes: 1 })
  await expect(audioReactivity).toHaveAttribute('data-engine-state', 'active')
  await page.keyboard.down(' ')
  await expect(audioReactivity).toHaveAttribute('data-turbo-state', 'active')
  await expect(audioReactivity).toHaveAttribute('data-audio-cue', 'turbo')
  await page.keyboard.up(' ')
  await page.keyboard.up('w')
})

test('Explorar activa el paisaje sonoro desde la interacción explícita del menú', async ({
  page,
}) => {
  await installControlledAudioContext(page)
  await interceptGitHub(page)
  await page.goto('/')
  expect(
    await page.evaluate(() =>
      (window as Window & { __audioTestState: { constructions: number } }).__audioTestState
        .constructions,
    ),
  ).toBe(0)

  await page.getByLabel('Usuario de GitHub').fill('pilot')
  await page.getByRole('button', { name: 'Explorar sistema' }).click()

  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await expect(page.getByTestId('audio-control')).toHaveAttribute('data-audio-state', 'active')
})

test('el silencio global se conserva al pausar y al cargar otro sistema', async ({ page }) => {
  await installControlledAudioContext(page)
  await interceptGitHub(page)
  await page.goto('/pilot')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()

  const audioControl = page.getByTestId('audio-control')
  await page.getByRole('button', { name: 'Activar audio' }).click()
  await page.getByRole('button', { name: 'Silenciar audio' }).click()
  await expect(audioControl).toHaveAttribute('data-audio-state', 'muted')
  await expect(audioControl).toHaveAccessibleName('Activar audio')

  await page.locator('[data-app-state="exploration"]').focus()
  await page.keyboard.press('Escape')
  const pauseMenu = page.getByRole('dialog', { name: 'Exploración de pilot' })
  await expect(page.locator('[data-app-state="pause"]')).toBeVisible()
  await expect(pauseMenu.getByRole('button', { name: 'Usar agujero de gusano' })).toBeVisible()
  await expect(pauseMenu.getByRole('button', { name: /audio/i })).toHaveCount(0)
  await expect(audioControl).toHaveAttribute('data-audio-state', 'muted')
  await page.getByRole('button', { name: 'Volver al menú principal' }).click()

  await page.getByLabel('Usuario de GitHub').fill('pilot')
  await page.getByRole('button', { name: 'Explorar sistema' }).click()
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  await expect(audioControl).toHaveAttribute('data-audio-state', 'muted')
})

test('un fallo de AudioContext no impide explorar ni usar el control global', async ({ page }) => {
  await installFailingAudioContext(page)
  await interceptGitHub(page)
  await page.goto('/pilot')
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()

  await page.getByRole('button', { name: 'Activar audio' }).click()

  await expect(page.getByTestId('audio-control')).toHaveAttribute(
    'data-audio-state',
    'unavailable',
  )
  await expect(page.getByRole('button', { name: 'Audio no disponible' })).toBeDisabled()
  await expect(page.getByTestId('flight-state')).toBeVisible()
})

test('la carga y el salto de teletransporte exponen señales sonoras sincronizadas', async ({
  page,
}) => {
  await installControlledAudioContext(page)
  await interceptGitHub(page)
  await page.goto('/pilot')
  const exploration = page.locator('[data-app-state="exploration"]')
  const flight = page.getByTestId('flight-state')
  await expect(exploration).toBeVisible()
  await page.getByRole('button', { name: 'Activar audio' }).click()
  await exploration.focus()

  const initialHeading = Number(await flight.getAttribute('data-heading'))
  await page.keyboard.down('a')
  await expect
    .poll(async () => Number(await flight.getAttribute('data-heading')), { timeout: 8_000 })
    .toBeGreaterThan(initialHeading + 2.8)
  await page.keyboard.up('a')
  await page.keyboard.down('w')
  await page.keyboard.down(' ')
  await expect.poll(async () => Number(await flight.getAttribute('data-speed'))).toBeGreaterThan(1)
  await page.waitForTimeout(500)
  await page.keyboard.up(' ')
  await page.keyboard.up('w')

  await page.keyboard.press('r')

  const teleport = page.getByRole('status', { name: 'Secuencia de teletransporte' })
  await expect(teleport).toHaveAttribute('data-teleport-phase', 'charging')
  await expect(page.getByTestId('audio-reactivity')).toHaveAttribute(
    'data-audio-cue',
    'teleport-charge',
  )
  const positionDuringCharge = {
    x: await flight.getAttribute('data-x'),
    z: await flight.getAttribute('data-z'),
  }
  await page.waitForTimeout(350)
  await expect(flight).toHaveAttribute('data-x', positionDuringCharge.x!)
  await expect(flight).toHaveAttribute('data-z', positionDuringCharge.z!)

  await expect(teleport).toHaveAttribute('data-teleport-phase', 'jump', { timeout: 2_000 })
  await expect(page.getByTestId('audio-reactivity')).toHaveAttribute(
    'data-audio-cue',
    'teleport-jump',
  )
  await expect(teleport).toHaveCount(0, { timeout: 2_000 })
  await expect(flight).toHaveAttribute('data-x', '0.000')
  await expect(flight).toHaveAttribute('data-z', '-10.000')
  await expect(flight).toHaveAttribute('data-altitude', '7.000')
})
