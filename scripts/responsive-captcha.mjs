import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

// All API and captcha responses are local fixtures; no reservations are created.
process.env.VITE_CAPTCHA_ENABLED = 'true'
process.env.VITE_CAPTCHA_APP_ID = 'regression-test'
process.env.VITE_API_BASE_URL = '/api/v1'
const { createServer } = await import('vite')
const root = fileURLToPath(new URL('../', import.meta.url))
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const base = server.resolvedUrls.local[0]
const out = path.join(root, 'screenshots', 'responsive-captcha')
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
})
const now = new Date().toISOString()
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
const machines = Array.from({ length: 8 }, (_, i) => ({
  id: `machine-${i}`, code: `mai-${i}`, name: i ? `机台 ${i + 1}` : 'maimai DX 超长机台名称响应式显示测试',
  game: 'maimai DX', softwareVersion: 'PRiSM-PLUS-2026-LONG-VERSION-NUMBER',
  cabinetModel: 'DX', location: '实验室 A 区靠窗的第一台机台', capacity: 4, sortOrder: i,
  active: true, notes: '', createdAt: now, updatedAt: now,
  status: { state: 'idle', currentPlayers: 0, currentSong: '', currentChart: '', note: '', lastSeenAt: now, updatedAt: now },
}))
const slots = Array.from({ length: 12 }, (_, i) => ({
  startTime: `${10 + i}:00`, endTime: `${11 + i}:00`,
}))
const reservation = {
  id: 'reservation-1', code: 'mock-code', machine: machines[0], date: today,
  startTime: '10:00', endTime: '11:00', startAt: now, endAt: now,
  partySize: 1, nickname: '超长昵称abcdefghijklmnopqrst', studentId: '2640123456',
  applicantName: '测试用户', majorClass: '计算机专业 2601', email: 'responsive@example.com',
  note: '备注'.repeat(100), status: 'pending', statusLabel: '待审批', rejectionReason: '',
  createdAt: now, canCancel: true, emailStatus: 'sent',
}
const requests = []
const errors = []
let rejectSubmission = false
let failScript = false
let delayScript = false
let scriptRequests = 0
let currentPage

const sdk = `
window.TencentCaptcha = class {
  constructor(id, callback) { this.callback = callback; }
  show() {
    (window.testCaptchaEvents ||= []).push('show');
    const popup = document.createElement('div');
    popup.id = 'test-captcha-popup';
    popup.style.cssText = 'position:fixed;inset:0;z-index:2000000000;display:grid;place-items:center;background:#0006';
    const frame = document.createElement('iframe');
    frame.title = '测试验证码';
    frame.src = 'https://captcha.example.test/challenge';
    frame.style.cssText = 'visibility:hidden;border:0;width:min(320px,calc(100vw - 32px));height:min(320px,calc(100dvh - 32px));background:white';
    frame.onload = () => { frame.style.visibility = 'visible'; };
    popup.append(frame); document.body.append(popup); this.popup = popup;
    this.listener = (event) => {
      if (event.source !== frame.contentWindow) return;
      window.testCaptchaEvents.push(event.data);
      if (event.data.event) return;
      this.callback(event.data);
    };
    window.addEventListener('message', this.listener);
    window.testCaptchaCallback = this.callback;
  }
  destroy() { window.testCaptchaEvents.push('destroy'); this.popup?.remove(); window.removeEventListener('message', this.listener); }
};`
const challenge = `<!doctype html><html lang="zh"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{font:16px sans-serif;margin:16px}button,input{box-sizing:border-box;min-height:44px;width:100%;margin:5px 0}input[type=range]{touch-action:none}
</style><body><label>验证码输入<input aria-label="验证码输入"></label>
<input type="range" min="0" max="100" value="0" aria-label="拖动验证">
<button onclick="parent.postMessage({ret:0,ticket:'fixture-ticket',randstr:'fixture-randstr'},'*')">验证通过</button>
<button onclick="parent.postMessage({ret:2},'*')">取消验证</button>
<button onclick="parent.postMessage({ret:1,errorMessage:'模拟验证失败'},'*')">验证失败</button>
<script>for(const type of ['pointerdown','pointerup','click']) document.addEventListener(type, e => parent.postMessage({event:type,target:e.target.tagName},'*'));</script></body></html>`

