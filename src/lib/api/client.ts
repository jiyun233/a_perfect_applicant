import { clearAdminSession, getAdminToken } from '@/lib/admin-session'
import type {
  AdminDashboard,
  AdminLoginResponse,
  AdminProfile,
  CreateReservationInput,
  CreateReservationResponse,
  EmailListResponse,
  EmailRecord,
  Machine,
  MachineInput,
  MachineStatusInput,
  MachinesResponse,
  Reservation,
  ReservationDetailResponse,
  Schedule,
} from './types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>
  readonly requestId?: string

  constructor(
    message: string,
    status: number,
    code = 'UNKNOWN_ERROR',
    fields?: Record<string, string>,
    requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.requestId = requestId
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.auth) {
    const token = getAdminToken()
    if (!token) {
      throw new ApiError('请先登录管理员账号', 401, 'UNAUTHORIZED')
    }
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError('无法连接服务器，请检查网络后重试', 0, 'NETWORK_ERROR')
  }

  let payload: unknown = null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    if (response.status === 401 && options.auth) {
      clearAdminSession()
    }
    const body = payload as
      | { error?: { code?: string; message?: string; fields?: Record<string, string> }; requestId?: string }
      | null
    const error = body?.error
    throw new ApiError(
      error?.message || `请求失败（HTTP ${response.status}）`,
      response.status,
      error?.code || `HTTP_${response.status}`,
      error?.fields,
      body?.requestId,
    )
  }

  return (payload as { data: T } | null)?.data as T
}

function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value)
  }
  const raw = search.toString()
  return raw ? `?${raw}` : ''
}

export const api = {
  getMachines(): Promise<MachinesResponse> {
    return request<MachinesResponse>('/machines')
  },

  getSchedule(date?: string): Promise<Schedule> {
    return request<Schedule>(`/schedule${queryString({ date })}`)
  },

  createReservation(input: CreateReservationInput): Promise<CreateReservationResponse> {
    return request<CreateReservationResponse>('/reservations', { method: 'POST', body: input })
  },

  getReservation(code: string): Promise<{ reservation: Reservation }> {
    return request<{ reservation: Reservation }>(`/reservations/${encodeURIComponent(code)}`)
  },

  getReservationsByStudent(studentId: string): Promise<{ reservations: Reservation[]; count: number }> {
    return request<{ reservations: Reservation[]; count: number }>(
      `/reservations/by-student/${encodeURIComponent(studentId)}`,
    )
  },

  cancelReservation(code: string): Promise<{ reservation: Reservation; emailQueued: boolean }> {
    return request<{ reservation: Reservation; emailQueued: boolean }>(
      `/reservations/${encodeURIComponent(code)}/cancel`,
      { method: 'POST', body: {} },
    )
  },

  adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
    return request<AdminLoginResponse>('/admin/login', {
      method: 'POST',
      body: { email, password },
    })
  },

  adminMe(): Promise<{ admin: AdminProfile }> {
    return request<{ admin: AdminProfile }>('/admin/me', { auth: true })
  },

  adminDashboard(): Promise<AdminDashboard> {
    return request<AdminDashboard>('/admin/dashboard', { auth: true })
  },

  adminMachines(): Promise<{ machines: Machine[] }> {
    return request<{ machines: Machine[] }>('/admin/machines', { auth: true })
  },

  adminCreateMachine(input: MachineInput): Promise<{ machine: Machine }> {
    return request<{ machine: Machine }>('/admin/machines', {
      method: 'POST',
      auth: true,
      body: input,
    })
  },

  adminUpdateMachine(id: string, input: Partial<MachineInput>): Promise<{ machine: Machine }> {
    return request<{ machine: Machine }>(`/admin/machines/${id}`, {
      method: 'PATCH',
      auth: true,
      body: input,
    })
  },

  adminUpdateMachineStatus(id: string, input: MachineStatusInput): Promise<{ machine: Machine }> {
    return request<{ machine: Machine }>(`/admin/machines/${id}/status`, {
      method: 'PATCH',
      auth: true,
      body: input,
    })
  },

  adminReservations(params: {
    date?: string
    status?: string
    machineId?: string
    q?: string
  }): Promise<{ reservations: Reservation[]; count: number }> {
    return request<{ reservations: Reservation[]; count: number }>(
      `/admin/reservations${queryString(params)}`,
      { auth: true },
    )
  },

  adminReservation(id: string): Promise<ReservationDetailResponse> {
    return request<ReservationDetailResponse>(`/admin/reservations/${id}`, { auth: true })
  },

  adminApproveReservation(id: string): Promise<{ reservation: Reservation; emailQueued: boolean }> {
    return request<{ reservation: Reservation; emailQueued: boolean }>(
      `/admin/reservations/${id}/approve`,
      { method: 'POST', auth: true, body: {} },
    )
  },

  adminRejectReservation(
    id: string,
    reason: string,
  ): Promise<{ reservation: Reservation; emailQueued: boolean }> {
    return request<{ reservation: Reservation; emailQueued: boolean }>(
      `/admin/reservations/${id}/reject`,
      { method: 'POST', auth: true, body: { reason } },
    )
  },

  adminCancelReservation(
    id: string,
    reason: string,
  ): Promise<{ reservation: Reservation; emailQueued: boolean }> {
    return request<{ reservation: Reservation; emailQueued: boolean }>(
      `/admin/reservations/${id}/cancel`,
      { method: 'POST', auth: true, body: { reason } },
    )
  },

  adminEmails(reservationId: string): Promise<EmailListResponse> {
    return request<EmailListResponse>(`/admin/reservations/${reservationId}/emails`, { auth: true })
  },

  adminRetryEmail(id: string): Promise<{ email: EmailRecord }> {
    return request<{ email: EmailRecord }>(`/admin/emails/${id}/retry`, {
      method: 'POST',
      auth: true,
      body: {},
    })
  },
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return '发生未知错误'
}
