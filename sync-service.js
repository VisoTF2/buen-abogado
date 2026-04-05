(function initSyncService() {
  const STATUS_KEY = '__cloud_sync_status'
  const AUTO_SYNC_MS = 25000

  let autoSyncTimer = null
  let syncInFlight = false
  let lastFingerprint = window.LocalStorageService.getDataFingerprint()

  function loadStatus() {
    try {
      return JSON.parse(localStorage.getItem(STATUS_KEY) || 'null') || {
        state: 'idle',
        lastSyncedAt: null,
        message: 'Aún no sincronizado.'
      }
    } catch (_error) {
      return {
        state: 'idle',
        lastSyncedAt: null,
        message: 'Aún no sincronizado.'
      }
    }
  }

  let status = loadStatus()

  function setStatus(next) {
    status = {
      ...status,
      ...next
    }
    localStorage.setItem(STATUS_KEY, JSON.stringify(status))
    window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail: status }))
  }

  function getStatus() {
    return status
  }

  async function authRequest(path, options) {
    const session = window.AuthService.getSession()
    if (!session) throw new Error('No hay sesión activa.')

    const response = await fetch(`${session.baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `Error ${response.status}`)
    return payload
  }

  async function pullFromCloud({ reloadAfter = true } = {}) {
    const session = window.AuthService.getSession()
    if (!session) throw new Error('Debes iniciar sesión antes de restaurar datos.')

    setStatus({ state: 'running', message: 'Descargando datos desde la nube...' })

    const payload = await authRequest('/sync/pull', { method: 'GET' })
    if (payload.data && payload.data.entries) {
      window.LocalStorageService.importSnapshot(payload.data)
      setStatus({
        state: 'ok',
        lastSyncedAt: payload.syncUpdatedAt || new Date().toISOString(),
        message: 'Datos restaurados desde la nube.'
      })
      lastFingerprint = window.LocalStorageService.getDataFingerprint()
      if (reloadAfter) window.location.reload()
      return { restored: true, payload }
    }

    setStatus({
      state: 'ok',
      lastSyncedAt: payload.syncUpdatedAt || null,
      message: 'No hay respaldo en la nube para esta cuenta.'
    })
    return { restored: false, payload }
  }

  async function pushToCloud() {
    const session = window.AuthService.getSession()
    if (!session) throw new Error('Debes iniciar sesión antes de sincronizar.')

    setStatus({ state: 'running', message: 'Subiendo datos a la nube...' })

    const snapshot = window.LocalStorageService.exportSnapshot()
    const payload = await authRequest('/sync/push', {
      method: 'POST',
      body: {
        data: snapshot,
        clientUpdatedAt: snapshot.savedAt
      }
    })

    if (payload.winner === 'server' && payload.data) {
      window.LocalStorageService.importSnapshot(payload.data)
      setStatus({
        state: 'ok',
        lastSyncedAt: payload.syncUpdatedAt,
        message: 'Se aplicó versión más reciente del servidor (Last Write Wins).'
      })
      lastFingerprint = window.LocalStorageService.getDataFingerprint()
      window.location.reload()
      return payload
    }

    setStatus({
      state: 'ok',
      lastSyncedAt: payload.syncUpdatedAt,
      message: 'Sincronización completada.'
    })
    lastFingerprint = window.LocalStorageService.getDataFingerprint()
    return payload
  }

  async function runAutoSyncOnce() {
    if (syncInFlight) return
    const session = window.AuthService.getSession()
    if (!session) return

    const currentFingerprint = window.LocalStorageService.getDataFingerprint()
    if (currentFingerprint === lastFingerprint) return

    syncInFlight = true
    try {
      await pushToCloud()
    } catch (error) {
      setStatus({ state: 'error', message: `Auto-sync falló: ${error.message}` })
    } finally {
      syncInFlight = false
    }
  }

  function startAutoSync() {
    if (autoSyncTimer) clearInterval(autoSyncTimer)
    autoSyncTimer = setInterval(runAutoSyncOnce, AUTO_SYNC_MS)
  }

  function stopAutoSync() {
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer)
      autoSyncTimer = null
    }
  }

  startAutoSync()

  window.SyncService = {
    getStatus,
    pullFromCloud,
    pushToCloud,
    startAutoSync,
    stopAutoSync,
    runAutoSyncOnce
  }
})()
