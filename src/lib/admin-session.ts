import { computed, ref } from 'vue'
import type { AdminProfile } from '@/lib/api/types'

const STORAGE_KEY = 'aperfect.admin.session'

interface AdminSession {
  token: string
  expiresAt: string
  admin: AdminProfile
}

function loadSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AdminSession
    if (!parsed.token || !parsed.expiresAt || !parsed.admin) return null
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

const session = ref<AdminSession | null>(loadSession())

export function useAdminSession() {
  const isAuthenticated = computed(() => {
    if (!session.value) return false
    return new Date(session.value.expiresAt).getTime() > Date.now()
  })

  function setSession(next: AdminSession) {
    session.value = next
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function clearSession() {
    session.value = null
    sessionStorage.removeItem(STORAGE_KEY)
  }

  return {
    session,
    isAuthenticated,
    token: computed(() => session.value?.token ?? ''),
    admin: computed(() => session.value?.admin ?? null),
    setSession,
    clearSession,
  }
}

export function getAdminToken(): string {
  return session.value?.token ?? ''
}

export function clearAdminSession(): void {
  session.value = null
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY)
  }
}
