;(function initPersistentState() {
  const DB_NAME = 'buen-abogado-persistent-state'
  const STORE_NAME = 'state'
  const cache = {}

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async function loadAllIntoCache() {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => {
        const rows = request.result || []
        rows.forEach(row => {
          cache[row.key] = row.value
        })
      }
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }

  async function putValue(key, value) {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ key, value })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }

  async function deleteValue(key) {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }

  async function clearAll() {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }

  const ready = loadAllIntoCache().catch(() => {})

  window.persistentState = {
    ready,
    getCached(key) {
      return cache[key]
    },
    exportAll() {
      return { ...cache }
    },
    set(key, value) {
      cache[key] = value
      return putValue(key, value).catch(() => {})
    },
    remove(key) {
      delete cache[key]
      return deleteValue(key).catch(() => {})
    },
    clear() {
      Object.keys(cache).forEach(key => delete cache[key])
      return clearAll().catch(() => {})
    }
  }
})()
