/**
 * Sistema de Respaldo SIMPLE y ROBUSTO
 * - Sin localStorage
 * - Sin chunking
 * - Un JSON limpio que guarda TODO
 */

(function initSimpleBackup() {
  // IDs de los botones
  const DOWNLOAD_BUTTON_ID = 'backupDownloadBtn'
  const UPLOAD_BUTTON_ID = 'backupUploadBtn'
  const RESET_BUTTON_ID = 'backupResetBtn'
  const UPLOAD_INPUT_ID = 'inputCargarRespaldoSimple'

  /**
   * Recopila TODOS los datos de la app en un objeto limpio
   */
  function recopilarDatos() {
    const datos = {
      app: 'Buen Abogado',
      version: '2.0',
      exportDate: new Date().toISOString(),
      
      // Datos principales
      articulos: Array.isArray(window.articulos) ? JSON.parse(JSON.stringify(window.articulos)) : [],
      carpetas: Array.isArray(window.carpetas) ? JSON.parse(JSON.stringify(window.carpetas)) : [],
      materiasOrden: typeof window.materiasOrden === 'object' ? JSON.parse(JSON.stringify(window.materiasOrden)) : {},
      documentosSidebarIds: Array.isArray(window.documentosSidebarIds) ? JSON.parse(JSON.stringify(window.documentosSidebarIds)) : [],
      
      // Documentos
      documentosCargados: Array.isArray(window.documentosCargados) ? JSON.parse(JSON.stringify(window.documentosCargados)) : [],
      
      // Personalizaciones
      fondoImagenApp: typeof window.fondoImagenApp !== 'undefined' ? window.fondoImagenApp : null,
      temaOscuro: typeof window.temaOscuro !== 'undefined' ? window.temaOscuro : false,
      
      // Configuraciones
      horario: Array.isArray(window.horario) ? JSON.parse(JSON.stringify(window.horario)) : [],
      notas: Array.isArray(window.notas) ? JSON.parse(JSON.stringify(window.notas)) : [],
      tareas: Array.isArray(window.tareas) ? JSON.parse(JSON.stringify(window.tareas)) : [],
      calificaciones: Array.isArray(window.calificaciones) ? JSON.parse(JSON.stringify(window.calificaciones)) : []
    }

    return datos
  }

  /**
   * Restaura la app a estado inicial
   */
  function restaurarApp() {
    if (!confirm('⚠️ Esto eliminará TODOS tus datos. ¿Estás seguro?\n\nDescarga un respaldo antes si quieres guardar tus datos.')) {
      return
    }

    try {
      // Limpiar todas las variables globales
      window.articulos = []
      window.carpetas = []
      window.materiasOrden = {}
      window.documentosSidebarIds = []
      window.documentosCargados = []
      window.fondoImagenApp = null
      window.temaOscuro = false
      window.horario = []
      window.notas = []
      window.tareas = []
      window.calificaciones = []

      // Limpiar localStorage
      const keysToDelete = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && !key.startsWith('__backup_tool_')) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => localStorage.removeItem(key))

      // Limpiar persistentState si existe
      if (window.persistentState && typeof window.persistentState.clear === 'function') {
        window.persistentState.clear()
      }

      console.log('[SimpleBackup] ✓ App restaurada a estado inicial')
      alert('✓ App restaurada. La página se recargará...')
      
      setTimeout(() => {
        window.location.reload()
      }, 500)

    } catch (error) {
      console.error('[SimpleBackup] Error al restaurar la app:', error)
      alert('❌ Error al restaurar: ' + error.message)
    }
  }

  /**
   * Descarga un respaldo JSON
   */
  function descargarRespaldo() {
    try {
      const datos = recopilarDatos()
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
      alert(`✓ Respaldo descargado: ${nombreArchivo}`)
    } catch (error) {
      console.error('[SimpleBackup] Error al descargar:', error)
      alert('❌ Error al descargar respaldo: ' + error.message)
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

        // Restaurar DIRECTAMENTE en las variables globales
        if (Array.isArray(datos.articulos)) {
          window.articulos = datos.articulos
          console.log('[SimpleBackup] ✓ Artículos restaurados:', datos.articulos.length)
        }

        if (Array.isArray(datos.carpetas)) {
          window.carpetas = datos.carpetas.map(c => ({
            ...c,
            color: c.color || "#1e3a8a",
            semestre: (c.semestre || "Semestre").trim() || "Semestre",
            documentos: c.documentos || [],
            documentosData: c.documentosData || {}
          }))
          console.log('[SimpleBackup] ✓ Carpetas restauradas:', datos.carpetas.length)
        }

        if (typeof datos.materiasOrden === 'object') {
          window.materiasOrden = datos.materiasOrden
          console.log('[SimpleBackup] ✓ Materias orden restaurado')
        }

        if (Array.isArray(datos.documentosSidebarIds)) {
          window.documentosSidebarIds = datos.documentosSidebarIds
          console.log('[SimpleBackup] ✓ Sidebar IDs restaurado')
        }

        if (Array.isArray(datos.documentosCargados)) {
          window.documentosCargados = datos.documentosCargados
          console.log('[SimpleBackup] ✓ Documentos cargados restaurados:', datos.documentosCargados.length)
        }

        if (datos.fondoImagenApp !== null && typeof datos.fondoImagenApp !== 'undefined') {
          window.fondoImagenApp = datos.fondoImagenApp
          aplicarFondoImagenApp(window.fondoImagenApp)
          console.log('[SimpleBackup] ✓ Fondo de pantalla restaurado')
        }

        if (typeof datos.temaOscuro === 'boolean') {
          window.temaOscuro = datos.temaOscuro
          console.log('[SimpleBackup] ✓ Tema restaurado')
        }

        if (Array.isArray(datos.horario)) {
          window.horario = datos.horario
          console.log('[SimpleBackup] ✓ Horario restaurado')
        }

        if (Array.isArray(datos.notas)) {
          window.notas = datos.notas
          console.log('[SimpleBackup] ✓ Notas restauradas')
        }

        if (Array.isArray(datos.tareas)) {
          window.tareas = datos.tareas
          console.log('[SimpleBackup] ✓ Tareas restauradas')
        }

        if (Array.isArray(datos.calificaciones)) {
          window.calificaciones = datos.calificaciones
          console.log('[SimpleBackup] ✓ Calificaciones restauradas')
        }

        console.log('[SimpleBackup] ✓✓✓ RESPALDO CARGADO EXITOSAMENTE')
        alert('✓ Respaldo cargado exitosamente. La página se recargará...')
        
        // Recargar después de 1 segundo para que se reconstruya la UI
        setTimeout(() => {
          window.location.reload()
        }, 1000)

      } catch (error) {
        console.error('[SimpleBackup] Error al cargar respaldo:', error)
        alert('❌ Error al cargar respaldo: ' + error.message)
      }
    }

    lector.onerror = function() {
      alert('❌ Error al leer el archivo')
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
