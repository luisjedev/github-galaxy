import { expect, test } from '@playwright/test'

test('presenta GitGalaxy, los requisitos y los controles de teclado', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'GitGalaxy', exact: true })).toBeVisible()
  await expect(page.getByLabel('Usuario de GitHub')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Explorar sistema' })).toBeVisible()
  await expect(page.getByText(/experiencia de escritorio con teclado/i)).toBeVisible()
  await expect(page.getByText('W / S')).toBeVisible()
  await expect(page.getByText('A / D')).toBeVisible()
  await expect(page.getByText('J / K')).toBeVisible()
  await expect(page.getByText('Espacio')).toBeVisible()
  await expect(page.getByText('E', { exact: true })).toBeVisible()
  await expect(page.getByText('R', { exact: true })).toBeVisible()
  await expect(page.getByText('Esc', { exact: true })).toBeVisible()
  await expect(page.getByText(/táctil/i)).toHaveCount(0)
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
