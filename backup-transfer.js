(function initBackupTransfer() {
  const RESERVED_PREFIX = '__backup_tool_'
  const CHUNKED_MARKER_PREFIX = '__chunked__:'
  const CHUNK_SIZE = 5000000 // Aumentado para permitir chunks más grandes
  const WITH_BACKUP_COPY = new Set(['articulosGuardados', 'carpetasMaterias', 'materiasOrden'])
  const RUNTIME_PRIORITY_KEYS = [
    'articulosGuardados',
    'carpetasMaterias',
    'materiasOrden',
    'documentosSubidos',
    'documentosSidebarIds',
    'fondoImagenApp'
  ]

  function getAppSnapshot() {
    const localStorageState = {}
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key || key.startsWith(RESERVED_PREFIX)) continue
      const value = localStorage.getItem(key)
      if (typeof value !== 'string') continue
      localStorageState[key] = value
    }

    const persistentState =
      window.persistentState?.exportAll && typeof window.persistentState.exportAll === 'function'
        ? window.persistentState.exportAll()
        : {}

    const runtimeState = collectRuntimeState()
    RUNTIME_PRIORITY_KEYS.forEach(key => {
      if (!(key in runtimeState)) return
      const value = runtimeState[key]
      persistentState[key] = value
      try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value)
        localStorageState[key] = serialized
        if (WITH_BACKUP_COPY.has(key)) {
          localStorageState[`${key}__backup`] = serialized
        }
      } catch (_error) {
        // Ignora estados no serializables.
      }
    })

    return {
      app: 'Buen abogado',
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      localStorage: localStorageState,
      persistentState,
      runtimeState
    }
  }

  function collectRuntimeState() {
    const state = {}

    try {
      if (typeof window.__backupExportAppState === 'function') {
        Object.assign(state, window.__backupExportAppState() || {})
      }
    } catch (_error) {}

    try {
      if (typeof window.__backupExportDocumentosState === 'function') {
        state.documentosSubidos = window.__backupExportDocumentosState() || []
      }
    } catch (_error) {}

    RUNTIME_PRIORITY_KEYS.forEach(key => {
      if (key in state) return
      const cached = window.persistentState?.getCached?.(key)
      if (cached !== undefined) {
        state[key] = cached
        return
      }

      const raw = readStorageValue(key)
      if (typeof raw !== 'string') return
      state[key] = parseMaybeJson(raw)
    })

    return state
  }

  function normalizeSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('El archivo de respaldo no tiene un formato válido.')
    }

    // Nuevo formato (v2)
    if (snapshot.localStorage && typeof snapshot.localStorage === 'object') {
      return {
        localStorage: snapshot.localStorage,
        persistentState:
          snapshot.persistentState && typeof snapshot.persistentState === 'object'
            ? snapshot.persistentState
            : {},
        runtimeState: snapshot.runtimeState && typeof snapshot.runtimeState === 'object' ? snapshot.runtimeState : {}
      }
    }

    // Compatibilidad con respaldos antiguos
    const legacyEntries = snapshot.entries && typeof snapshot.entries === 'object' ? snapshot.entries : {}
    const legacyFullState = snapshot.fullState && typeof snapshot.fullState === 'object' ? snapshot.fullState : {}

    if (!Object.keys(legacyEntries).length && !Object.keys(legacyFullState).length) {
      throw new Error('El archivo de respaldo no contiene datos utilizables.')
    }

    const localStorageState = {}
    Object.entries(legacyEntries).forEach(([key, value]) => {
      if (typeof key !== 'string' || key.startsWith(RESERVED_PREFIX)) return

      if (typeof value === 'string') {
        localStorageState[key] = value
        return
      }

      try {
        localStorageState[key] = JSON.stringify(value)
      } catch (_error) {
        // Ignora valores no serializables.
      }
    })

    // Si el respaldo viejo tenía datos más completos en fullState, priorizamos esa serialización.
    Object.entries(legacyFullState).forEach(([key, value]) => {
      if (typeof key !== 'string' || key.startsWith(RESERVED_PREFIX)) return
      try {
        localStorageState[key] = typeof value === 'string' ? value : JSON.stringify(value)
      } catch (_error) {
        // Ignora valores no serializables.
      }
    })

    return {
      localStorage: localStorageState,
      persistentState: legacyFullState,
      runtimeState: legacyFullState
    }
  }

  function isQuotaExceededError(error) {
    if (!error) return false
    return error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014
  }

  function parseMaybeJson(raw) {
    try {
      return JSON.parse(raw)
    } catch (_error) {
      return raw
    }
  }

  function readStorageValue(key) {
    const raw = localStorage.getItem(key)
    if (typeof raw !== 'string') return null
    if (!raw.startsWith(CHUNKED_MARKER_PREFIX)) return raw

    const chunkPrefix = `${key}__chunk__`
    const chunkCountKey = `${key}__chunks_count`
    const count = parseInt(localStorage.getItem(chunkCountKey) || '0', 10)
    if (!Number.isFinite(count) || count <= 0) return raw

    let combined = ''
    for (let index = 0; index < count; index += 1) {
      const part = localStorage.getItem(`${chunkPrefix}${index}`)
      if (typeof part !== 'string') return raw
      combined += part
    }

    return combined || raw
  }

  function tryStoreChunkedValue(key, value) {
    const chunkPrefix = `${key}__chunk__`
    const chunkCountKey = `${key}__chunks_count`
    const totalChunks = Math.ceil(value.length / CHUNK_SIZE)
    if (totalChunks <= 0) return false

    localStorage.removeItem(key)
    localStorage.removeItem(chunkCountKey)

    let cleanupIndex = 0
    while (localStorage.getItem(`${chunkPrefix}${cleanupIndex}`) !== null) {
      localStorage.removeItem(`${chunkPrefix}${cleanupIndex}`)
      cleanupIndex += 1
    }

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        const start = chunkIndex * CHUNK_SIZE
        const end = start + CHUNK_SIZE
        localStorage.setItem(`${chunkPrefix}${chunkIndex}`, value.slice(start, end))
      }
      localStorage.setItem(chunkCountKey, String(totalChunks))
      localStorage.setItem(key, `${CHUNKED_MARKER_PREFIX}${totalChunks}`)
      return true
    } catch (error) {
      if (!isQuotaExceededError(error)) throw error
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        localStorage.removeItem(`${chunkPrefix}${chunkIndex}`)
      }
      localStorage.removeItem(chunkCountKey)
      localStorage.removeItem(key)
      return false
    }
  }

  function removeChunkedValue(key) {
    const chunkPrefix = `${key}__chunk__`
    const chunkCountKey = `${key}__chunks_count`
    const count = parseInt(localStorage.getItem(chunkCountKey) || '0', 10)
    if (Number.isFinite(count) && count > 0) {
      for (let index = 0; index < count; index += 1) {
        localStorage.removeItem(`${chunkPrefix}${index}`)
      }
    }
    let cleanupIndex = 0
    while (localStorage.getItem(`${chunkPrefix}${cleanupIndex}`) !== null) {
      localStorage.removeItem(`${chunkPrefix}${cleanupIndex}`)
      cleanupIndex += 1
    }
    localStorage.removeItem(chunkCountKey)
  }

  async function applySnapshot(snapshot) {
    const normalized = normalizeSnapshot(snapshot)
    
    // Primero, limpiar persistentState ANTES de hacer nada con localStorage
    // Esto evita que el storage-shim sincronice datos viejos
    await window.persistentState?.clear?.()

    // Establecer flag para deshabilitar sincronización con persistentState
    window.__backupRestoringState = true

    try {
      // Ahora limpiar TODO localStorage (excepto prefijo reservado)
      const keysToDelete = []
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index)
        if (!key || key.startsWith(RESERVED_PREFIX)) continue
        keysToDelete.push(key)
      }
      keysToDelete.forEach(key => localStorage.removeItem(key))

      // Ahora guardar TODOS los datos del respaldo en localStorage
      const skippedLocalStorage = []
      const entriesToSave = new Map()
      
      // Agregar datos en este orden de prioridad:
      // 1. localStorage (tiene prioridad)
      Object.entries(normalized.localStorage || {}).forEach(([key, value]) => {
        if (typeof key === 'string' && !key.startsWith(RESERVED_PREFIX)) {
          entriesToSave.set(key, value)
        }
      })
      
      // 2. runtimeState (datos del runtime)
      Object.entries(normalized.runtimeState || {}).forEach(([key, value]) => {
        if (typeof key === 'string' && !key.startsWith(RESERVED_PREFIX) && !entriesToSave.has(key)) {
          entriesToSave.set(key, value)
        }
      })
      
      // 3. persistentState (fallback)
      Object.entries(normalized.persistentState || {}).forEach(([key, value]) => {
        if (typeof key === 'string' && !key.startsWith(RESERVED_PREFIX) && !entriesToSave.has(key)) {
          entriesToSave.set(key, value)
        }
      })

      // Guardar en localStorage (sin sincronizar con persistentState)
      entriesToSave.forEach((value, key) => {
        try {
          const serialized = typeof value === 'string' ? value : JSON.stringify(value)
          localStorage.setItem(key, serialized)
          
          // Si es una clave con backup, asegurar que también se guarde la copia
          if (WITH_BACKUP_COPY.has(key)) {
            localStorage.setItem(`${key}__backup`, serialized)
          }
        } catch (error) {
          if (isQuotaExceededError(error)) {
            const serialized = typeof value === 'string' ? value : JSON.stringify(value)
            if (!tryStoreChunkedValue(key, serialized)) {
              skippedLocalStorage.push(key)
            }
          } else {
            skippedLocalStorage.push(key)
          }
        }
      })

      const skippedPersistent = []
      return { skippedLocalStorage, skippedPersistent }
    } finally {
      // Limpiar flag de restore
      window.__backupRestoringState = false
    }
  }

  function downloadBackupFile() {
    const snapshot = getAppSnapshot()
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

    a.href = url
    a.download = `buen-abogado-respaldo-${dateTag}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function addBackupUi() {
    const container = document.querySelector('.configuracion-body')
    if (!container) return

    const section = document.createElement('section')
    section.className = 'config-section'
    section.innerHTML = `
      <div class="config-section-head">
        <h4>Respaldo de la aplicación</h4>
        <p>Respalda o restaura todos tus datos: artículos, carpetas y documentos.</p>
      </div>
      <div class="config-actions">
        <button class="modo config-action" type="button" id="backupDownloadBtn">Descargar respaldo</button>
        <button class="modo config-action" type="button" id="backupUploadBtn">Cargar respaldo</button>
        <button class="modo config-action" type="button" id="backupResetBtn">Restaurar app</button>
      </div>
      <input type="file" id="backupFileInput" accept="application/json,.json" hidden>
      <p class="backup-message error" id="backupMessage" role="alert" aria-live="assertive" hidden></p>
    `

    container.appendChild(section)

    const fileInput = document.getElementById('backupFileInput')
    const message = document.getElementById('backupMessage')

    function clearMessage() {
      message.textContent = ''
      message.hidden = true
    }

    function setErrorMessage(text) {
      message.textContent = text
      message.className = 'backup-message error'
      message.hidden = false
    }

    function setSuccessMessage(text) {
      message.textContent = text
      message.className = 'backup-message success'
      message.hidden = false
    }

    document.getElementById('backupDownloadBtn').addEventListener('click', () => {
      try {
        downloadBackupFile()
        setSuccessMessage('Respaldo descargado correctamente')
      } catch (error) {
        setErrorMessage(`No se pudo descargar el respaldo: ${error.message}`)
      }
    })

    document.getElementById('backupUploadBtn').addEventListener('click', () => {
      fileInput.value = ''
      fileInput.click()
    })

    document.getElementById('backupResetBtn').addEventListener('click', async () => {
      if (!confirm('¿Estás seguro? Esto borrará todos los datos de la aplicación.')) return
      try {
        const keys = []
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index)
          if (!key || key.startsWith(RESERVED_PREFIX)) continue
          keys.push(key)
        }
        keys.forEach(key => localStorage.removeItem(key))
        await window.persistentState?.clear?.()
        clearMessage()
        setTimeout(() => window.location.reload(), 200)
      } catch (error) {
        setErrorMessage(`No se pudo restaurar la app: ${error.message}`)
      }
    })

    fileInput.addEventListener('change', async event => {
      const file = event.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const snapshot = JSON.parse(text)
        const result = await applySnapshot(snapshot)
        const skippedTotal = result.skippedLocalStorage.length + result.skippedPersistent.length

        if (skippedTotal > 0) {
          const detalles = [
            result.skippedLocalStorage.length
              ? `LocalStorage: ${result.skippedLocalStorage.join(', ')}`
              : null,
            result.skippedPersistent.length
              ? `Persistente: ${result.skippedPersistent.join(', ')}`
              : null
          ]
            .filter(Boolean)
            .join(' | ')

          setErrorMessage(`Respaldo cargado parcialmente: faltaron ${skippedTotal} clave(s). ${detalles}`)
        } else {
          setSuccessMessage('Respaldo cargado correctamente. La aplicación se recargará en breve...')
        }

        // Espera más tiempo y fuerza reload sin cachés
        setTimeout(() => {
          try {
            // Fuerza un reload completo sin cachés
            window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now()
          } catch (_e) {
            // Fallback si falla
            location.reload(true)
          }
        }, 2500)
      } catch (error) {
        setErrorMessage(`No se pudo cargar el respaldo: ${error.message}`)
      }
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addBackupUi)
  } else {
    addBackupUi()
  }
})()