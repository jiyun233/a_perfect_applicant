import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE_URL || 'http://127.0.0.1:5173'
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const email = process.env.TEST_EMAIL || `ui-test-${Date.now()}@example.com`
const outDir = path.resolve('screenshots')
fs.mkdirSync(outDir, { recursive: true })

const shanghaiNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
let enrollmentYear = shanghaiNow.getFullYear()
if (shanghaiNow.getMonth() + 1 < 9) enrollmentYear -= 1
const studentId = `${String(enrollmentYear).slice(-2)}${String(Date.now()).slice(-8)}`
const nickname = 'UI测试同好'

const browser = await chromium.launch({ executablePath: chrome, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
})
const errors = []
context.on('page', (page) => {
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
})

const page = await context.newPage()
await page.goto(`${base}/#/booking`, { waitUntil: 'networkidle' })
// Pick tomorrow so the matrix has future slots.
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const tomorrowLabel = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
})
  .format(tomorrow)
  .replace('/', '.')
const tomorrowButton = page.getByRole('button').filter({ hasText: tomorrowLabel }).first()
if (await tomorrowButton.count()) {
  await tomorrowButton.click()
  await page.waitForTimeout(900)
}
await page.getByRole('button', { name: '新建预约' }).click()
await page.locator('#booking-name').waitFor()
await page.locator('#booking-student-id').fill(studentId)
await page.locator('#booking-name').fill('UI 测试同好')
await page.locator('#booking-major').fill('测试专业 2301')
await page.locator('#booking-nickname').fill(nickname)
await page.locator('#booking-email').fill(email)
await page.locator('#booking-party').fill('1')
await page.locator('#booking-note').fill('Playwright 端到端测试预约')
await page.screenshot({ path: path.join(outDir, 'booking-form.png'), fullPage: false })
await page.getByRole('button', { name: '提交审批' }).click()
await page.getByText('预约已提交').first().waitFor({ timeout: 10_000 })
const dialogText = await page.locator('[role="dialog"]').innerText()
if (!dialogText.includes('预约已提交')) throw new Error('success dialog not shown')
console.log('CREATED_STUDENT_ID', studentId, 'EMAIL', email, 'NICKNAME', nickname)
await page.screenshot({ path: path.join(outDir, 'booking-success.png'), fullPage: false })
await page.getByRole('button', { name: '完成' }).click()
await page.waitForTimeout(800)
const lookup = page.locator('aside').first()
await lookup.locator('input[aria-label="学号"]').fill(studentId)
await lookup.getByRole('button', { name: '查询预约信息' }).click()
await page.waitForTimeout(800)
const lookupText = await lookup.innerText()
console.log('QUERY_PANEL_HAS_NICKNAME', lookupText.includes(nickname), 'PENDING', lookupText.includes('待审批'))
await page.screenshot({ path: path.join(outDir, 'booking-with-reservation.png'), fullPage: true })

const admin = await context.newPage()
await admin.goto(`${base}/#/admin/login`, { waitUntil: 'networkidle' })
await admin.fill('#admin-email', process.env.ADMIN_EMAIL || '')
await admin.fill('#admin-password', process.env.ADMIN_PASSWORD || '')
await admin.getByRole('button', { name: '登录' }).click()
await admin.waitForURL(/#\/admin\/dashboard/, { timeout: 10_000 })
await admin.goto(`${base}/#/admin/reservations`, { waitUntil: 'networkidle' })
await admin.waitForTimeout(900)
const row = admin.locator('tr').filter({ hasText: studentId }).first()
await row.waitFor({ timeout: 10_000 })
await row.click()
await admin.waitForTimeout(500)
console.log('DETAIL_HAS_EMAIL', (await admin.locator('[role="dialog"]').innerText()).includes(email))
await admin.screenshot({ path: path.join(outDir, 'admin-reservation-detail.png'), fullPage: false })
await admin.getByRole('button', { name: '通过预约' }).click()
await admin.getByRole('button', { name: '确认通过' }).click()
await admin.getByText('预约已通过').first().waitFor({ timeout: 10_000 })
await admin.waitForTimeout(6500)
await admin.getByRole('button', { name: '刷新详情' }).click()
await admin.waitForTimeout(800)
const detailText = await admin.locator('[role="dialog"]').innerText()
console.log('DETAIL_AFTER_APPROVE', detailText.replaceAll('\n', ' | ').slice(0, 700))
await admin.screenshot({ path: path.join(outDir, 'admin-reservation-approved.png'), fullPage: false })

// Member queries the approved status after reload.
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const lookupAfter = page.locator('aside').first()
await lookupAfter.locator('input[aria-label="学号"]').fill(studentId)
await lookupAfter.getByRole('button', { name: '查询预约信息' }).click()
await page.waitForTimeout(800)
const panelAfter = await lookupAfter.innerText()
console.log('MEMBER_SEES_APPROVED', panelAfter.includes('已通过'))
await page.screenshot({ path: path.join(outDir, 'booking-approved-member.png'), fullPage: true })

await browser.close()
if (errors.length) {
  console.error('BROWSER_ERRORS')
  for (const error of errors) console.error(error)
  process.exitCode = 1
} else {
  console.log('BROWSER_OK')
}
