import { expect, test } from '@playwright/test'

test('un dispositivo móvil recibe un aviso sin controles táctiles', async ({ browser }) => {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()

  await page.goto('/')

  await expect(page.getByRole('alert')).toContainText('GitGalaxy requiere un ordenador de escritorio y teclado')
  await expect(page.getByRole('button')).toHaveCount(0)
  await expect(page.getByText(/controles táctiles/i)).toContainText('no ofrece controles táctiles')

  await context.close()
})

test('un navegador sin WebGL recibe una explicación comprensible', async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...args: unknown[]
    ) {
      if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
        return null
      }

      return originalGetContext.call(this, contextId as '2d', ...args)
    } as typeof HTMLCanvasElement.prototype.getContext
  })

  await page.goto('/')

  await expect(page.getByRole('alert')).toContainText('WebGL no está disponible')
  await expect(page.getByText(/actualiza tu navegador o activa la aceleración gráfica/i)).toBeVisible()
  await expect(page.getByRole('button')).toHaveCount(0)
})
