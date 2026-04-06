/**
 * Sistema de Respaldo SIMPLE y ROBUSTO
 * Lee/escribe DIRECTAMENTE de localStorage
 */

(function initSimpleBackup() {
  const DOWNLOAD_BUTTON_ID = 'backupDownloadBtn'
  const UPLOAD_BUTTON_ID = 'backupUploadBtn'
  const RESET_BUTTON_ID = 'backupResetBtn'
  const UPLOAD_INPUT_ID = 'inputCargarRespaldoSimple'

  /**
   * Fuerza el guardado de TODOS los datos globales a localStorage
   * (por si alguno no se guardó automáticamente)
   */
  function forzarGuardadoGlobal() {
    console.log('[SimpleBackup] Forzando guardado global...')
    
    // Articulos
    if (window.articulos && Array.isArray(window.articulos)) {
      const serializado = JSON.stringify(window.articulos)
      localStorage.setItem('articulosGuardados', serializado)
      console.log('[SimpleBackup] ✓ articulosGuardados forzado:', window.articulos.length, 'items')
    }
    
    // Carpetas
    if (window.carpetas && Array.isArray(window.carpetas)) {
      const serializado = JSON.stringify(window.carpetas)
      localStorage.setItem('carpetasMaterias', serializado)
      console.log('[SimpleBackup] ✓ carpetasMaterias forzado:', window.carpetas.length, 'items')
    }
    
    // Materias orden
    if (window.materiasOrden && typeof window.materiasOrden === 'object') {
      const serializado = JSON.stringify(window.materiasOrden)
      localStorage.setItem('materiasOrden', serializado)
      console.log('[SimpleBackup] ✓ materiasOrden forzado')
    }
    
    // Documentos sidebar IDs
    if (window.documentosSidebarIds && Array.isArray(window.documentosSidebarIds)) {
      const serializado = JSON.stringify(window.documentosSidebarIds)
      localStorage.setItem('documentosSidebarIds', serializado)
      console.log('[SimpleBackup] ✓ documentosSidebarIds forzado')
    }
    
    // Documentos cargados
    if (window.documentosCargados && Array.isArray(window.documentosCargados)) {
      const serializado = JSON.stringify(window.documentosCargados)
      localStorage.setItem('documentosSubidos', serializado)
      console.log('[SimpleBackup] ✓ documentosSubidos forzado:', window.documentosCargados.length, 'items')
    }
    
    // Fondo imagen
    if (window.fondoImagenApp && typeof window.fondoImagenApp === 'string') {
      localStorage.setItem('fondoImagenApp', window.fondoImagenApp)
      console.log('[SimpleBackup] ✓ fondoImagenApp forzado')
    }
    
    // Tema oscuro
    if (typeof window.temaOscuro === 'boolean') {
      localStorage.setItem('modoOscuroActivo', window.temaOscuro ? 'true' : 'false')
      console.log('[SimpleBackup] ✓ modoOscuroActivo forzado')
    }
    
    console.log('[SimpleBackup] ✓✓✓ Guardado global completado')
  }

  /**
   * Lee TODO lo que hay en localStorage y lo empaqueta
   */
  function recopilarDatos() {
    const datos = {
      app: 'Buen Abogado',
      version: '2.0',
      exportDate: new Date().toISOString(),
      localStorage: {}
    }

    // Copiar TODO de localStorage (excepto prefijos internos)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      
      // Ignorar claves internas
      if (key.startsWith('__backup_tool_')) continue
      
      const value = localStorage.getItem(key)
      if (typeof value === 'string') {
        datos.localStorage[key] = value
      }
    }

    return datos
  }

  /**
   * Restaura la app a estado inicial
   */
  function restaurarApp() {
    try {
      // Limpiar persistentState PRIMERO
      if (window.persistentState && typeof window.persistentState.clear === 'function') {
        window.persistentState.clear()
        console.log('[SimpleBackup] persistentState limpiado')
      }

      // Limpiar localStorage
      const keysToDelete = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && !key.startsWith('__backup_tool_')) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => {
        localStorage.removeItem(key)
        console.log('[SimpleBackup] Borrado:', key)
      })

      console.log('[SimpleBackup] ✓ App restaurada a estado inicial')
      
      setTimeout(() => {
        window.location.reload()
      }, 500)

    } catch (error) {
      console.error('[SimpleBackup] Error al restaurar la app:', error)
    }
  }

  /**
   * Descarga un respaldo JSON
   */
  function descargarRespaldo() {
    try {
      // PRIMERO: Forzar que TODO se guarde a localStorage
      forzarGuardadoGlobal()
      
      // SEGUNDO: Recopilar datos
      const datos = recopilarDatos()
      
      console.log('[SimpleBackup] Datos a descargar:', Object.keys(datos.localStorage).length, 'keys')
      Object.keys(datos.localStorage).forEach(key => {
        const valor = datos.localStorage[key]
        const tamano = new Blob([valor]).size
        console.log(`  - ${key}: ${tamano} bytes`)
      })

      const json = JSON.stringify(datos, null, 2)
      const blob = new Blob([json], { type: 'application/json; charset=utf-8' })
      const url = URL.createObjectURL(blob)
      
      const ahora = new Date()
      const fecha = ahora.toISOString().split('T')[0]
      const hora = ahora.toTimeString().split(' ')[0].replace(/:/g, '-')
      const nombreArchivo = `buen-abogado-${fecha}-${hora}.json`
      
      const link = document.createElement('a')
      link.href = url
      link.download = nombreArchivo
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      console.log('[SimpleBackup] ✓ Respaldo descargado:', nombreArchivo)
    } catch (error) {
      console.error('[SimpleBackup] Error al descargar:', error)
    }
  }

  /**
   * Carga un respaldo JSON
   */
  function cargarRespaldo(archivo) {
    const lector = new FileReader()
    
    lector.onload = function(evento) {
      try {
        const contenido = evento.target.result
        const datos = JSON.parse(contenido)
        
        console.log('[SimpleBackup] Cargando respaldo...', datos)

        // Validar que sea un respaldo válido
        if (datos.app !== 'Buen Abogado') {
          throw new Error('El archivo no parece ser un respaldo válido de Buen Abogado')
        }

        // PASO 1: Limpiar persistentState
        if (window.persistentState && typeof window.persistentState.clear === 'function') {
          window.persistentState.clear()
          console.log('[SimpleBackup] persistentState limpiado')
        }

        // PASO 2: Limpiar localStorage
        const keysToDelete = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && !key.startsWith('__backup_tool_')) {
            keysToDelete.push(key)
          }
        }
        keysToDelete.forEach(key => {
          localStorage.removeItem(key)
          console.log('[SimpleBackup] Borrado de localStorage:', key)
        })

        // PASO 3: Restaurar TODAS las claves del respaldo a localStorage
        if (datos.localStorage && typeof datos.localStorage === 'object') {
          Object.entries(datos.localStorage).forEach(([key, value]) => {
            try {
              localStorage.setItem(key, value)
              console.log('[SimpleBackup] Restaurado en localStorage:', key)
            } catch (error) {
              console.error('[SimpleBackup] Error al guardar', key, ':', error)
            }
          })
        }

        // PASO 4: También guardar en persistentState para compatibilidad
        if (datos.localStorage && typeof datos.localStorage === 'object' && window.persistentState) {
          Object.entries(datos.localStorage).forEach(([key, value]) => {
            try {
              const parsed = JSON.parse(value)
              window.persistentState.set(key, parsed)
              console.log('[SimpleBackup] Guardado en persistentState:', key)
            } catch (e) {
              // Si no es JSON válido, ignorar
              console.log('[SimpleBackup] No se guardó en persistentState (no-JSON):', key)
            }
          })
        }

        console.log('[SimpleBackup] ✓✓✓ RESPALDO COMPLETAMENTE CARGADO')
        
        // PASO 5: Recargar para que todo se reconstruya
        setTimeout(() => {
          window.location.reload()
        }, 500)

      } catch (error) {
        console.error('[SimpleBackup] Error al cargar respaldo:', error)
      }
    }

    lector.onerror = function() {
      console.error('[SimpleBackup] Error al leer el archivo')
    }

    lector.readAsText(archivo)
  }

  /**
   * Inicializa los botones y listeners
   */
  function inicializar() {
    // Crear input file oculto
    let inputCargar = document.getElementById(UPLOAD_INPUT_ID)
    if (!inputCargar) {
      inputCargar = document.createElement('input')
      inputCargar.id = UPLOAD_INPUT_ID
      inputCargar.type = 'file'
      inputCargar.accept = '.json'
      inputCargar.style.display = 'none'
      document.body.appendChild(inputCargar)
    }

    // Event listener para cargar archivo
    inputCargar.addEventListener('change', (evento) => {
      const archivo = evento.target.files[0]
      if (archivo) {
        cargarRespaldo(archivo)
      }
      // Limpiar para poder cargar el mismo archivo de nuevo
      inputCargar.value = ''
    })

    // Botón descargar
    const btnDescargar = document.getElementById(DOWNLOAD_BUTTON_ID)
    if (btnDescargar) {
      btnDescargar.addEventListener('click', descargarRespaldo)
      console.log('[SimpleBackup] ✓ Botón descargar inicializado')
    }

    // Botón cargar
    const btnCargar = document.getElementById(UPLOAD_BUTTON_ID)
    if (btnCargar) {
      btnCargar.addEventListener('click', () => {
        inputCargar.click()
      })
      console.log('[SimpleBackup] ✓ Botón cargar inicializado')
    }

    // Botón restaurar app
    const btnRestore = document.getElementById(RESET_BUTTON_ID)
    if (btnRestore) {
      btnRestore.addEventListener('click', restaurarApp)
      console.log('[SimpleBackup] ✓ Botón restaurar app inicializado')
    }

    console.log('[SimpleBackup] ✓ Sistema de respaldo simple inicializado')
  }

  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar)
  } else {
    inicializar()
  }

  // Exportar para acceso manual
  window.SimpleBackup = {
    descargar: descargarRespaldo,
    cargar: (archivo) => cargarRespaldo(archivo),
    recopilaDatos: recopilarDatos
  }

})()
