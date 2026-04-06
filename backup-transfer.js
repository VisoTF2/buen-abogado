(function initBackupTransfer() {
  const RESERVED_PREFIX = '__backup_tool_'
  const CHUNKED_MARKER_PREFIX = '__chunked__:'
  const CHUNK_SIZE = 350000
  const WITH_BACKUP_COPY = new Set(['articulosGuardados', 'carpetasMaterias', 'materiasOrden'])
  const RUNTIME_PRIORITY_KEYS = [
    'articulosGuardados',
    'carpetasMaterias',
    'materiasOrden',
    'documentosSubidos',
    'documentosSidebarIds',
    'fondoImagenApp'
  ]
  const SECTION_KEYS = {
    horario: [
      'horarioClases',
      'horarioDiasActivos',
      'horarioTitulo',
      'mallaImagenHorario',
      'mallaImagenBaseHorario',
      'mallaOverlayHorario',
      'mallaActivaHorario',
      'mallaSizeHorario'
    ],
    articulos: [
      'articulosGuardados',
      'carpetasMaterias',
      'materiasOrden',
      'documentosSidebarIds',
      'materiaActivaSeleccionada',
      'materiaPreviewCerrada'
    ],
    documentos: ['documentosSubidos']
  }

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

  function getSectionSnapshot(section) {
    if (!SECTION_KEYS[section]) {
      throw new Error('Tipo de respaldo no soportado.')
    }

    const runtimeState = collectRuntimeState()
    const persistentState =
      window.persistentState?.exportAll && typeof window.persistentState.exportAll === 'function'
        ? window.persistentState.exportAll()
        : {}
    const state = {}

    SECTION_KEYS[section].forEach(key => {
      const resolved = resolveBestStateValue(key, runtimeState, persistentState)
      if (resolved === undefined) return
      state[key] = resolved
    })

    return {
      app: 'Buen abogado',
      schemaVersion: 3,
      backupType: section,
      exportedAt: new Date().toISOString(),
      state
    }
  }

  function resolveBestStateValue(key, runtimeState, persistentState) {
    if (runtimeState && key in runtimeState) return runtimeState[key]
    if (persistentState && key in persistentState) return persistentState[key]

    const raw = localStorage.getItem(key)
    if (typeof raw !== 'string') return undefined
    try {
      return JSON.parse(raw)
    } catch (_error) {
      return raw
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

      const raw = localStorage.getItem(key)
      if (typeof raw !== 'string') return
      try {
        state[key] = JSON.parse(raw)
      } catch (_error) {
        state[key] = raw
      }
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

  function normalizeSectionSnapshot(snapshot, expectedType) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('El archivo de respaldo no tiene un formato válido.')
    }

    if (snapshot.schemaVersion === 3 && snapshot.backupType && snapshot.state) {
      if (expectedType && snapshot.backupType !== expectedType) {
        throw new Error(`Este archivo corresponde a \"${snapshot.backupType}\" y no a \"${expectedType}\".`)
      }
      return {
        backupType: snapshot.backupType,
        state: snapshot.state && typeof snapshot.state === 'object' ? snapshot.state : {}
      }
    }

    // Compatibilidad: permite cargar un respaldo completo en una sección.
    const normalized = normalizeSnapshot(snapshot)
    const targetType = expectedType || 'articulos'
    const state = {}
    ;(SECTION_KEYS[targetType] || []).forEach(key => {
      if (normalized.runtimeState && key in normalized.runtimeState) {
        state[key] = normalized.runtimeState[key]
      } else if (normalized.persistentState && key in normalized.persistentState) {
        state[key] = normalized.persistentState[key]
      }
    })
    return { backupType: targetType, state }
  }

  function isQuotaExceededError(error) {
    if (!error) return false
    return error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014
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

  async function applySectionSnapshot(snapshot, expectedType) {
    const normalized = normalizeSectionSnapshot(snapshot, expectedType)
    const keys = SECTION_KEYS[normalized.backupType] || []
    const skippedLocalStorage = []
    const skippedPersistent = []

    for (const key of keys) {
      localStorage.removeItem(key)
      localStorage.removeItem(`${key}__backup`)
      removeChunkedValue(key)
      await window.persistentState?.remove?.(key)
    }

    for (const [key, value] of Object.entries(normalized.state || {})) {
      if (!keys.includes(key)) continue

      if (window.persistentState?.set) {
        await window.persistentState.set(key, value).catch(() => {
          if (!skippedPersistent.includes(key)) skippedPersistent.push(key)
        })
      }

      let serialized = null
      try {
        serialized = typeof value === 'string' ? value : JSON.stringify(value)
      } catch (_error) {
        skippedLocalStorage.push(key)
        continue
      }

      try {
        localStorage.setItem(key, serialized)
        if (WITH_BACKUP_COPY.has(key)) {
          localStorage.setItem(`${key}__backup`, serialized)
        }
      } catch (error) {
        if (!isQuotaExceededError(error) || !tryStoreChunkedValue(key, serialized)) {
          if (!skippedLocalStorage.includes(key)) skippedLocalStorage.push(key)
        }
      }
    }

    return { skippedLocalStorage, skippedPersistent }
  }

  async function applySnapshot(snapshot) {
    const normalized = normalizeSnapshot(snapshot)
    const keysToDelete = []

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key || key.startsWith(RESERVED_PREFIX)) continue
      keysToDelete.push(key)
    }

    keysToDelete.forEach(key => localStorage.removeItem(key))
    await window.persistentState?.clear?.()

    const skippedLocalStorage = []
    const localStorageEntries = Object.entries(normalized.localStorage || {})
      .filter(([key, value]) => typeof key === 'string' && !key.startsWith(RESERVED_PREFIX) && typeof value === 'string')
      .sort(([, a], [, b]) => a.length - b.length)

    localStorageEntries.forEach(([key, value]) => {
      try {
        localStorage.setItem(key, value)
      } catch (error) {
        if (isQuotaExceededError(error) && tryStoreChunkedValue(key, value)) return
        skippedLocalStorage.push(key)
      }
    })

    const skippedPersistent = []
    const persistentEntries = Object.entries(normalized.persistentState || {})
      .filter(([key]) => typeof key === 'string' && !key.startsWith(RESERVED_PREFIX))

    for (const [key, value] of persistentEntries) {
      try {
        await window.persistentState?.set?.(key, value)
      } catch (_error) {
        skippedPersistent.push(key)
      }
    }

    await applyRuntimeStateFallback(normalized.runtimeState, skippedLocalStorage, skippedPersistent)

    return { skippedLocalStorage, skippedPersistent }
  }

  async function applyRuntimeStateFallback(runtimeState, skippedLocalStorage, skippedPersistent) {
    if (!runtimeState || typeof runtimeState !== 'object') return

    for (const key of RUNTIME_PRIORITY_KEYS) {
      if (!(key in runtimeState)) continue
      const value = runtimeState[key]
      let serialized = null
      try {
        serialized = typeof value === 'string' ? value : JSON.stringify(value)
      } catch (_error) {
        if (!skippedLocalStorage.includes(key)) skippedLocalStorage.push(key)
        continue
      }

      if (window.persistentState?.set) {
        await window.persistentState.set(key, value).catch(() => {
          if (!skippedPersistent.includes(key)) skippedPersistent.push(key)
        })
      }

      try {
        localStorage.setItem(key, serialized)
        if (WITH_BACKUP_COPY.has(key)) {
          localStorage.setItem(`${key}__backup`, serialized)
        }
      } catch (error) {
        if (!isQuotaExceededError(error) || !tryStoreChunkedValue(key, serialized)) {
          if (!skippedLocalStorage.includes(key)) skippedLocalStorage.push(key)
        }
      }
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

  function downloadSectionBackupFile(section) {
    const snapshot = getSectionSnapshot(section)
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

    a.href = url
    a.download = `buen-abogado-respaldo-${section}-${dateTag}.json`
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
        <h4>Respaldo entre dispositivos</h4>
        <p>Elige qué quieres respaldar: horario, artículos o documentos.</p>
      </div>
      <div class="config-actions">
        <button class="modo config-action" type="button" id="backupDownloadHorarioBtn">Descargar horario</button>
        <button class="modo config-action" type="button" id="backupUploadHorarioBtn">Cargar horario</button>
      </div>
      <div class="config-actions">
        <button class="modo config-action" type="button" id="backupDownloadArticulosBtn">Descargar artículos</button>
        <button class="modo config-action" type="button" id="backupUploadArticulosBtn">Cargar artículos</button>
      </div>
      <div class="config-actions">
        <button class="modo config-action" type="button" id="backupDownloadDocumentosBtn">Descargar documentos</button>
        <button class="modo config-action" type="button" id="backupUploadDocumentosBtn">Cargar documentos</button>
      </div>
      <div class="config-actions">
        <button class="modo config-action" type="button" id="backupDownloadBtn">Descargar respaldo completo</button>
        <button class="modo config-action" type="button" id="backupUploadBtn">Cargar respaldo completo</button>
        <button class="modo config-action" type="button" id="backupResetBtn">Restaurar app</button>
      </div>
      <input type="file" id="backupFileInput" accept="application/json,.json" hidden>
      <p class="backup-message error" id="backupMessage" role="alert" aria-live="assertive" hidden></p>
    `

    container.appendChild(section)

    const fileInput = document.getElementById('backupFileInput')
    const message = document.getElementById('backupMessage')
    let uploadMode = 'full'

    function clearMessage() {
      message.textContent = ''
      message.hidden = true
    }

    function setErrorMessage(text) {
      message.textContent = text
      message.hidden = false
    }

    document.getElementById('backupDownloadBtn').addEventListener('click', () => {
      try {
        downloadBackupFile()
        clearMessage()
      } catch (error) {
        setErrorMessage(`No se pudo descargar el respaldo: ${error.message}`)
      }
    })

    document.getElementById('backupUploadBtn').addEventListener('click', () => {
      uploadMode = 'full'
      fileInput.value = ''
      fileInput.click()
    })

    document.getElementById('backupDownloadHorarioBtn').addEventListener('click', () => {
      try {
        downloadSectionBackupFile('horario')
        clearMessage()
      } catch (error) {
        setErrorMessage(`No se pudo descargar el respaldo de horario: ${error.message}`)
      }
    })

    document.getElementById('backupDownloadArticulosBtn').addEventListener('click', () => {
      try {
        downloadSectionBackupFile('articulos')
        clearMessage()
      } catch (error) {
        setErrorMessage(`No se pudo descargar el respaldo de artículos: ${error.message}`)
      }
    })

    document.getElementById('backupDownloadDocumentosBtn').addEventListener('click', () => {
      try {
        downloadSectionBackupFile('documentos')
        clearMessage()
      } catch (error) {
        setErrorMessage(`No se pudo descargar el respaldo de documentos: ${error.message}`)
      }
    })

    document.getElementById('backupUploadHorarioBtn').addEventListener('click', () => {
      uploadMode = 'horario'
      fileInput.value = ''
      fileInput.click()
    })

    document.getElementById('backupUploadArticulosBtn').addEventListener('click', () => {
      uploadMode = 'articulos'
      fileInput.value = ''
      fileInput.click()
    })

    document.getElementById('backupUploadDocumentosBtn').addEventListener('click', () => {
      uploadMode = 'documentos'
      fileInput.value = ''
      fileInput.click()
    })

    document.getElementById('backupResetBtn').addEventListener('click', async () => {
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
        const result =
          uploadMode === 'full' ? await applySnapshot(snapshot) : await applySectionSnapshot(snapshot, uploadMode)
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
          clearMessage()
        }

        setTimeout(() => window.location.reload(), 500)
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