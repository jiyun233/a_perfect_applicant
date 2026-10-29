import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE_URL || 'http://127.0.0.1:5173'
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const outDir = path.resolve('screenshots')
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: chrome, headless: true })
const errors = []
const consoleMessages = []

async function newPage(viewport = { width: 1440, height: 1200 }) {
  const page = await browser.newPage({ viewport, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`)
      consoleMessages.push(message.text())
    }
  })
  return page
}

const page = await newPage()
await page.goto(`${base}/#/booking`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
console.log('TITLE', await page.title())
console.log('BOOKING_TEXT', (await page.locator('body').innerText()).slice(0, 500).replaceAll('\n', ' | '))
await page.screenshot({ path: path.join(outDir, 'booking.png'), fullPage: true })

await page.getByRole('button', { name: '新建预约' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: path.join(outDir, 'booking-dialog.png'), fullPage: false })
const dialogText = (await page.locator('[role="dialog"]').innerText()).slice(0, 300)
console.log('DIALOG_TEXT', dialogText.replaceAll('\n', ' | '))
await page.keyboard.press('Escape')

await page.goto(`${base}/#/machines`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
console.log('MACHINES_TEXT', (await page.locator('body').innerText()).slice(0, 500).replaceAll('\n', ' | '))
await page.screenshot({ path: path.join(outDir, 'machines.png'), fullPage: true })

const mobile = await newPage({ width: 390, height: 844 })
await mobile.goto(`${base}/#/booking`, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(900)
await mobile.screenshot({ path: path.join(outDir, 'booking-mobile.png'), fullPage: true })

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const admin = await newPage()
  await admin.goto(`${base}/#/admin/login`, { waitUntil: 'networkidle' })
  await admin.fill('#admin-email', process.env.ADMIN_EMAIL)
  await admin.fill('#admin-password', process.env.ADMIN_PASSWORD)
  await admin.screenshot({ path: path.join(outDir, 'admin-login.png'), fullPage: true })
  await admin.click('button[type="submit"]')
  await admin.waitForURL(/#\/admin\/dashboard/, { timeout: 10_000 })
  await admin.waitForTimeout(4000)
  console.log('ADMIN_DASHBOARD', (await admin.locator('body').innerText()).slice(0, 500).replaceAll('\n', ' | '))
  await admin.screenshot({ path: path.join(outDir, 'admin-dashboard.png'), fullPage: true })
  await admin.goto(`${base}/#/admin/machines`, { waitUntil: 'networkidle' })
  await admin.waitForTimeout(700)
  await admin.screenshot({ path: path.join(outDir, 'admin-machines.png'), fullPage: true })
  await admin.goto(`${base}/#/admin/reservations`, { waitUntil: 'networkidle' })
  await admin.waitForTimeout(700)
  await admin.screenshot({ path: path.join(outDir, 'admin-reservations.png'), fullPage: true })
}

await browser.close()

if (errors.length) {
  console.error('BROWSER_ERRORS')
  for (const error of errors) console.error(error)
  process.exitCode = 1
} else {
  console.log('BROWSER_OK')
}
