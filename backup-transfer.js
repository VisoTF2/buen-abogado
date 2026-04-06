(function initBackupTransfer() {
  const RESERVED_PREFIX = '__backup_tool_'
  const CHUNKED_MARKER_PREFIX = '__chunked__:'
  const CHUNK_SIZE = 350000
  const CHUNK_INDEX_PATTERN = /__chunk__\d+$/
  const CHUNK_COUNT_PATTERN = /__chunks_count$/
  const BACKUP_COPY_PATTERN = /__backup$/

  function getAppSnapshot() {
    const rawEntries = {}
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key || key.startsWith(RESERVED_PREFIX)) continue
      if (CHUNK_INDEX_PATTERN.test(key) || CHUNK_COUNT_PATTERN.test(key)) continue
      rawEntries[key] = localStorage.getItem(key)
    }

    const entries = {}
    const keys = Object.keys(rawEntries)

    keys.forEach(key => {
      if (BACKUP_COPY_PATTERN.test(key)) return

      const backupKey = `${key}__backup`
      const principal = rawEntries[key]
      const respaldo = rawEntries[backupKey]
      entries[key] = elegirValorExportable(principal, respaldo)
    })

    keys.forEach(key => {
      if (!BACKUP_COPY_PATTERN.test(key)) return
      const baseKey = key.replace(BACKUP_COPY_PATTERN, '')
      if (Object.prototype.hasOwnProperty.call(entries, baseKey)) return
      entries[baseKey] = rawEntries[key]
    })

    return {
      app: 'Buen abogado',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      entries
    }
  }

  function elegirValorExportable(principal, respaldo) {
    const principalParseado = intentarParseJSON(principal)
    if (principalParseado.ok) return principal

    const respaldoParseado = intentarParseJSON(respaldo)
    if (respaldoParseado.ok) return respaldo

    return principal ?? respaldo ?? null
  }

  function intentarParseJSON(valor) {
    if (typeof valor !== 'string') return { ok: false }
    try {
      JSON.parse(valor)
      return { ok: true }
    } catch (_error) {
      return { ok: false }
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

  function applySnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || typeof snapshot.entries !== 'object') {
      throw new Error('El archivo de respaldo no tiene un formato válido.')
    }

    const keysToDelete = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key || key.startsWith(RESERVED_PREFIX)) continue
      keysToDelete.push(key)
    }

    keysToDelete.forEach(key => localStorage.removeItem(key))

    const skippedByQuota = []
    const entries = Object.entries(snapshot.entries)
      .filter(([key]) => typeof key === 'string' && !key.startsWith(RESERVED_PREFIX))
      .filter(([key]) => !BACKUP_COPY_PATTERN.test(key))
      .sort(([, valueA], [, valueB]) => String(valueA ?? '').length - String(valueB ?? '').length)

    entries.forEach(([key, value]) => {
      const safeValue = typeof value === 'string' ? value : JSON.stringify(value)

      try {
        localStorage.setItem(key, safeValue)
      } catch (error) {
        if (isQuotaExceededError(error)) {
          const storedAsChunks = tryStoreChunkedValue(key, safeValue)
          if (storedAsChunks) return
          skippedByQuota.push(key)
          return
        }
        throw error
      }
    })

    return {
      skippedByQuota
    }
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

    let index = 0
    while (localStorage.getItem(`${chunkPrefix}${index}`) !== null) {
      localStorage.removeItem(`${chunkPrefix}${index}`)
      index += 1
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

  function addBackupUi() {
    const container = document.querySelector('.configuracion-body')
    if (!container) return

    const section = document.createElement('section')
    section.className = 'config-section'
    section.innerHTML = `
      <div class="config-section-head">
        <h4>Respaldo entre dispositivos</h4>
        <p>Descarga un archivo de respaldo y cárgalo en otro dispositivo para migrar tus datos.</p>
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
      fileInput.value = ''
      fileInput.click()
    })

    document.getElementById('backupResetBtn').addEventListener('click', () => {
      const confirmar = window.confirm(
        'Se eliminarán los datos guardados en este dispositivo (artículos, carpetas, documentos y personalización). ¿Deseas continuar?'
      )
      if (!confirmar) return

      try {
        const keys = []
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index)
          if (!key || key.startsWith(RESERVED_PREFIX)) continue
          keys.push(key)
        }
        keys.forEach(key => localStorage.removeItem(key))
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
        const result = applySnapshot(snapshot)
        if (result.skippedByQuota.length > 0) {
          setErrorMessage(
            `Respaldo cargado parcialmente: no hubo espacio para ${result.skippedByQuota.length} elemento(s) (${result.skippedByQuota.join(', ')}).`
          )
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