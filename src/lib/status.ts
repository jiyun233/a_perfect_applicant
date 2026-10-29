import type { EmailStatus, MachineState, ReservationStatus } from '@/lib/api/types'

export type BadgeTone = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info' | 'muted'

export function machineStateLabel(state: MachineState): string {
  switch (state) {
    case 'playing':
      return '游玩中'
    case 'idle':
      return '空闲'
    case 'offline':
      return '离线'
    default:
      return state
  }
}

export function machineStateTone(state: MachineState): BadgeTone {
  switch (state) {
    case 'playing':
      return 'success'
    case 'idle':
      return 'info'
    case 'offline':
      return 'muted'
    default:
      return 'outline'
  }
}

export function reservationTone(status: ReservationStatus): BadgeTone {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'approved':
      return 'success'
    case 'rejected':
      return 'destructive'
    case 'cancelled':
      return 'secondary'
    case 'expired':
      return 'muted'
    default:
      return 'outline'
  }
}

export function emailStatusLabel(status: EmailStatus | undefined): string {
  switch (status) {
    case 'sent':
      return '已发送'
    case 'pending':
      return '待发送'
    case 'sending':
      return '发送中'
    case 'failed':
      return '发送失败'
    default:
      return '—'
  }
}

export function emailStatusTone(status: EmailStatus | undefined): BadgeTone {
  switch (status) {
    case 'sent':
      return 'success'
    case 'pending':
    case 'sending':
      return 'warning'
    case 'failed':
      return 'destructive'
    default:
      return 'muted'
  }
}
