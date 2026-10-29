import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE_URL || 'http://127.0.0.1:4173'
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const outDir = path.resolve('screenshots')
fs.mkdirSync(outDir, { recursive: true })

const tomorrow = new Date(Date.now() + 86400000)
const tomorrowLabel = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
})
  .format(tomorrow)
  .replace('/', '.')

const browser = await chromium.launch({ executablePath: chrome, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  colorScheme: 'light',
})
const errors = []
context.on('page', (page) => {
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
})

async function gradientCount(page) {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('*')].filter((element) => {
        const background = getComputedStyle(element).backgroundImage
        return background && background.includes('gradient')
      }).length,
  )
}

const page = await context.newPage()
await page.goto(`${base}/#/booking`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const tomorrowChip = page.getByTestId('date-chip').filter({ hasText: tomorrowLabel }).first()
if (await tomorrowChip.count()) {
  await tomorrowChip.click()
  await page.waitForTimeout(700)
}
console.log('LIGHT_GRADIENTS', await gradientCount(page))
await page.screenshot({ path: path.join(outDir, 'booking-light.png'), fullPage: true })

const toggle = page.getByRole('button', { name: '切换到深色模式' })
await toggle.click()
await page.waitForTimeout(500)
const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
console.log('THEME_DARK_APPLIED', isDark)
console.log('DARK_GRADIENTS', await gradientCount(page))
await page.screenshot({ path: path.join(outDir, 'booking-dark.png'), fullPage: true })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(700)
console.log('THEME_PERSISTED', await page.evaluate(() => document.documentElement.classList.contains('dark')))

await page.goto(`${base}/#/machines`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
console.log('MACHINES_GRADIENTS', await gradientCount(page))
await page.screenshot({ path: path.join(outDir, 'machines-dark.png'), fullPage: true })

// Mobile light theme.
const mobile = await context.newPage()
await mobile.setViewportSize({ width: 390, height: 844 })
await mobile.emulateMedia({ colorScheme: 'light' })
await mobile.goto(`${base}/#/booking`, { waitUntil: 'networkidle' })
await mobile.evaluate(() => {
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = 'light'
  localStorage.setItem('aperfect-theme', 'light')
})
await mobile.reload({ waitUntil: 'networkidle' })
await mobile.waitForTimeout(800)
const mobileTomorrow = mobile.getByTestId('date-chip').filter({ hasText: tomorrowLabel }).first()
if (await mobileTomorrow.count()) {
  await mobileTomorrow.click()
  await mobile.waitForTimeout(700)
}
console.log('MOBILE_GRADIENTS', await gradientCount(mobile))
await mobile.screenshot({ path: path.join(outDir, 'booking-mobile-light.png'), fullPage: true })
await mobile.getByRole('button', { name: '新建预约' }).click()
await mobile.waitForTimeout(400)
await mobile.screenshot({ path: path.join(outDir, 'mobile-booking-sheet-light.png'), fullPage: false })
await mobile.keyboard.press('Escape')
await mobile.waitForTimeout(300)
await mobile.getByTestId('tab-query').click()
await mobile.waitForTimeout(400)
await mobile.screenshot({ path: path.join(outDir, 'booking-mobile-mine.png'), fullPage: true })

// Admin light and dark.
const admin = await context.newPage()
await admin.emulateMedia({ colorScheme: 'light' })
await admin.goto(`${base}/#/admin/login`, { waitUntil: 'networkidle' })
await admin.evaluate(() => {
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = 'light'
  localStorage.setItem('aperfect-theme', 'light')
})
await admin.reload({ waitUntil: 'networkidle' })
await admin.waitForTimeout(500)
console.log('LOGIN_GRADIENTS', await gradientCount(admin))
await admin.screenshot({ path: path.join(outDir, 'admin-login-light.png'), fullPage: true })
await admin.fill('#admin-email', process.env.ADMIN_EMAIL || '')
await admin.fill('#admin-password', process.env.ADMIN_PASSWORD || '')
await admin.getByRole('button', { name: '登录' }).click()
await admin.waitForURL(/#\/admin\/dashboard/, { timeout: 10_000 })
await admin.waitForTimeout(4000)
console.log('DASHBOARD_GRADIENTS', await gradientCount(admin))
await admin.screenshot({ path: path.join(outDir, 'admin-dashboard-light.png'), fullPage: true })
await admin.getByRole('button', { name: '切换到深色模式' }).click()
await admin.waitForTimeout(400)
await admin.screenshot({ path: path.join(outDir, 'admin-dashboard-dark.png'), fullPage: true })
await admin.getByRole('button', { name: '切换到浅色模式' }).click()
await admin.goto(`${base}/#/admin/machines`, { waitUntil: 'networkidle' })
await admin.waitForTimeout(700)
await admin.screenshot({ path: path.join(outDir, 'admin-machines-light.png'), fullPage: true })
await admin.goto(`${base}/#/admin/reservations`, { waitUntil: 'networkidle' })
await admin.waitForTimeout(700)
await admin.screenshot({ path: path.join(outDir, 'admin-reservations-light.png'), fullPage: true })

// Mobile admin.
const adminMobile = await context.newPage()
await adminMobile.setViewportSize({ width: 390, height: 844 })
await adminMobile.goto(`${base}/#/admin/login`, { waitUntil: 'networkidle' })
await adminMobile.fill('#admin-email', process.env.ADMIN_EMAIL || '')
await adminMobile.fill('#admin-password', process.env.ADMIN_PASSWORD || '')
await adminMobile.getByRole('button', { name: '登录' }).click()
await adminMobile.waitForURL(/#\/admin\/dashboard/, { timeout: 10_000 })
await adminMobile.waitForTimeout(4000)
await adminMobile.screenshot({ path: path.join(outDir, 'admin-mobile-light.png'), fullPage: true })

await browser.close()
if (errors.length) {
  console.error('BROWSER_ERRORS')
  for (const error of errors) console.error(error)
  process.exitCode = 1
} else {
  console.log('BROWSER_OK')
}
