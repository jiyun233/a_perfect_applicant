export type CaptchaResult = {
  ret: number
  ticket?: string | null
  randstr?: string | null
  errorCode?: number
  errorMessage?: string
}

export type CaptchaInstance = { show: () => void; destroy: () => void }
type CaptchaConstructor = new (
  appId: string,
  callback: (result: CaptchaResult) => void,
  options?: Record<string, unknown>,
) => CaptchaInstance

function getConstructor() {
  return (window as unknown as { TencentCaptcha?: CaptchaConstructor }).TencentCaptcha
}

let scriptPromise: Promise<CaptchaConstructor> | undefined

export function loadTencentCaptcha(): Promise<CaptchaConstructor> {
  const existing = getConstructor()
  if (existing) return Promise.resolve(existing)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<CaptchaConstructor>((resolve, reject) => {
    const script = document.createElement('script')
    const finish = (error?: Error) => {
      window.clearTimeout(timeout)
      script.onload = null
      script.onerror = null
      const ctor = getConstructor()
      if (error || !ctor) {
        script.remove()
        reject(error ?? new Error('验证码初始化失败'))
      } else {
        resolve(ctor)
      }
    }
    const timeout = window.setTimeout(() => finish(new Error('验证码加载超时')), 20_000)
    script.src = 'https://turing.captcha.qcloud.com/TCaptcha.js'
    script.async = true
    script.onload = () => finish()
    script.onerror = () => finish(new Error('验证码加载失败'))
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    scriptPromise = undefined
    throw error
  })
  return scriptPromise
}
