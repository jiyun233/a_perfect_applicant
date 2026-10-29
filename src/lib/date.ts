import { addDays, format, isSameDay, parse } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export const DATE_FORMAT = 'yyyy-MM-dd'

export function parseDateKey(value: string): Date {
  return parse(value, DATE_FORMAT, new Date())
}

export function formatDateKey(date: Date): string {
  return format(date, DATE_FORMAT)
}

export function addDaysKey(value: string, days: number): string {
  return format(addDays(parseDateKey(value), days), DATE_FORMAT)
}

export function formatDateLong(value: string): string {
  return format(parseDateKey(value), 'M 月 d 日 EEEE', { locale: zhCN })
}

export function formatDateCompact(value: string): string {
  return format(parseDateKey(value), 'M/d')
}

export function formatWeekday(value: string): string {
  return format(parseDateKey(value), 'EEE', { locale: zhCN })
}

export function formatMonthDay(value: string): string {
  return format(parseDateKey(value), 'MM.dd')
}

export function formatTimeRange(start: string, end: string): string {
  return `${start}–${end}`
}

export function isDateKeyToday(value: string, today: string): boolean {
  return isSameDay(parseDateKey(value), parseDateKey(today))
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'yyyy-MM-dd HH:mm')
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 10) return '刚刚'
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return format(date, 'M 月 d 日 HH:mm')
}

export function todayKey(): string {
  return format(new Date(), DATE_FORMAT)
}
