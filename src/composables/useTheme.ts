import { ref } from 'vue'

const STORAGE_KEY = 'aperfect-theme'
type Theme = 'light' | 'dark'

const isDark = ref(false)
let initialized = false

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  isDark.value = theme === 'dark'
}

function initTheme() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') {
    applyTheme(stored)
    return
  }
  applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

export function useTheme() {
  initTheme()

  function setTheme(theme: Theme) {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }

  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  return { isDark, setTheme, toggleTheme }
}
