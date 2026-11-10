import { twMerge } from 'tailwind-merge'

type ClassDictionary = Record<string, boolean | null | undefined>
type ClassValue = string | number | boolean | null | undefined | ClassDictionary | ClassValue[]

function classNames(value: ClassValue): string {
  if (!value) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(classNames).filter(Boolean).join(' ')
  return Object.entries(value)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([name]) => name)
    .join(' ')
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(classNames(inputs))
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}

