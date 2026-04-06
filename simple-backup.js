/**
 * MEMORY-BASED BACKUP SYSTEM
 * 
 * Versión 3.0 - Basada en snapshot directo de memoria
 * - Descargar: captura window.articulos, window.fondoImagenApp, etc. → JSON
 * - Cargar: JSON → IndexedDB → Reload
 * 
 * Evita problemas de localStorage
 */

(function() {
  'use strict'

  /**
   * DESCARGAR RESPALDO
   * Toma snapshot del estado actual en memoria y descarga como JSON
   */
  window.descargarRespaldo = function descargarRespaldo() {
    try {
      console.log('[MemoryBackup] Iniciando descarga de respaldo...')

      // TOMAR SNAPSHOT DEL ESTADO ACTUAL EN MEMORIA
      const backup = {
        version: '3.0-memory-based',
        timestamp: new Date().toISOString(),
        data: {
          articulos: window.articulos || [],
          carpetas: window.carpetas || [],
          materiasOrden: window.materiasOrden || {},
          documentosSidebarIds: window.documentosSidebarIds || [],
          documentosCargados: window.documentosCargados || [],
          fondoImagenApp: window.fondoImagenApp || "",
          temaOscuro: typeof window.temaOscuro === 'boolean' ? window.temaOscuro : false
        }
      }

      // Validar datos
      console.log('[MemoryBackup] Estado capturado:', {
        articulosCount: backup.data.articulos.length,
        carpetasCount: backup.data.carpetas.length,
        fondoImagenAppLength: backup.data.fondoImagenApp.length,
        documentosCargadosCount: backup.data.documentosCargados.length,
        temaOscuro: backup.data.temaOscuro
      })

      // Crear JSON
      const jsonStr = JSON.stringify(backup, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json; charset=utf-8' })

      // Generar nombre de archivo con timestamp
      const ahora = new Date()
      const fecha = ahora.toISOString().split('T')[0]
      const hora = ahora.toTimeString().split(' ')[0].replace(/:/g, '-')
      const nombre = `buen-abogado-${fecha}-${hora}.json`

      // Descargar
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = nombre
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log('[MemoryBackup] ✓ Respaldo descargado:', nombre)

    } catch (error) {
      console.error('[MemoryBackup] Error descargando respaldo:', error)
    }
  }

  /**
   * CARGAR RESPALDO
   * Lee JSON desde archivo y restaura a IndexedDB
   */
  window.cargarRespaldo = function cargarRespaldo(archivo) {
    if (!archivo) {
      return
    }

    const lector = new FileReader()

    lector.onload = async function(evento) {
      try {
        console.log('[MemoryBackup] Leyendo archivo respaldo...')
        const contenido = evento.target.result
        const backup = JSON.parse(contenido)

        // Validar estructura
        if (!backup.data || backup.version === undefined) {
          throw new Error('Archivo de respaldo no válido o corrupto')
        }

        console.log('[MemoryBackup] Archivo válido, datos encontrados:', {
          articulos: backup.data.articulos?.length || 0,
          carpetas: backup.data.carpetas?.length || 0,
          fondoImagenApp: backup.data.fondoImagenApp?.substring(0, 50) + '...'
        })

        // PASO 1: Guardar TODO a IndexedDB (persistentState)
        if (window.persistentState && typeof window.persistentState.set === 'function') {
          console.log('[MemoryBackup] Guardando a IndexedDB...')

          const promesas = [
            window.persistentState.set('articulosGuardados', backup.data.articulos || []),
            window.persistentState.set('carpetasMaterias', backup.data.carpetas || []),
            window.persistentState.set('materiasOrden', backup.data.materiasOrden || {}),
            window.persistentState.set('documentosSidebarIds', backup.data.documentosSidebarIds || []),
            window.persistentState.set('documentosSubidos', backup.data.documentosCargados || []),
            window.persistentState.set('fondoImagenApp', backup.data.fondoImagenApp || "")
          ]

          if (typeof backup.data.temaOscuro === 'boolean') {
            promesas.push(
              window.persistentState.set('modoOscuroActivo', backup.data.temaOscuro ? 'true' : 'false')
            )
          }

          await Promise.all(promesas).catch(err => {
            console.warn('[MemoryBackup] Error parcial en persistentState:', err)
          })

          console.log('[MemoryBackup] ✓ Datos guardados a IndexedDB')
        } else {
          console.warn('[MemoryBackup] persistentState no disponible, fallback a localStorage')
          
          // Fallback a localStorage si IndexedDB no está disponible
          localStorage.setItem('articulosGuardados', JSON.stringify(backup.data.articulos || []))
          localStorage.setItem('carpetasMaterias', JSON.stringify(backup.data.carpetas || []))
          localStorage.setItem('materiasOrden', JSON.stringify(backup.data.materiasOrden || {}))
          localStorage.setItem('documentosSidebarIds', JSON.stringify(backup.data.documentosSidebarIds || []))
          localStorage.setItem('documentosSubidos', JSON.stringify(backup.data.documentosCargados || []))
          localStorage.setItem('fondoImagenApp', backup.data.fondoImagenApp || "")
          localStorage.setItem('modoOscuroActivo', backup.data.temaOscuro ? 'true' : 'false')
        }

        console.log('[MemoryBackup] ✓✓✓ Respaldo cargado completamente')
        console.log('[MemoryBackup] Recargando aplicación...')

        // PASO 2: Recargar para que app lea desde IndexedDB/localStorage
        setTimeout(() => {
          window.location.reload()
        }, 500)

      } catch (error) {
        console.error('[MemoryBackup] Error cargando respaldo:', error)
      }
    }

    lector.onerror = function() {
      console.error('[MemoryBackup] Error leyendo archivo')
    }

    lector.readAsText(archivo)
  }

  /**
   * RESTAURAR APP
   * Limpia TODO y vuelve a estado inicial
   */
  window.restaurarApp = function restaurarApp() {
    try {
      console.log('[MemoryBackup] Restaurando app a estado inicial...')

      // Limpiar IndexedDB
      if (window.persistentState && typeof window.persistentState.clear === 'function') {
        window.persistentState.clear()
        console.log('[MemoryBackup] IndexedDB limpiado')
      }

      // Limpiar localStorage
      const keysToDelete = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && !key.startsWith('__backup_tool_')) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => localStorage.removeItem(key))
      console.log('[MemoryBackup] localStorage limpiado')

      console.log('[MemoryBackup] ✓ App restaurada. Recargando...')

      // Recargar
      setTimeout(() => {
        window.location.reload()
      }, 500)

    } catch (error) {
      console.error('[MemoryBackup] Error restaurando:', error)
    }
  }

  // Inicializar listeners de botones cuando el DOM esté listo
  function inicializarBotones() {
    const btnDescargar = document.getElementById('backupDownloadBtn')
    const btnCargar = document.getElementById('backupUploadBtn')
    const btnRestaurar = document.getElementById('backupResetBtn')
    const inputArchivo = document.getElementById('inputCargarRespaldoSimple')

    if (btnDescargar) {
      btnDescargar.addEventListener('click', descargarRespaldo)
    }

    if (btnCargar && inputArchivo) {
      btnCargar.addEventListener('click', () => inputArchivo.click())
    }

    if (inputArchivo) {
      inputArchivo.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          cargarRespaldo(e.target.files[0])
        }
      })
    }

    if (btnRestaurar) {
      btnRestaurar.addEventListener('click', restaurarApp)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarBotones)
  } else {
    inicializarBotones()
  }

  console.log('[MemoryBackup] Sistema de respaldo basado en memoria cargado (v3.0)')

})()
