import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE_URL || 'http://127.0.0.1:5173'
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const outDir = path.resolve('screenshots')
fs.mkdirSync(outDir, { recursive: true })
const code = `ui-${Date.now().toString().slice(-6)}`
const machineName = `UI Test ${code}`

const browser = await chromium.launch({ executablePath: chrome, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

await page.goto(`${base}/#/admin/login`, { waitUntil: 'networkidle' })
await page.fill('#admin-email', process.env.ADMIN_EMAIL || '')
await page.fill('#admin-password', process.env.ADMIN_PASSWORD || '')
await page.getByRole('button', { name: '登录' }).click()
await page.waitForURL(/#\/admin\/dashboard/, { timeout: 10_000 })
await page.goto(`${base}/#/admin/machines`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: '新增' }).click()
await page.locator('#machine-code').fill(code)
await page.locator('#machine-name').fill(machineName)
await page.locator('#machine-game').fill('Test Game')
await page.locator('#machine-version').fill('v0.1')
await page.locator('#machine-model').fill('Test Cabinet')
await page.locator('#machine-location').fill('测试区')
await page.locator('#machine-capacity').fill('2')
await page.screenshot({ path: path.join(outDir, 'admin-machine-create.png') })
await page.getByRole('button', { name: '创建' }).click()
await page.getByText('机台已创建').waitFor({ timeout: 10_000 })
await page.waitForTimeout(800)

const row = page.locator('tr').filter({ hasText: machineName }).first()
await row.waitFor({ timeout: 10_000 })
await row.getByRole('button', { name: '状态' }).click()
const statusDialog = page.locator('[role="dialog"]')
await statusDialog.getByRole('button', { name: /游玩中/ }).click()
await statusDialog.locator('#status-players').fill('1')
await statusDialog.locator('#status-song').fill('UI Test Song')
await statusDialog.locator('#status-chart').fill('EXPERT 12')
await page.screenshot({ path: path.join(outDir, 'admin-machine-status.png') })
await statusDialog.getByRole('button', { name: '保存' }).click()
await page.getByText('机台状态已更新').waitFor({ timeout: 10_000 })
await page.waitForTimeout(800)

await row.getByRole('button', { name: '编辑' }).click()
const editDialog = page.locator('[role="dialog"]')
await editDialog.locator('#machine-version').fill('v0.2')
await editDialog.getByRole('button', { name: '保存' }).click()
await page.getByText('机台信息已更新').waitFor({ timeout: 10_000 })
await page.waitForTimeout(800)
const rowText = await row.innerText()
console.log('ROW_HAS_VERSION', rowText.includes('v0.2'))
console.log('ROW_HAS_PLAYING', rowText.includes('游玩中'))
await page.screenshot({ path: path.join(outDir, 'admin-machine-updated.png'), fullPage: true })

// Deactivate the test machine so it does not appear in public booking.
await row.getByRole('button', { name: '编辑' }).click()
await page.locator('[role="dialog"]').getByRole('button', { name: /机台启用中/ }).click()
await page.locator('[role="dialog"]').getByRole('button', { name: '保存' }).click()
await page.getByText('机台信息已更新').waitFor({ timeout: 10_000 })
console.log('TEST_MACHINE', code, machineName)

// Mobile admin layout.
const mobile = await context.newPage()
await mobile.setViewportSize({ width: 390, height: 844 })
await mobile.goto(`${base}/#/admin/dashboard`, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(1000)
await mobile.screenshot({ path: path.join(outDir, 'admin-mobile.png'), fullPage: true })

await browser.close()
if (errors.length) {
  console.error('BROWSER_ERRORS')
  for (const error of errors) console.error(error)
  process.exitCode = 1
} else {
  console.log('BROWSER_OK')
}
