;(function initChunkedStorageShim() {
  const CHUNK_MARKER_PREFIX = '__chunked__:'
  const CHUNK_SIZE = 350000
  const CHUNK_SUFFIX = '__chunk__'
  const CHUNK_COUNT_SUFFIX = '__chunks_count'

  if (typeof Storage === 'undefined' || Storage.prototype.__chunkedShimInstalled) return

  const originalGetItem = Storage.prototype.getItem
  const originalSetItem = Storage.prototype.setItem
  const originalRemoveItem = Storage.prototype.removeItem

  function chunkKey(baseKey, index) {
    return `${baseKey}${CHUNK_SUFFIX}${index}`
  }

  function chunkCountKey(baseKey) {
    return `${baseKey}${CHUNK_COUNT_SUFFIX}`
  }

  function parseChunkCount(markerValue) {
    if (typeof markerValue !== 'string' || !markerValue.startsWith(CHUNK_MARKER_PREFIX)) return null
    const count = parseInt(markerValue.slice(CHUNK_MARKER_PREFIX.length), 10)
    return Number.isFinite(count) && count > 0 ? count : null
  }

  function clearChunkArtifacts(storage, key) {
    const countRaw = originalGetItem.call(storage, chunkCountKey(key))
    const count = parseInt(countRaw || '0', 10)

    if (Number.isFinite(count) && count > 0) {
      for (let index = 0; index < count; index += 1) {
        originalRemoveItem.call(storage, chunkKey(key, index))
      }
    }

    let index = 0
    while (originalGetItem.call(storage, chunkKey(key, index)) !== null) {
      originalRemoveItem.call(storage, chunkKey(key, index))
      index += 1
    }

    originalRemoveItem.call(storage, chunkCountKey(key))
  }

  Storage.prototype.getItem = function patchedGetItem(key) {
    const raw = originalGetItem.call(this, key)
    const chunkCount = parseChunkCount(raw)
    if (!chunkCount) return raw

    let value = ''
    for (let index = 0; index < chunkCount; index += 1) {
      const part = originalGetItem.call(this, chunkKey(key, index))
      if (typeof part !== 'string') return null
      value += part
    }
    return value
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    const safeValue = String(value)
    clearChunkArtifacts(this, key)

    try {
      originalSetItem.call(this, key, safeValue)
      return
    } catch (error) {
      if (error?.name !== 'QuotaExceededError' && error?.code !== 22 && error?.code !== 1014) {
        throw error
      }
    }

    originalRemoveItem.call(this, key)
    const totalChunks = Math.ceil(safeValue.length / CHUNK_SIZE)
    if (totalChunks <= 0) {
      originalSetItem.call(this, key, '')
      return
    }

    try {
      for (let index = 0; index < totalChunks; index += 1) {
        const start = index * CHUNK_SIZE
        const end = start + CHUNK_SIZE
        originalSetItem.call(this, chunkKey(key, index), safeValue.slice(start, end))
      }
      originalSetItem.call(this, chunkCountKey(key), String(totalChunks))
      originalSetItem.call(this, key, `${CHUNK_MARKER_PREFIX}${totalChunks}`)
    } catch (error) {
      clearChunkArtifacts(this, key)
      originalRemoveItem.call(this, key)
      throw error
    }
  }

  Storage.prototype.removeItem = function patchedRemoveItem(key) {
    clearChunkArtifacts(this, key)
    originalRemoveItem.call(this, key)
  }

  Storage.prototype.__chunkedShimInstalled = true
})()
