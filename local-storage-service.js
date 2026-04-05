(function initLocalStorageService() {
  const RESERVED_PREFIX = '__cloud_'

  function listEntries() {
    const entries = {}
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key || key.startsWith(RESERVED_PREFIX)) continue
      entries[key] = localStorage.getItem(key)
    }
    return entries
  }

  function exportSnapshot() {
    return {
      savedAt: Date.now(),
      schemaVersion: 1,
      entries: listEntries()
    }
  }

  function importSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || typeof snapshot.entries !== 'object') {
      throw new Error('Snapshot inválido.')
    }

    const currentKeys = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key || key.startsWith(RESERVED_PREFIX)) continue
      currentKeys.push(key)
    }

    currentKeys.forEach(key => localStorage.removeItem(key))
    Object.entries(snapshot.entries).forEach(([key, value]) => {
      if (typeof key === 'string' && !key.startsWith(RESERVED_PREFIX)) {
        localStorage.setItem(key, value)
      }
    })
  }

  function getDataFingerprint() {
    const snapshot = exportSnapshot()
    return JSON.stringify(snapshot.entries)
  }

  window.LocalStorageService = {
    exportSnapshot,
    importSnapshot,
    getDataFingerprint
  }
})()
