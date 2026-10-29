const API = process.env.API_BASE || 'http://127.0.0.1:8080/api/v1'
const adminEmail = process.env.ADMIN_EMAIL || ''
const adminPassword = process.env.ADMIN_PASSWORD || ''
const shanghaiNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
let enrollmentYear = shanghaiNow.getFullYear()
if (shanghaiNow.getMonth() + 1 < 9) enrollmentYear -= 1
const yearPrefix = String(enrollmentYear).slice(-2)

let failures = 0
function check(name, condition, extra = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!condition) failures++
}

async function request(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  const response = await fetch(`${API}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { status: response.status, body, headers: response.headers }
}

function addDays(date, days) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

const tomorrow = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(addDays(new Date(), 1))

const login = await request('/admin/login', {
  method: 'POST',
  body: { email: adminEmail, password: adminPassword },
})
check('admin login', login.status === 200, `status=${login.status}`)
const token = login.body?.data?.token

const scheduleResponse = await request(`/schedule?date=${tomorrow}`)
check('schedule loads', scheduleResponse.status === 200)
const schedule = scheduleResponse.body.data
const cleanCell = schedule.cells.find(
  (cell) =>
    cell.state === 'available' &&
    cell.approvedPeople === 0 &&
    cell.pendingPeople === 0 &&
    schedule.machines.find((machine) => machine.id === cell.machineId)?.capacity >= 2,
)
check('found clean slot', Boolean(cleanCell), cleanCell && `${cleanCell.machineId} ${cleanCell.slotStart}`)

const email = `api-test-${Date.now()}@example.com`
const testStudentId = `${yearPrefix}44444444`
const create = await request('/reservations', {
  method: 'POST',
  body: {
    machineId: cleanCell.machineId,
    date: tomorrow,
    startTime: cleanCell.slotStart,
    endTime: cleanCell.slotEnd,
    partySize: 2,
    studentId: testStudentId,
    applicantName: 'API 测试',
    majorClass: 'API 测试专业',
    nickname: 'API测试昵称',
    email,
    note: 'API smoke test',
  },
})
check('create reservation', create.status === 201, `status=${create.status}`)
const code = create.body?.data?.code
const reservationId = create.body?.data?.reservation?.id
const studentLookup = await request(`/reservations/by-student/${testStudentId}`)
check('lookup by student id', studentLookup.status === 200 && studentLookup.body.data.count >= 1)
const studentItem = studentLookup.body.data.reservations?.[0] || {}
check(
  'student lookup hides private fields',
  !('studentId' in studentItem) &&
    !('applicantName' in studentItem) &&
    !('majorClass' in studentItem) &&
    !('email' in studentItem) &&
    studentItem.nickname === 'API测试昵称',
  JSON.stringify(Object.keys(studentItem)),
)
const publicLookup = await request(`/reservations/${code}`)
check('lookup by code', publicLookup.status === 200)
check(
  'public lookup hides personal data',
  !('email' in (publicLookup.body.data.reservation || {})) &&
    !('applicantName' in (publicLookup.body.data.reservation || {})) &&
    !('studentId' in (publicLookup.body.data.reservation || {})) &&
    !('majorClass' in (publicLookup.body.data.reservation || {})),
  JSON.stringify(Object.keys(publicLookup.body.data.reservation || {})),
)

const adminList = await request(`/admin/reservations?q=${encodeURIComponent(email)}`, { token })
check('admin finds reservation', adminList.status === 200 && adminList.body.data.count === 1)
check(
  'admin sees email',
  adminList.body.data.reservations?.[0]?.email === email,
)

const reject = await request(`/admin/reservations/${reservationId}/reject`, {
  method: 'POST',
  token,
  body: { reason: '自动化测试拒绝原因' },
})
check('reject reservation', reject.status === 200 && reject.body.data.reservation.status === 'rejected')
await new Promise((resolve) => setTimeout(resolve, 6500))
const emails = await request(`/admin/reservations/${reservationId}/emails`, { token })
check('rejection email sent', emails.body?.data?.emails?.some((mail) => mail.template === 'rejected' && mail.status === 'sent'))

const rejectedLookup = await request(`/reservations/${code}`)
check('member sees rejected status', rejectedLookup.body?.data?.reservation?.status === 'rejected')
check('rejection reason visible', rejectedLookup.body?.data?.reservation?.rejectionReason === '自动化测试拒绝原因')

const scheduleAfterReject = await request(`/schedule?date=${tomorrow}`)
const cellAfter = scheduleAfterReject.body.data.cells.find(
  (cell) => cell.machineId === cleanCell.machineId && cell.slotStart === cleanCell.slotStart,
)
check('rejection releases capacity', cellAfter.approvedPeople + cellAfter.pendingPeople === 0)

// Concurrent bookings: capacity 2, two parties of 2. Exactly one may win.
const bodies = [1, 2].map((n) => ({
  machineId: cleanCell.machineId,
  date: tomorrow,
  startTime: cleanCell.slotStart,
  endTime: cleanCell.slotEnd,
  partySize: 2,
  studentId: `${yearPrefix}5555555${n}`,
  applicantName: `并发测试 ${n}`,
  majorClass: '并发测试专业',
  nickname: `并发昵称${n}`,
  email: `concurrent-${n}-${Date.now()}@example.com`,
  note: 'concurrency smoke test',
}))
const [concurrentA, concurrentB] = await Promise.all(
  bodies.map((body) => request('/reservations', { method: 'POST', body })),
)
const statuses = [concurrentA.status, concurrentB.status].sort()
check('concurrent booking prevents oversell', statuses[0] === 201 && statuses[1] === 409, statuses.join(','))
const winner = concurrentA.status === 201 ? concurrentA : concurrentB
const winnerCode = winner.body?.data?.code
const cancel = await request(`/reservations/${winnerCode}/cancel`, { method: 'POST', body: {} })
check('member can cancel', cancel.status === 200 && cancel.body.data.reservation.status === 'cancelled')

const collision = await request('/reservations', {
  method: 'POST',
  body: {
    machineId: cleanCell.machineId,
    date: tomorrow,
    startTime: cleanCell.slotStart,
    endTime: cleanCell.slotEnd,
    partySize: 2,
    studentId: `${yearPrefix}66666666`,
    applicantName: '取消后测试',
    majorClass: '取消测试专业',
    nickname: '取消测试昵称',
    email: `cancel-${Date.now()}@example.com`,
    note: '',
  },
})
check('cancellation releases capacity for a new booking', collision.status === 201, `status=${collision.status}`)
if (collision.status === 201) {
  await request(`/reservations/${collision.body.data.code}/cancel`, { method: 'POST', body: {} })
}

const corsAllowed = await fetch(`${API}/machines`, {
  method: 'OPTIONS',
  headers: {
    Origin: 'http://localhost:5173',
    'Access-Control-Request-Method': 'GET',
  },
})
check(
  'CORS allows configured origin',
  corsAllowed.status === 204 && corsAllowed.headers.get('access-control-allow-origin') === 'http://localhost:5173',
  `status=${corsAllowed.status}`,
)
const corsDenied = await fetch(`${API}/machines`, {
  method: 'OPTIONS',
  headers: {
    Origin: 'https://evil.example.com',
    'Access-Control-Request-Method': 'GET',
  },
})
check('CORS rejects unknown origin', corsDenied.status === 403, `status=${corsDenied.status}`)

const unauth = await request('/admin/dashboard')
check('admin API requires auth', unauth.status === 401)

console.log(`\n${failures === 0 ? 'ALL API CHECKS PASSED' : `${failures} API CHECK(S) FAILED`}`)
process.exitCode = failures === 0 ? 0 : 1