async function makeContext(viewport, touch = true) {
  const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })
  context.setDefaultTimeout(10_000)
  await context.addInitScript(() => {
    if (!location.hash.includes('/admin/login')) {
      sessionStorage.setItem('aperfect.admin.session', JSON.stringify({
        token: 'fixture-token', expiresAt: '2099-01-01T00:00:00Z',
        admin: { id: 'admin', displayName: '测试管理员', email: 'admin@example.com' },
      }))
    } else sessionStorage.removeItem('aperfect.admin.session')
    window.backgroundClicks = 0
    document.addEventListener('click', (event) => {
      if (document.querySelector('.captcha-guard') && event.target.closest?.('#app')) window.backgroundClicks++
    }, true)
  })
  await context.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const endpoint = url.pathname.replace('/api/v1', '')
    let data
    if (endpoint === '/schedule') {
      data = { date: url.searchParams.get('date') || today, today, maxDate: today, timezone: 'Asia/Shanghai',
        openTime: '10:00', closeTime: '22:00', slotMinutes: 60, bookingDays: 14, maxSlots: 4, serverTime: now,
        machines, slots, cells: machines.flatMap(machine => slots.map(slot => ({ machineId: machine.id,
          slotStart: slot.startTime, slotEnd: slot.endTime, approvedPeople: 0, pendingPeople: 0, capacity: 4, state: 'available' }))),
        reservations: [{ ...reservation, machineId: machines[0].id }],
      }
    } else if (endpoint === '/machines' || endpoint === '/admin/machines') data = { machines, serverTime: now }
    else if (endpoint === '/admin/dashboard') data = {
      stats: { pendingReservations: 1, todayReservations: 1, totalMachines: 8, onlineMachines: 8, playingMachines: 0, pendingEmails: 0, failedEmails: 0 },
      pending: [reservation], mailDriver: 'smtp', serverTime: now, pendingCount: 1,
    }
    else if (endpoint === '/admin/reservations' || endpoint.startsWith('/reservations/by-student/')) data = { reservations: [reservation], count: 1 }
    else if (endpoint === '/admin/reservations/reservation-1') data = { reservation, emails: [] }
    else if (endpoint === '/reservations' && route.request().method() === 'POST') {
      requests.push(route.request().postDataJSON())
      if (rejectSubmission) return route.fulfill({ status: 409, json: { error: { code: 'SLOT_FULL', message: '该时段已满，请重试' } } })
      data = { reservation, code: 'mock-code', emailQueued: true }
    } else throw new Error(`Unexpected API request: ${endpoint}`)
    await route.fulfill({ json: { data } })
  })
  await context.route('https://turing.captcha.qcloud.com/TCaptcha.js', async route => {
    scriptRequests++
    if (failScript) return route.abort('failed')
    if (delayScript) await new Promise(resolve => setTimeout(resolve, 800))
    await route.fulfill({ contentType: 'application/javascript', body: sdk }).catch(() => {})
  })
  await context.route('https://captcha.example.test/challenge', route => route.fulfill({ contentType: 'text/html', body: challenge }))
  return context
}

async function navigate(page, route) {
  currentPage = page
  await page.goto(`${base}?case=${Date.now()}#${route}`)
  await page.locator('main h1').waitFor()
  await page.waitForTimeout(250)
}

async function noOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    width: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth,
    dialogOverflow: [...document.querySelectorAll('.dialog-scroll')].some(el => el.scrollWidth > el.clientWidth + 1),
  }))
  assert(metrics.width <= page.viewportSize().width + 1, `${label}: mobile viewport was widened ${JSON.stringify(metrics)}`)
  assert(metrics.overflow <= 1, `${label}: horizontal overflow ${JSON.stringify(metrics)}`)
  assert(!metrics.dialogOverflow, `${label}: dialog content overflow`)
}

async function footerVisible(page) {
  await page.locator('.dialog-content').evaluate(async el => {
    await Promise.all(el.getAnimations().map(animation => animation.finished))
  })
  const footer = await page.locator('.dialog-footer').boundingBox()
  const viewport = await page.evaluate(() => ({ height: visualViewport.height, top: visualViewport.offsetTop }))
  assert(footer && footer.y >= viewport.top && footer.y + footer.height <= viewport.top + viewport.height + 1, `Dialog actions must stay in view: ${JSON.stringify({ footer, viewport })}`)
}

