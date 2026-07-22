import { expect, test } from '@playwright/test'

const profile = {
  id: 101,
  login: 'stargazer',
  name: 'Stella Voyager',
  avatar_url: 'https://avatars.example/stargazer.png',
  html_url: 'https://github.com/stargazer',
  bio: 'Explorando código',
  followers: 42,
  public_repos: 0,
}

test('un usuario inexistente se puede corregir o reintentar sin guardar el fallo', async ({ page }) => {
  let profileRequests = 0

  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/users/missing-user') {
      profileRequests += 1
      if (profileRequests === 1) {
        await route.fulfill({ status: 404, json: { message: 'Not Found' } })
      } else {
        await route.fulfill({ json: { ...profile, login: 'missing-user' } })
      }
      return
    }

    await route.fulfill({ json: [] })
  })

  await page.goto('/?user=missing-user')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('No existe el usuario “missing-user”')
  await expect(alert).toContainText('Comprueba el nombre')
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Volver al menú' })).toBeVisible()

  await page.getByRole('button', { name: 'Reintentar' }).click()

  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  expect(profileRequests).toBe(2)
})

test('un límite de solicitudes explica cuándo reintentar y la API pública utilizada', async ({
  page,
}) => {
  let profileRequests = 0
  await page.addInitScript(() => {
    Date.now = () => 2_000_000_000_000
  })

  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/users/stargazer') {
      profileRequests += 1
      if (profileRequests === 1) {
        await route.fulfill({
          status: 403,
          json: { message: 'API rate limit exceeded' },
          headers: {
            'access-control-expose-headers':
              'X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '2000000120',
            'retry-after': '120',
          },
        })
      } else {
        await route.fulfill({ json: profile })
      }
      return
    }

    await route.fulfill({ json: [] })
  })

  await page.goto('/?user=stargazer')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('GitHub ha limitado temporalmente las solicitudes')
  await expect(alert).toContainText('unos 2 minutos')
  await expect(alert).toContainText('API pública de GitHub sin autenticación')
  await expect(page.getByLabel(/token/i)).toHaveCount(0)

  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  expect(profileRequests).toBe(2)
})

test('un fallo de red muestra un estado recuperable distinto y permite reintentar', async ({
  page,
}) => {
  let profileRequests = 0

  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/users/stargazer') {
      profileRequests += 1
      if (profileRequests === 1) {
        await route.abort('internetdisconnected')
      } else {
        await route.fulfill({ json: profile })
      }
      return
    }

    await route.fulfill({ json: [] })
  })

  await page.goto('/?user=stargazer')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('No hemos podido conectar con GitHub')
  await expect(alert).toContainText('Revisa tu conexión')
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Volver al menú' })).toBeVisible()

  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  expect(profileRequests).toBe(2)
})

test('rechaza nombres vacíos o inválidos sin quedarse cargando y permite corregirlos', async ({
  page,
}) => {
  let apiRequests = 0
  await page.route('https://api.github.com/**', async (route) => {
    apiRequests += 1
    const url = new URL(route.request().url())
    await route.fulfill({ json: url.pathname.endsWith('/repos') ? [] : profile })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Explorar sistema' }).click()
  await expect(page.getByText('Escribe un nombre de usuario de GitHub.')).toBeVisible()
  await expect(page.locator('[data-app-state="loading"]')).toHaveCount(0)

  await page.getByLabel('Usuario de GitHub').fill('-nombre--inválido!')
  await page.getByRole('button', { name: 'Explorar sistema' }).click()
  await expect(page.getByText(/solo puede contener letras, números y guiones/i)).toBeVisible()
  expect(apiRequests).toBe(0)

  await page.getByLabel('Usuario de GitHub').fill('stargazer')
  await page.getByRole('button', { name: 'Explorar sistema' }).click()
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
})

test('una respuesta incompleta no se guarda en caché y se recupera con datos válidos', async ({
  page,
}) => {
  let profileRequests = 0

  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/users/stargazer') {
      profileRequests += 1
      await route.fulfill({
        json: profileRequests === 1 ? { ...profile, id: undefined } : profile,
      })
      return
    }

    await route.fulfill({ json: [] })
  })

  await page.goto('/?user=stargazer')

  await expect(page.getByRole('alert')).toContainText('GitHub ha devuelto un error')
  const cachedKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith('gitgalaxy:github-system')),
  )
  expect(cachedKeys).toEqual([])

  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.locator('[data-app-state="exploration"]')).toBeVisible()
  expect(profileRequests).toBe(2)
})

test('un fallo de la API permite volver al menú y corregir el usuario', async ({ page }) => {
  await page.route('https://api.github.com/**', async (route) => {
    await route.fulfill({ status: 500, json: { message: 'Internal Server Error' } })
  })

  await page.goto('/?user=stargazer')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('GitHub ha devuelto un error')
  await expect(alert).toContainText('problema temporal de la API')

  await page.getByRole('button', { name: 'Volver al menú' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByLabel('Usuario de GitHub')).toBeVisible()
})
