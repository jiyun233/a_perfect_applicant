import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const web = process.env.BASE_URL || 'http://127.0.0.1:5173'
const api = process.env.API_BASE || 'http://127.0.0.1:8080/api/v1'
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const adminEmail = process.env.ADMIN_EMAIL || ''
const adminPassword = process.env.ADMIN_PASSWORD || ''
const outDir = path.resolve('screenshots')
fs.mkdirSync(outDir, { recursive: true })
const shanghaiNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
let enrollmentYear = shanghaiNow.getFullYear()
if (shanghaiNow.getMonth() + 1 < 9) enrollmentYear -= 1
const yearPrefix = String(enrollmentYear).slice(-2)

async function json(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  const response = await fetch(`${api}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  return { status: response.status, body: await response.json().catch(() => null) }
}

const login = await json('/admin/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } })
const token = login.body.data.token
const tomorrow = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(Date.now() + 86400000))
const schedule = (await json(`/schedule?date=${tomorrow}`)).body.data
const clean = schedule.cells.filter((cell) => cell.state === 'available' && cell.approvedPeople === 0 && cell.pendingPeople === 0)
if (clean.length < 2) throw new Error('need two clean cells')
const emailReject = `reject-ui-${Date.now()}@example.com`
const emailCancel = `cancel-ui-${Date.now()}@example.com`
const makeBody = (cell, email, name, index) => ({
  machineId: cell.machineId,
  date: tomorrow,
  startTime: cell.slotStart,
  endTime: cell.slotEnd,
  partySize: 1,
  studentId: `${yearPrefix}40${String(Date.now() + index).slice(-6)}`,
  applicantName: name,
  majorClass: '管理测试专业',
  nickname: `昵称${index}`,
  email,
  note: 'UI 操作测试',
})
const rejected = await json('/reservations', { method: 'POST', body: makeBody(clean[0], emailReject, '拒绝流程测试', 1) })
const cancelled = await json('/reservations', { method: 'POST', body: makeBody(clean[1], emailCancel, '取消流程测试', 2) })
if (rejected.status !== 201 || cancelled.status !== 201) throw new Error('setup reservations failed')
const cancelCode = cancelled.body.data.code

const browser = await chromium.launch({ executablePath: chrome, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })
const errors = []
context.on('page', (page) => {
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
})

const admin = await context.newPage()
await admin.goto(`${web}/#/admin/login`, { waitUntil: 'networkidle' })
await admin.fill('#admin-email', adminEmail)
await admin.fill('#admin-password', adminPassword)
await admin.getByRole('button', { name: '登录' }).click()
await admin.waitForURL(/#\/admin\/dashboard/, { timeout: 10_000 })
await admin.goto(`${web}/#/admin/reservations`, { waitUntil: 'networkidle' })
await admin.locator('#filter-search').fill(emailReject)
await admin.getByRole('button', { name: '筛选', exact: true }).click()
await admin.waitForTimeout(800)
const row = admin.locator('tr').filter({ hasText: emailReject }).first()
await row.waitFor({ timeout: 10_000 })
await row.click()
await admin.getByRole('button', { name: '拒绝', exact: true }).click()
await admin.locator('#reject-reason').fill('UI 测试：时间冲突，请改约')
await admin.getByRole('button', { name: '拒绝并发送邮件' }).click()
await admin.getByText('预约已拒绝').first().waitFor({ timeout: 10_000 })
await admin.waitForTimeout(700)
const detailText = await admin.locator('[role="dialog"]').innerText()
console.log('REJECT_UI_OK', detailText.includes('未通过'), detailText.includes('UI 测试：时间冲突'))
await admin.screenshot({ path: path.join(outDir, 'admin-rejected.png') })
await admin.keyboard.press('Escape')

const member = await context.newPage()
await member.goto(`${web}/#/booking`, { waitUntil: 'networkidle' })
await member.locator('input[aria-label="预约码"]').fill(cancelCode)
await member.getByRole('button', { name: '查询预约' }).click()
await member.waitForTimeout(900)
const panel = member.locator('aside').first()
console.log('CANCEL_CODE_VISIBLE', (await panel.innerText()).includes(cancelCode))
await member.getByRole('button', { name: '取消预约' }).first().click()
await member.getByRole('button', { name: '确认取消' }).click()
await member.getByText('预约已取消').first().waitFor({ timeout: 10_000 })
await member.waitForTimeout(1200)
console.log('CANCEL_UI_OK', (await panel.innerText()).includes('已取消'))
await member.screenshot({ path: path.join(outDir, 'member-cancelled.png') })

await browser.close()
if (errors.length) {
  console.error('BROWSER_ERRORS')
  for (const error of errors) console.error(error)
  process.exitCode = 1
} else {
  console.log('BROWSER_OK')
}