async function fillBooking(page, mobile) {
  await navigate(page, '/booking')
  await page.getByRole('button', { name: '新建预约' }).click()
  await footerVisible(page)
  if (mobile) await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.locator('#booking-student-id').fill('2640123456')
  await page.locator('#booking-name').fill('测试用户')
  await page.locator('#booking-major').fill('计算机 2601')
  await page.locator('#booking-nickname').fill('测试昵称')
  await page.locator('#booking-email').fill('responsive@example.com')
  await page.getByRole('button', { name: '提交审批', exact: true }).click()
  assert(await page.getByRole('button', { name: /请阅读规则/ }).isDisabled(), 'Rules countdown must prevent early verification')
  await footerVisible(page)
  await page.getByRole('button', { name: '我已阅读，继续验证' }).click({ timeout: 8000 })
}

try {
  if (!process.env.CAPTCHA_ONLY) {
  const layoutContext = await makeContext({ width: 390, height: 844 })
  const page = await layoutContext.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'warning' && message.text().includes('[Vue warn]')) errors.push(message.text()) })
  const widths = [[320, 568], [390, 844], [640, 800], [768, 1024], [1024, 768], [1440, 1000], [844, 390]]
  for (const [width, height] of widths) {
    await page.setViewportSize({ width, height })
    for (const route of ['/booking', '/machines', '/admin/login', '/admin/dashboard', '/admin/machines', '/admin/reservations']) {
      await navigate(page, route)
      await noOverflow(page, `${route} ${width}x${height}`)
      if (width === 390 || width === 768) await page.screenshot({ path: path.join(out, `${route.replaceAll('/', '-')}-${width}.png`), fullPage: true })
      if (route === '/booking') {
        await page.getByRole('button', { name: '新建预约' }).click()
        await noOverflow(page, `booking dialog ${width}`)
        await footerVisible(page)
        await page.locator('#booking-machine').click()
        await page.getByRole('option').last().waitFor()
        const options = await page.getByRole('listbox').boundingBox()
        assert(options && options.x >= 0 && options.x + options.width <= width + 1 && options.y >= 0 && options.y + options.height <= height + 1, `Select outside viewport ${width}`)
        await page.getByRole('option').last().click()
        if (width < 640) await page.getByRole('button', { name: '下一步', exact: true }).click()
        await page.locator('#booking-note').fill('手机端滚动测试')
        await footerVisible(page)
        if (width === 390 || width === 844) await page.screenshot({ path: path.join(out, `booking-form-${width}.png`) })
        if (width === 390) {
          await page.setViewportSize({ width, height: 420 })
          await page.locator('#booking-note').fill('缩小可见区域后仍可填写')
          await footerVisible(page)
          await noOverflow(page, 'reduced viewport')
          await page.setViewportSize({ width, height })
          await page.screenshot({ path: path.join(out, 'booking-form-resized.png') })
        }
        await page.getByRole('button', { name: '关闭', exact: true }).click()
      }
      if (route === '/admin/machines') {
        await page.getByRole('button', { name: '新增', exact: true }).click()
        await footerVisible(page)
        await noOverflow(page, `machine dialog ${width}`)
        await page.getByRole('button', { name: '关闭', exact: true }).click()
      }
      if (route === '/admin/reservations') {
        const detailButton = width < 768
          ? page.getByRole('button', { name: /maimai DX.*待审批/ })
          : page.getByRole('button', { name: '详情', exact: true })
        await detailButton.click()
        await page.getByText('机台与备注', { exact: true }).waitFor()
        await footerVisible(page)
        await noOverflow(page, `reservation detail ${width}`)
        await page.locator('.dialog-close').click()
      }
    }
    console.log(`LAYOUT_OK ${width}x${height}`)
  }
  await layoutContext.close()
  }

  for (const mobile of [true, false]) {
    if (process.env.DESKTOP_ONLY && mobile) continue
    const context = await makeContext(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, mobile)
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'warning') console.log('BROWSER_WARNING', message.text()) })
    await fillBooking(page, mobile)
    const frame = page.frameLocator('iframe[title="测试验证码"]')
    await frame.getByRole('button', { name: '取消验证' }).waitFor()
    assert.equal(await page.locator('[role="dialog"]').count(), 0, 'Booking modal must release external focus and pointer locks')
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).pointerEvents), 'auto')
    assert.equal(await page.evaluate(() => document.getElementById('app').inert), true)
    await frame.getByRole('textbox').fill('键盘焦点可以进入验证码')
    const range = frame.getByRole('slider')
    const box = await range.boundingBox()
    if (mobile) {
      const cdp = await context.newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 8, y: box.y + box.height / 2 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width - 10, y: box.y + box.height / 2 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await cdp.detach()
    } else {
      await page.mouse.move(box.x + 8, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2, { steps: 10 })
      await page.mouse.up()
    }
    assert(Number(await range.inputValue()) > 80, 'Captcha slider must receive drag input')
    await page.screenshot({ path: path.join(out, `captcha-${mobile ? 'mobile' : 'desktop'}.png`) })
    await frame.getByRole('button', { name: '取消验证' }).click()
    await page.getByRole('button', { name: '提交审批', exact: true }).waitFor()
    assert.equal(await page.locator('#booking-name').inputValue(), '测试用户')
    assert.equal(await page.evaluate(() => document.getElementById('app').inert), false)
    const before = requests.length
    await page.getByRole('button', { name: '提交审批', exact: true }).click()
    await page.frameLocator('iframe').getByRole('button', { name: '验证失败' }).click()
    await page.getByRole('button', { name: '提交审批', exact: true }).waitFor()
    assert.equal(requests.length, before, 'Cancellation and failed challenges must not submit')
    await page.getByRole('button', { name: '提交审批', exact: true }).click()
    if (mobile) await page.frameLocator('iframe').getByRole('button', { name: '验证通过' }).tap()
    else await page.frameLocator('iframe').getByRole('button', { name: '验证通过' }).click()
    await page.getByRole('button', { name: '完成', exact: true }).waitFor()
    assert.equal(requests.length, before + 1, 'Successful challenge submits exactly once')
    assert.equal(requests.at(-1).captchaTicket, 'fixture-ticket')
    assert.equal(requests.at(-1).captchaRandstr, 'fixture-randstr')
    await page.evaluate(() => window.testCaptchaCallback({ ret: 0, ticket: 'stale', randstr: 'stale' }))
    assert.equal(requests.length, before + 1, 'Late callback cannot resubmit')
    assert.equal(await page.evaluate(() => window.backgroundClicks), 0, 'No captcha click may reach the application')
    assert.equal(await page.locator('#test-captcha-popup').count(), 0)
    await page.getByRole('button', { name: '完成', exact: true }).click()
    if (mobile) {
      await page.getByTestId('tab-query').click()
      await page.getByRole('textbox', { name: '学号', exact: true }).fill('2640123456')
      await page.getByRole('button', { name: '查询预约信息' }).click()
      await page.getByText('共 1 条预约').waitFor()
      await noOverflow(page, 'reservation lookup')
    }
    console.log(`CAPTCHA_OK ${mobile ? 'touch' : 'mouse'}: drag, focus, cancel, retry, failure, success, cleanup`)
    await context.close()
  }

  const context = await makeContext({ width: 390, height: 844 })
  const page = await context.newPage()
  failScript = true
  await fillBooking(page, true)
  await page.getByText('人机验证未完成', { exact: true }).waitFor()
  assert.equal(await page.locator('#booking-name').inputValue(), '测试用户')
  failScript = false
  delayScript = true
  const attempts = scriptRequests
  await page.getByRole('button', { name: '提交审批', exact: true }).click()
  await page.getByRole('button', { name: '返回预约', exact: true }).click()
  await page.waitForTimeout(1000)
  assert.equal(await page.locator('#test-captcha-popup').count(), 0, 'Closing during script load must not leave a late popup')
  assert.equal(await page.evaluate(() => document.getElementById('app').inert), false)
  assert(scriptRequests > attempts, 'Failed script must be retried')
  delayScript = false
  rejectSubmission = true
  await page.getByRole('button', { name: '提交审批', exact: true }).click()
  await page.frameLocator('iframe').getByRole('button', { name: '验证通过' }).click()
  await page.getByText('预约没有提交成功', { exact: true }).waitFor()
  await page.getByRole('button', { name: '提交审批', exact: true }).click()
  await page.frameLocator('iframe').getByRole('button', { name: '取消验证' }).click()
  assert.equal(await page.locator('#booking-name').inputValue(), '测试用户')
  console.log('RECOVERY_OK: network failure, close during load, stale callback, server rejection')
  await context.close()
  assert.deepEqual(errors, [], 'No browser runtime errors or unresolved Vue components')
  console.log('RESPONSIVE_CAPTCHA_OK')
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: path.join(out, 'failure.png') })
    console.error('FAILURE_STATE', await currentPage.locator('body').innerText(), { errors, scriptRequests }, await currentPage.evaluate(() => ({ events: window.testCaptchaEvents, pointer: getComputedStyle(document.body).pointerEvents, frames: document.querySelectorAll('iframe').length })))
  }
  throw error
} finally {
  await browser.close()
  await server.close()
}
