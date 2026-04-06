/**
 * SISTEMA DE EXPORTAR/IMPORTAR ARTÍCULOS
 * 
 * - Exportar: descarga JSON con todos los artículos
 * - Importar: carga artículos desde JSON y los agrega
 */

(function() {
  'use strict'
  const HORARIO_KEYS = ['horarioClases', 'horarioTitulo', 'horarioDiasActivos']
  const MALLA_KEYS = ['mallaImagenHorario', 'mallaImagenBaseHorario', 'mallaOverlayHorario', 'mallaActivaHorario', 'mallaSizeHorario']
  const ESTILO_KEYS = ['modoOscuroActivo', 'fondoImagenApp', 'colorAcentoApp', 'colorAcentoModoOscuro']
  const CALENDARIO_KEYS = ['calendarEvents', 'calendarEvents__backup']
  const RAMOS_KEYS = ['materiasOrden', 'gradeCalculatorSubjectsV2']
  const DOCUMENTOS_STORAGE_KEY = 'documentosSubidos'
  const DOCUMENTOS_CHUNK_PREFIX = `${DOCUMENTOS_STORAGE_KEY}__chunk__`
  const DOCUMENTOS_CHUNK_COUNT_KEY = `${DOCUMENTOS_STORAGE_KEY}__chunks_count`
  const DOCUMENTOS_CHUNK_SIZE = 350000

  /**
   * Mostrar notificación temporal
   */
  function mostrarNotificacion(mensaje, tipo = 'info') {
    // Crear elemento de notificación
    const notif = document.createElement('div')
    notif.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 16px 20px;
      background: ${tipo === 'success' ? '#4caf50' : tipo === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-size: 14px;
      z-index: 9999;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `
    notif.textContent = mensaje
    document.body.appendChild(notif)

    // Agregar animación si no existe
    if (!document.querySelector('style[data-notif-anim-articles]')) {
      const style = document.createElement('style')
      style.setAttribute('data-notif-anim-articles', '')
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(400px); opacity: 0; }
        }
      `
      document.head.appendChild(style)
    }

    // Auto-remover después de 4 segundos
    setTimeout(() => {
      notif.style.animation = 'slideOut 0.3s ease-out'
      setTimeout(() => {
        if (notif.parentElement) {
          notif.parentElement.removeChild(notif)
        }
      }, 300)
    }, 4000)
  }

  function limpiarChunksDocumentosCompat() {
    const chunksCount = parseInt(localStorage.getItem(DOCUMENTOS_CHUNK_COUNT_KEY) || '0', 10)
    if (Number.isFinite(chunksCount) && chunksCount > 0) {
      for (let index = 0; index < chunksCount; index += 1) {
        localStorage.removeItem(`${DOCUMENTOS_CHUNK_PREFIX}${index}`)
      }
    }
    localStorage.removeItem(DOCUMENTOS_CHUNK_COUNT_KEY)
  }

  function escribirDocumentosStorageRawCompat(valor) {
    limpiarChunksDocumentosCompat()
    try {
      localStorage.setItem(DOCUMENTOS_STORAGE_KEY, valor)
      return
    } catch (error) {
      localStorage.removeItem(DOCUMENTOS_STORAGE_KEY)
    }
    const totalChunks = Math.ceil(valor.length / DOCUMENTOS_CHUNK_SIZE)
    for (let index = 0; index < totalChunks; index += 1) {
      const inicio = index * DOCUMENTOS_CHUNK_SIZE
      const fin = inicio + DOCUMENTOS_CHUNK_SIZE
      localStorage.setItem(`${DOCUMENTOS_CHUNK_PREFIX}${index}`, valor.slice(inicio, fin))
    }
    localStorage.setItem(DOCUMENTOS_CHUNK_COUNT_KEY, String(totalChunks))
    localStorage.setItem(DOCUMENTOS_STORAGE_KEY, `__chunked__:${totalChunks}`)
  }

  function normalizarDocumento(doc) {
    if (!doc || typeof doc !== 'object') return null
    const id = doc.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    return {
      id,
      nombre: doc.nombre || 'Documento',
      extension: doc.extension || '',
      url: doc.url || doc.dataUrl || '',
      texto: doc.texto || '',
      mensaje: doc.mensaje || '',
      archived: Boolean(doc.archived)
    }
  }

  function importarArticulosDesdeDatos(datos) {
    if (!datos.articulos || !Array.isArray(datos.articulos)) {
      throw new Error('Archivo no válido - no contiene artículos')
    }

    const idsExistentes = new Set(window.articulos.map(a => a.id))
    let agregados = 0

    datos.articulos.forEach(articulo => {
      if (!idsExistentes.has(articulo.id)) {
        window.articulos.push(articulo)
        idsExistentes.add(articulo.id)
        agregados++
      }
    })

    if (datos.materiasOrden && typeof datos.materiasOrden === 'object') {
      Object.keys(datos.materiasOrden).forEach(normativa => {
        if (!window.materiasOrden[normativa]) window.materiasOrden[normativa] = {}
        Object.keys(datos.materiasOrden[normativa]).forEach(materia => {
          if (typeof window.materiasOrden[normativa][materia] === 'undefined') {
            window.materiasOrden[normativa][materia] = datos.materiasOrden[normativa][materia]
          }
        })
      })
    }

    if (datos.carpetas && Array.isArray(datos.carpetas)) {
      datos.carpetas.forEach(carpetaImportada => {
        const existeIndex = window.carpetas.findIndex(c =>
          c.nombre === carpetaImportada.nombre && c.normativa === carpetaImportada.normativa
        )
        if (existeIndex === -1) {
          window.carpetas.push(carpetaImportada)
        } else {
          const existente = window.carpetas[existeIndex]
          if (carpetaImportada.materias && Array.isArray(carpetaImportada.materias)) {
            existente.materias = existente.materias || []
            carpetaImportada.materias.forEach(mat => {
              if (!existente.materias.some(m => m.normativa === mat.normativa && m.materia === mat.materia)) {
                existente.materias.push(mat)
              }
            })
          }
        }
      })
    }

    guardarJSONConRespaldo('articulosGuardados', window.articulos)
    guardarJSONConRespaldo('materiasOrden', window.materiasOrden)
    guardarJSONConRespaldo('carpetasMaterias', window.carpetas)
    return agregados
  }

  function obtenerArticulosPorMaterias(materias = []) {
    if (!Array.isArray(materias) || !Array.isArray(window.articulos)) return []
    const materiaSet = new Set(materias.map(m => `${m.normativa}::${m.materia}`))
    return window.articulos.filter(a => materiaSet.has(`${a.normativa}::${a.materia}`))
  }

  function construirDatosExportablesPorSeleccion(seleccion, opciones = {}) {
    const datos = {}

    if (seleccion.articulos) {
      datos.articulos = { articulos: window.articulos || [] }
    }

    if (seleccion.carpetas) {
      const carpetas = Array.isArray(window.carpetas) ? window.carpetas : []
      const incluirContenido = opciones.incluirContenidoCarpeta !== false
      const articulosCarpetas = incluirContenido ? carpetas.flatMap(carpeta => obtenerArticulosPorMaterias(carpeta.materias || [])) : []
      const idsDocumentosCarpeta = new Set(carpetas.flatMap(carpeta => Array.isArray(carpeta.documentos) ? carpeta.documentos : []))
      const documentos = incluirContenido ? (window.documentosCargados || []).filter(doc => idsDocumentosCarpeta.has(doc.id)) : []
      datos.carpetas = {
        carpetas,
        articulosRelacionados: articulosCarpetas,
        documentos,
        documentosEnCarpetas: incluirContenido ? carpetas
          .filter(carpeta => Array.isArray(carpeta.documentos) && carpeta.documentos.length)
          .map(carpeta => ({ carpetaId: carpeta.id, documentos: carpeta.documentos })) : [],
        materiasOrden: window.materiasOrden || {}
      }
    }

    if (seleccion.documentos) {
      const idsEnCarpetas = new Set(
        (window.carpetas || []).flatMap(carpeta => Array.isArray(carpeta.documentos) ? carpeta.documentos : [])
      )
      datos.documentos = {
        documentos: (window.documentosCargados || []).filter(doc => opciones.incluirDocumentosEnCarpetas ? true : !idsEnCarpetas.has(doc.id)),
        documentosSidebarIds: Array.isArray(window.documentosSidebarIds) ? window.documentosSidebarIds : []
      }
    }

    if (seleccion.horario) {
      datos.horario = {}
      HORARIO_KEYS.forEach(key => {
        const value = localStorage.getItem(key)
        if (value !== null) datos.horario[key] = value
      })
    }

    if (seleccion.malla) {
      datos.malla = {}
      MALLA_KEYS.forEach(key => {
        const value = localStorage.getItem(key)
        if (value !== null) datos.malla[key] = value
      })
    }

    if (seleccion.calendario) {
      datos.calendario = {}
      CALENDARIO_KEYS.forEach(key => {
        const value = localStorage.getItem(key)
        if (value !== null) datos.calendario[key] = value
      })
    }

    if (seleccion.ramos) {
      datos.ramos = {}
      RAMOS_KEYS.forEach(key => {
        const value = localStorage.getItem(key)
        if (value !== null) datos.ramos[key] = value
      })
    }

    if (seleccion.estilo) {
      datos.estilo = {}
      ESTILO_KEYS.forEach(key => {
        const value = localStorage.getItem(key)
        if (value !== null) datos.estilo[key] = value
      })
    }

    return datos
  }

  function mergearDocumentosImportados(importados = [], documentosEnCarpetas = []) {
    const actuales = Array.isArray(window.documentosCargados) ? window.documentosCargados : []
    const idsActuales = new Set(actuales.map(doc => doc.id))
    const normalizados = importados.map(normalizarDocumento).filter(Boolean)
    const nuevos = normalizados.filter(doc => !idsActuales.has(doc.id))
    window.documentosCargados = [...actuales, ...nuevos]
    escribirDocumentosStorageRawCompat(JSON.stringify(window.documentosCargados))
    window.persistentState?.set?.(DOCUMENTOS_STORAGE_KEY, window.documentosCargados)

    const idsEnCarpetas = new Set()
    if (Array.isArray(documentosEnCarpetas) && Array.isArray(window.carpetas)) {
      const docsPorId = new Map(window.documentosCargados.map(doc => [doc.id, doc]))
      window.carpetas = window.carpetas.map(carpeta => {
        const regla = documentosEnCarpetas.find(c => c.carpetaId === carpeta.id)
        if (!regla || !Array.isArray(regla.documentos)) return carpeta
        const existentes = Array.isArray(carpeta.documentos) ? carpeta.documentos : []
        const merged = Array.from(new Set([...existentes, ...regla.documentos]))
        regla.documentos.forEach(id => idsEnCarpetas.add(id))
        const documentosData = { ...(carpeta.documentosData || {}) }
        regla.documentos.forEach(id => {
          const base = docsPorId.get(id)
          if (!base) return
          documentosData[id] = {
            id: base.id,
            nombre: base.nombre || 'Documento',
            extension: base.extension || '',
            url: base.url || '',
            texto: base.texto || '',
            mensaje: base.mensaje || ''
          }
        })
        return { ...carpeta, documentos: merged, documentosData }
      })
      guardarJSONConRespaldo('carpetasMaterias', window.carpetas)
    }

    return { nuevos, idsEnCarpetas }
  }

  function descargarJson(nombreBase, backup, mensajeExito) {
    const jsonStr = JSON.stringify(backup, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json; charset=utf-8' })
    const ahora = new Date()
    const fecha = ahora.toISOString().split('T')[0]
    const hora = ahora.toTimeString().split(' ')[0].replace(/:/g, '-')
    const nombre = `${nombreBase}-${fecha}-${hora}.json`
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = nombre
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    mostrarNotificacion(mensajeExito, 'success')
  }

  function exportarSeccion(seccion, opciones = {}) {
    const backup = {
      version: '3.0',
      tipo: 'backup-seccion',
      seccion,
      timestamp: new Date().toISOString(),
      datos: construirDatosExportablesPorSeleccion({ [seccion]: true }, opciones)
    }
    const total = Object.values(backup.datos[seccion] || {}).length
    descargarJson(`backup-${seccion}`, backup, `✓ ${seccion} exportado (${total} bloques)`)
  }

  function aplicarImportacionPorSeccion(seccion, datos, opciones = {}) {
    if (seccion === 'carpetas' && datos.carpetas) {
      const agregados = importarArticulosDesdeDatos({
        articulos: opciones.incluirContenidoCarpeta ? (datos.carpetas.articulosRelacionados || []) : [],
        materiasOrden: datos.carpetas.materiasOrden || {},
        carpetas: datos.carpetas.carpetas || []
      })
      if (opciones.incluirContenidoCarpeta) {
        mergearDocumentosImportados(datos.carpetas.documentos || [], datos.carpetas.documentosEnCarpetas || [])
      }
      return `carpetas (${agregados} artículos)`
    }

    if (seccion === 'documentos' && datos.documentos && Array.isArray(datos.documentos.documentos)) {
      const resultadoDocs = mergearDocumentosImportados(
        datos.documentos.documentos,
        opciones.incluirDocumentosEnCarpetas ? (datos.documentos.documentosEnCarpetas || []) : []
      )
      return `${resultadoDocs.nuevos.length} documentos`
    }

    if (seccion === 'horario' && datos.horario) {
      Object.keys(datos.horario).forEach(key => localStorage.setItem(key, datos.horario[key]))
      return 'horario'
    }

    if (seccion === 'malla' && datos.malla) {
      Object.keys(datos.malla).forEach(key => localStorage.setItem(key, datos.malla[key]))
      return 'malla'
    }

    if (seccion === 'calendario' && datos.calendario) {
      Object.keys(datos.calendario).forEach(key => localStorage.setItem(key, datos.calendario[key]))
      return 'calendario'
    }

    if (seccion === 'ramos' && datos.ramos) {
      Object.keys(datos.ramos).forEach(key => localStorage.setItem(key, datos.ramos[key]))
      if (typeof datos.ramos.materiasOrden === 'string') {
        try {
          window.materiasOrden = JSON.parse(datos.ramos.materiasOrden)
          guardarJSONConRespaldo('materiasOrden', window.materiasOrden)
        } catch (_e) {}
      }
      return 'ramos'
    }

    if (seccion === 'estilo' && datos.estilo) {
      ESTILO_KEYS.forEach(key => {
        if (typeof datos.estilo[key] === 'string') localStorage.setItem(key, datos.estilo[key])
      })
      if (typeof aplicarModoGuardado === 'function') aplicarModoGuardado()
      if (typeof aplicarColorAcentoGuardado === 'function') aplicarColorAcentoGuardado()
      if (typeof aplicarFondo === 'function') aplicarFondo(localStorage.getItem('fondoImagenApp') || '')
      return 'estilo'
    }

    return null
  }

  function importarSeccion(archivo, seccion, opciones = {}) {
    if (!archivo) return
    const lector = new FileReader()
    lector.onload = function(evento) {
      try {
        const datosArchivo = JSON.parse(evento.target.result)
        const datos = datosArchivo.datos || {}
        const resumen = aplicarImportacionPorSeccion(seccion, datos, opciones)
        if (!resumen) throw new Error(`El archivo no contiene la sección ${seccion}`)
        if (typeof ordenarYMostrar === 'function') ordenarYMostrar()
        mostrarNotificacion(`✓ Importación completada (${resumen})`, 'success')
      } catch (error) {
        console.error('[ExportArticles] Error importando sección:', error)
        mostrarNotificacion(`✗ Error: ${error.message}`, 'error')
      }
    }
    lector.readAsText(archivo)
  }

  /**
   * EXPORTAR ARTÍCULOS
   * Descarga los artículos como archivo JSON
   */
  window.exportarArticulos = function exportarArticulos() {
    try {
      console.log('[ExportArticles] Iniciando exportación...')
      console.log('[ExportArticles] window.articulos:', window.articulos)
      
      if (!window.articulos || !Array.isArray(window.articulos) || window.articulos.length === 0) {
        console.warn('[ExportArticles] No hay artículos para exportar')
        mostrarNotificacion('✗ No hay artículos para exportar', 'error')
        return
      }

      const incluirCarpetas = document.getElementById('articlesIncludeFoldersToggle')?.checked !== false
      const backup = {
        version: '3.0',
        timestamp: new Date().toISOString(),
        cantidad: window.articulos.length,
        articulos: window.articulos,
        materiasOrden: window.materiasOrden || {},
        carpetas: incluirCarpetas ? (window.carpetas || []) : []
      }

      console.log('[ExportArticles] Exportando', backup.cantidad, 'artículos con carpetas y orden...')

      const jsonStr = JSON.stringify(backup, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json; charset=utf-8' })

      const ahora = new Date()
      const fecha = ahora.toISOString().split('T')[0]
      const hora = ahora.toTimeString().split(' ')[0].replace(/:/g, '-')
      const nombre = `articulos-${fecha}-${hora}.json`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = nombre
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log('[ExportArticles] ✓ Exportados', backup.cantidad, 'artículos')
      mostrarNotificacion(`✓ ${backup.cantidad} artículos exportados`, 'success')

    } catch (error) {
      console.error('[ExportArticles] Error:', error)
      mostrarNotificacion('✗ Error al exportar artículos', 'error')
    }
  }

  /**
   * IMPORTAR ARTÍCULOS
   * Lee JSON y agrega los artículos a la lista existente
   */
  window.importarArticulos = function importarArticulos(archivo) {
    if (!archivo) {
      return
    }

    const lector = new FileReader()

    lector.onload = function(evento) {
      try {
        const datos = JSON.parse(evento.target.result)
        if (document.getElementById('articlesIncludeFoldersToggle')?.checked === false) {
          datos.carpetas = []
        }
        const agregados = importarArticulosDesdeDatos(datos)
        console.log('[ExportArticles] ✓ Agregados:', agregados)

        // Redibujar la lista
        if (typeof ordenarYMostrar === 'function') {
          ordenarYMostrar()
        }

        mostrarNotificacion(`✓ ${agregados} artículos importados`, 'success')

      } catch (error) {
        console.error('[ExportArticles] Error importando:', error)
        mostrarNotificacion(`✗ Error: ${error.message}`, 'error')
      }
    }

    lector.onerror = function() {
      console.error('[ExportArticles] Error leyendo archivo')
      mostrarNotificacion('✗ Error al leer archivo', 'error')
    }

    lector.readAsText(archivo)
  }

  // Inicializar botones cuando el DOM esté listo
  function inicializarBotones() {
    console.log('[ExportArticles] Buscando elementos...', {
      btnExportar: !!document.getElementById('exportArticlesBtn'),
      btnImportar: !!document.getElementById('importArticlesBtn'),
      inputArchivo: !!document.getElementById('inputImportArticles')
    })

    const btnExportar = document.getElementById('exportArticlesBtn')
    const btnImportar = document.getElementById('importArticlesBtn')
    const inputArchivo = document.getElementById('inputImportArticles')
    const btnExportarCarpetas = document.getElementById('exportFoldersBtn')
    const btnImportarCarpetas = document.getElementById('importFoldersBtn')
    const inputCarpetas = document.getElementById('inputImportFolders')
    const btnExportarDocumentos = document.getElementById('exportDocsBtn')
    const btnImportarDocumentos = document.getElementById('importDocsBtn')
    const inputDocumentos = document.getElementById('inputImportDocs')
    const btnExportarHorario = document.getElementById('exportScheduleBtn')
    const btnImportarHorario = document.getElementById('importScheduleBtn')
    const inputHorario = document.getElementById('inputImportSchedule')
    const btnExportarMalla = document.getElementById('exportMallaBtn')
    const btnImportarMalla = document.getElementById('importMallaBtn')
    const inputMalla = document.getElementById('inputImportMalla')
    const btnExportarCalendario = document.getElementById('exportCalendarBtn')
    const btnImportarCalendario = document.getElementById('importCalendarBtn')
    const inputCalendario = document.getElementById('inputImportCalendar')
    const btnExportarRamos = document.getElementById('exportRamosBtn')
    const btnImportarRamos = document.getElementById('importRamosBtn')
    const inputRamos = document.getElementById('inputImportRamos')
    const btnExportarEstilo = document.getElementById('exportStyleBtn')
    const btnImportarEstilo = document.getElementById('importStyleBtn')
    const inputEstilo = document.getElementById('inputImportStyle')

    if (btnExportar) {
      btnExportar.addEventListener('click', exportarArticulos)
      console.log('[ExportArticles] ✓ Botón exportar inicializado')
    }

    if (btnImportar && inputArchivo) {
      btnImportar.addEventListener('click', () => {
        console.log('[ExportArticles] Click en importar, abriendo selector...')
        inputArchivo.click()
      })
      console.log('[ExportArticles] ✓ Botón importar inicializado')
    }

    if (inputArchivo) {
      inputArchivo.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          console.log('[ExportArticles] Archivo seleccionado:', e.target.files[0].name)
          importarArticulos(e.target.files[0])
          e.target.value = '' // Limpiar para poder cargar el mismo archivo de nuevo
        }
      })
    }

    btnExportarCarpetas?.addEventListener('click', () => {
      exportarSeccion('carpetas', {
        incluirContenidoCarpeta: document.getElementById('foldersIncludeContentToggle')?.checked !== false
      })
    })
    btnImportarCarpetas?.addEventListener('click', () => inputCarpetas?.click())
    inputCarpetas?.addEventListener('change', e => {
      if (!e.target.files[0]) return
      importarSeccion(e.target.files[0], 'carpetas', {
        incluirContenidoCarpeta: document.getElementById('foldersIncludeContentToggle')?.checked !== false
      })
      e.target.value = ''
    })

    btnExportarDocumentos?.addEventListener('click', () => {
      exportarSeccion('documentos', {
        incluirDocumentosEnCarpetas: document.getElementById('docsIncludeFoldersToggle')?.checked === true
      })
    })
    btnImportarDocumentos?.addEventListener('click', () => inputDocumentos?.click())
    inputDocumentos?.addEventListener('change', e => {
      if (!e.target.files[0]) return
      importarSeccion(e.target.files[0], 'documentos', {
        incluirDocumentosEnCarpetas: document.getElementById('docsIncludeFoldersToggle')?.checked === true
      })
      e.target.value = ''
    })

    btnExportarHorario?.addEventListener('click', () => exportarSeccion('horario'))
    btnImportarHorario?.addEventListener('click', () => inputHorario?.click())
    inputHorario?.addEventListener('change', e => {
      if (!e.target.files[0]) return
      importarSeccion(e.target.files[0], 'horario')
      e.target.value = ''
    })

    btnExportarMalla?.addEventListener('click', () => exportarSeccion('malla'))
    btnImportarMalla?.addEventListener('click', () => inputMalla?.click())
    inputMalla?.addEventListener('change', e => {
      if (!e.target.files[0]) return
      importarSeccion(e.target.files[0], 'malla')
      e.target.value = ''
    })

    btnExportarCalendario?.addEventListener('click', () => exportarSeccion('calendario'))
    btnImportarCalendario?.addEventListener('click', () => inputCalendario?.click())
    inputCalendario?.addEventListener('change', e => {
      if (!e.target.files[0]) return
      importarSeccion(e.target.files[0], 'calendario')
      e.target.value = ''
    })

    btnExportarRamos?.addEventListener('click', () => exportarSeccion('ramos'))
    btnImportarRamos?.addEventListener('click', () => inputRamos?.click())
    inputRamos?.addEventListener('change', e => {
      if (!e.target.files[0]) return
      importarSeccion(e.target.files[0], 'ramos')
      e.target.value = ''
    })

    btnExportarEstilo?.addEventListener('click', () => exportarSeccion('estilo'))
    btnImportarEstilo?.addEventListener('click', () => inputEstilo?.click())
    inputEstilo?.addEventListener('change', e => {
      if (!e.target.files[0]) return
      importarSeccion(e.target.files[0], 'estilo')
      e.target.value = ''
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarBotones)
  } else {
    inicializarBotones()
  }

  console.log('[ExportArticles] Sistema de exportar/importar artículos cargado')

})()
