(function initAuthService() {
  const STORAGE_KEY = '__cloud_session'
  const DEFAULT_BASE_URL = 'http://127.0.0.1:4000/api'

  let session = loadSession()

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return null
      if (!parsed.token || !parsed.baseUrl) return null
      return parsed
    } catch (_error) {
      return null
    }
  }

  function saveSession(nextSession) {
    session = nextSession
    if (!nextSession) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession))
  }

  function getSession() {
    return session
  }

  function getBaseUrl(baseUrlOverride) {
    return (baseUrlOverride || session?.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '')
  }

  async function request(path, { method = 'GET', body, authRequired = false, baseUrl } = {}) {
    const apiBase = getBaseUrl(baseUrl)
    const headers = { 'Content-Type': 'application/json' }

    if (authRequired) {
      if (!session?.token) throw new Error('No hay sesión activa.')
      headers.Authorization = `Bearer ${session.token}`
    }

    const response = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || `Error ${response.status}`)
    }

    return payload
  }

  async function register({ email, password, name, baseUrl }) {
    return request('/auth/register', {
      method: 'POST',
      baseUrl,
      body: { email, password, name }
    })
  }

  async function login({ email, password, baseUrl }) {
    const result = await request('/auth/login', {
      method: 'POST',
      baseUrl,
      body: { email, password }
    })

    saveSession({
      token: result.token,
      user: result.user,
      baseUrl: getBaseUrl(baseUrl),
      loggedInAt: Date.now()
    })

    return result
  }

  async function logout() {
    try {
      if (session?.token) {
        await request('/auth/logout', { method: 'POST', authRequired: true })
      }
    } finally {
      saveSession(null)
    }
  }

  async function requestPasswordReset({ email, baseUrl }) {
    return request('/auth/request-password-reset', {
      method: 'POST',
      baseUrl,
      body: { email }
    })
  }

  async function resetPassword({ email, resetToken, newPassword, baseUrl }) {
    return request('/auth/reset-password', {
      method: 'POST',
      baseUrl,
      body: { email, resetToken, newPassword }
    })
  }

  async function refreshSessionUser() {
    if (!session?.token) return null
    const payload = await request('/auth/session', { authRequired: true })
    session = { ...session, user: payload.user }
    saveSession(session)
    return payload.user
  }

  window.AuthService = {
    DEFAULT_BASE_URL,
    getSession,
    register,
    login,
    logout,
    requestPasswordReset,
    resetPassword,
    refreshSessionUser
  }
})()
