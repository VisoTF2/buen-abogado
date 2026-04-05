(function initBackupTransfer() {
  const RESERVED_PREFIX = '__backup_tool_'

  function getAppSnapshot() {
    const entries = {}
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key || key.startsWith(RESERVED_PREFIX)) continue
      entries[key] = localStorage.getItem(key)
    }

    return {
      app: 'Buen abogado',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      entries
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

    Object.entries(snapshot.entries).forEach(([key, value]) => {
      if (typeof key !== 'string' || key.startsWith(RESERVED_PREFIX)) return
      localStorage.setItem(key, value)
    })
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

    fileInput.addEventListener('change', async event => {
      const file = event.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const snapshot = JSON.parse(text)
        applySnapshot(snapshot)
        clearMessage()
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
