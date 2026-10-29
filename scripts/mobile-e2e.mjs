import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE_URL || 'http://127.0.0.1:4173'
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const outDir = path.resolve('screenshots')
fs.mkdirSync(outDir, { recursive: true })
const email = `mobile-${Date.now()}@example.com`
const shanghaiNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
let enrollmentYear = shanghaiNow.getFullYear()
if (shanghaiNow.getMonth() + 1 < 9) enrollmentYear -= 1
const studentId = `${String(enrollmentYear).slice(-2)}${String(Date.now()).slice(-8)}`
const nickname = '移动端测试昵称'

const browser = await chromium.launch({ executablePath: chrome, headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  colorScheme: 'light',
  isMobile: true,
  hasTouch: true,
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

await page.goto(`${base}/#/booking`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
console.log('MOBILE_HORIZONTAL_OVERFLOW', overflow)

const tomorrow = new Date(Date.now() + 86400000)
const label = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
}).format(tomorrow).replace('/', '.')
const dateChip = page.getByTestId('date-chip').filter({ hasText: label }).first()
if (await dateChip.count()) {
  await dateChip.click()
  await page.waitForTimeout(800)
}

await page.getByRole('button', { name: '新建预约' }).click()
await page.locator('#booking-name').waitFor()
await page.waitForTimeout(400)
const dialog = page.locator('[role="dialog"]')
await dialog.waitFor()
const box = await dialog.boundingBox()
console.log('BOTTOM_SHEET_AT_BOTTOM', box ? Math.abs(box.y + box.height - 844) < 2 : false)
await page.screenshot({ path: path.join(outDir, 'mobile-booking-sheet.png'), fullPage: false })

await page.locator('#booking-student-id').fill(studentId)
await page.locator('#booking-name').fill('移动端测试')
await page.locator('#booking-major').fill('移动端专业 2401')
await page.locator('#booking-nickname').fill(nickname)
await page.locator('#booking-email').fill(email)
await page.getByRole('button', { name: '提交审批' }).click()
await page.getByText('预约已提交').first().waitFor({ timeout: 10_000 })
const dialogText = await dialog.innerText()
console.log('MOBILE_BOOKING_CREATED', dialogText.includes('预约已提交'), 'STUDENT_ID', studentId)
await page.screenshot({ path: path.join(outDir, 'mobile-booking-success.png'), fullPage: false })
await page.getByRole('button', { name: '完成' }).click()
await page.waitForTimeout(900)

await page.getByTestId('tab-query').click()
await page.waitForTimeout(300)
await page.locator('input[aria-label="学号"]').fill(studentId)
await page.getByRole('button', { name: '查询预约信息' }).click()
await page.waitForTimeout(700)
const queryText = await page.locator('main').innerText()
console.log(
  'MOBILE_QUERY_TAB',
  queryText.includes('查询预约'),
  'HAS_RESULT',
  queryText.includes(nickname),
  'PENDING',
  queryText.includes('待审批'),
)
await page.screenshot({ path: path.join(outDir, 'mobile-query-result.png'), fullPage: false })

await page.getByTestId('tab-schedule').click()
await page.waitForTimeout(300)
await page.screenshot({ path: path.join(outDir, 'mobile-booking-after.png'), fullPage: false })

await page.goto(`${base}/#/machines`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
console.log('MOBILE_MACHINES_OVERFLOW', await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
await page.screenshot({ path: path.join(outDir, 'mobile-machines.png'), fullPage: false })

await browser.close()
if (errors.length) {
  console.error('BROWSER_ERRORS')
  for (const error of errors) console.error(error)
  process.exitCode = 1
} else {
  console.log('BROWSER_OK')
}
