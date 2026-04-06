/**
 * SISTEMA DE EXPORTAR/IMPORTAR ARTÍCULOS
 * 
 * - Exportar: descarga JSON con todos los artículos
 * - Importar: carga artículos desde JSON y los agrega
 */

(function() {
  'use strict'
  const HORARIO_KEYS = ['horarioClases', 'horarioTitulo', 'horarioDiasActivos']
  const HORARIO_MALLA_KEYS = ['mallaImagenHorario', 'mallaImagenBaseHorario', 'mallaOverlayHorario', 'mallaActivaHorario', 'mallaSizeHorario']
  const ESTILO_KEYS = ['modoOscuroActivo', 'fondoImagenApp', 'colorAcentoApp', 'colorAcentoModoOscuro']
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

  function crearModalSeleccion(titulo, descripcion, opciones, onConfirm) {
    const backdrop = document.createElement('div')
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `

    const modal = document.createElement('div')
    modal.style.cssText = `
      width: min(460px, 100%);
      background: var(--surface, #fff);
      border-radius: 12px;
      box-shadow: 0 14px 32px rgba(0,0,0,0.25);
      padding: 18px;
      color: inherit;
    `

    const title = document.createElement('h3')
    title.textContent = titulo
    title.style.margin = '0 0 8px'
    modal.appendChild(title)

    const text = document.createElement('p')
    text.textContent = descripcion
    text.style.cssText = 'margin: 0 0 14px; opacity: 0.85; font-size: 14px;'
    modal.appendChild(text)

    const form = document.createElement('div')
    form.style.cssText = 'display: grid; gap: 10px; margin-bottom: 16px;'

    opciones.forEach(op => {
      const row = document.createElement('label')
      row.style.cssText = 'display: flex; align-items: center; gap: 8px;'
      row.innerHTML = `<input type="checkbox" data-key="${op.key}" ${op.checked ? 'checked' : ''}> <span>${op.label}</span>`
      form.appendChild(row)
    })
    modal.appendChild(form)

    const actions = document.createElement('div')
    actions.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px;'
    actions.innerHTML = `
      <button type="button" data-action="cancel" class="modo config-action">Cancelar</button>
      <button type="button" data-action="confirm" class="modo config-action">Continuar</button>
    `
    modal.appendChild(actions)

    const close = () => {
      if (backdrop.parentElement) backdrop.parentElement.removeChild(backdrop)
    }

    actions.querySelector('[data-action="cancel"]').addEventListener('click', close)
    actions.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      const seleccion = {}
      form.querySelectorAll('input[type="checkbox"]').forEach(input => {
        seleccion[input.dataset.key] = input.checked
      })
      close()
      onConfirm(seleccion)
    })

    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close()
    })

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
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

  function exportarSeleccionado() {
    const opciones = [
      { key: 'articulos', label: 'Artículos y carpetas', checked: true },
      { key: 'horario', label: 'Horario (con malla)', checked: true },
      { key: 'documentos', label: 'Documentos', checked: true },
      { key: 'estilo', label: 'Estilo (fondo y colores)', checked: true }
    ]

    crearModalSeleccion(
      'Exportar datos',
      'Elige exactamente qué quieres incluir en el archivo.',
      opciones,
      seleccion => {
        const tieneAlgo = Object.values(seleccion).some(Boolean)
        if (!tieneAlgo) {
          mostrarNotificacion('✗ Debes seleccionar al menos una sección', 'error')
          return
        }

        const backup = {
          version: '1.0',
          tipo: 'backup-selectivo',
          timestamp: new Date().toISOString(),
          datos: {}
        }

        if (seleccion.articulos) {
          backup.datos.articulos = window.articulos || []
          backup.datos.materiasOrden = window.materiasOrden || {}
          backup.datos.carpetas = window.carpetas || []
        }

        if (seleccion.horario) {
          backup.datos.horario = {}
          HORARIO_KEYS.forEach(key => {
            const value = localStorage.getItem(key)
            if (value !== null) backup.datos.horario[key] = value
          })
          HORARIO_MALLA_KEYS.forEach(key => {
            const value = localStorage.getItem(key)
            if (value !== null) backup.datos.horario[key] = value
          })
        }

        if (seleccion.documentos) {
          backup.datos.documentos = Array.isArray(window.__backupExportDocumentosState?.())
            ? window.__backupExportDocumentosState()
            : (window.documentosCargados || [])
          backup.datos.documentosSidebarIds = Array.isArray(window.documentosSidebarIds) ? window.documentosSidebarIds : []
          backup.datos.documentosEnCarpetas = (window.carpetas || [])
            .filter(carpeta => Array.isArray(carpeta.documentos) && carpeta.documentos.length)
            .map(carpeta => ({
              carpetaId: carpeta.id,
              documentos: carpeta.documentos
            }))
        }

        if (seleccion.estilo) {
          backup.datos.estilo = {}
          ESTILO_KEYS.forEach(key => {
            const value = localStorage.getItem(key)
            if (value !== null) backup.datos.estilo[key] = value
          })
        }

        const jsonStr = JSON.stringify(backup, null, 2)
        const blob = new Blob([jsonStr], { type: 'application/json; charset=utf-8' })
        const ahora = new Date()
        const fecha = ahora.toISOString().split('T')[0]
        const hora = ahora.toTimeString().split(' ')[0].replace(/:/g, '-')
        const nombre = `backup-seleccionado-${fecha}-${hora}.json`
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = nombre
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        mostrarNotificacion('✓ Exportación completada', 'success')
      }
    )
  }

  function importarSeleccionado(archivo) {
    if (!archivo) return
    const lector = new FileReader()
    lector.onload = function(evento) {
      try {
        const datosArchivo = JSON.parse(evento.target.result)
        const esArticuloLegacy = Array.isArray(datosArchivo.articulos)
        const datos = esArticuloLegacy ? { articulos: datosArchivo.articulos, materiasOrden: datosArchivo.materiasOrden, carpetas: datosArchivo.carpetas } : (datosArchivo.datos || {})
        if (!datos || typeof datos !== 'object') {
          throw new Error('Archivo no válido')
        }

        const opciones = [
          { key: 'articulos', label: 'Artículos y carpetas', checked: Boolean(datos.articulos) },
          { key: 'horario', label: 'Horario (con malla)', checked: Boolean(datos.horario) },
          { key: 'documentos', label: 'Documentos', checked: Boolean(datos.documentos) },
          { key: 'estilo', label: 'Estilo (fondo y colores)', checked: Boolean(datos.estilo) }
        ].filter(op => op.checked)

        if (!opciones.length) throw new Error('El archivo no contiene secciones compatibles')

        crearModalSeleccion(
          'Importar datos',
          'Selecciona qué secciones deseas restaurar.',
          opciones,
          seleccion => {
            let resumen = []

            if (seleccion.articulos && datos.articulos) {
              const agregados = importarArticulosDesdeDatos({
                articulos: datos.articulos,
                materiasOrden: datos.materiasOrden || {},
                carpetas: datos.carpetas || []
              })
              resumen.push(`${agregados} artículos`)
            }

            if (seleccion.horario && datos.horario) {
              Object.keys(datos.horario).forEach(key => localStorage.setItem(key, datos.horario[key]))
              resumen.push('horario')
            }

            if (seleccion.documentos && Array.isArray(datos.documentos)) {
              const actuales = Array.isArray(window.documentosCargados) ? window.documentosCargados : []
              const idsActuales = new Set(actuales.map(doc => doc.id))
              const importados = datos.documentos.map(normalizarDocumento).filter(Boolean)
              const nuevos = importados.filter(doc => !idsActuales.has(doc.id))
              window.documentosCargados = [...actuales, ...nuevos]
              escribirDocumentosStorageRawCompat(JSON.stringify(window.documentosCargados))
              window.persistentState?.set?.(DOCUMENTOS_STORAGE_KEY, window.documentosCargados)

              const idsEnCarpetas = new Set()
              if (Array.isArray(datos.documentosEnCarpetas) && Array.isArray(window.carpetas)) {
                const docsPorId = new Map(window.documentosCargados.map(doc => [doc.id, doc]))
                window.carpetas = window.carpetas.map(carpeta => {
                  const regla = datos.documentosEnCarpetas.find(c => c.carpetaId === carpeta.id)
                  if (!regla || !Array.isArray(regla.documentos)) return carpeta
                  const existentes = Array.isArray(carpeta.documentos) ? carpeta.documentos : []
                  const merged = Array.from(new Set([...existentes, ...regla.documentos]))
                  regla.documentos.forEach(id => idsEnCarpetas.add(id))
                  const documentosData = { ...(carpeta.documentosData || {}) }
                  regla.documentos.forEach(id => {
                    const base = docsPorId.get(id)
                    if (base) {
                      documentosData[id] = {
                        id: base.id,
                        nombre: base.nombre || 'Documento',
                        extension: base.extension || '',
                        url: base.url || '',
                        texto: base.texto || '',
                        mensaje: base.mensaje || ''
                      }
                    }
                  })
                  return { ...carpeta, documentos: merged, documentosData }
                })
                guardarJSONConRespaldo('carpetasMaterias', window.carpetas)
              }

              const sidebarBase = Array.isArray(window.documentosSidebarIds) ? window.documentosSidebarIds : []
              const sidebarSet = new Set(sidebarBase)
              window.documentosCargados.forEach(doc => {
                if (!idsEnCarpetas.has(doc.id)) sidebarSet.add(doc.id)
              })
              window.documentosSidebarIds = Array.from(sidebarSet)
              guardarJSONConRespaldo('documentosSidebarIds', window.documentosSidebarIds)
              resumen.push(`${nuevos.length} documentos`)
            }

            if (seleccion.estilo && datos.estilo) {
              ESTILO_KEYS.forEach(key => {
                if (typeof datos.estilo[key] === 'string') localStorage.setItem(key, datos.estilo[key])
              })
              if (typeof aplicarModoGuardado === 'function') aplicarModoGuardado()
              if (typeof aplicarColorAcentoGuardado === 'function') aplicarColorAcentoGuardado()
              if (typeof aplicarFondo === 'function') aplicarFondo(localStorage.getItem('fondoImagenApp') || '')
              resumen.push('estilo')
            }

            if (typeof ordenarYMostrar === 'function') ordenarYMostrar()
            mostrarNotificacion(`✓ Importación completada (${resumen.join(', ')})`, 'success')
          }
        )
      } catch (error) {
        console.error('[ExportArticles] Error importando seleccionado:', error)
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

      const backup = {
        version: '3.0',
        timestamp: new Date().toISOString(),
        cantidad: window.articulos.length,
        articulos: window.articulos,
        materiasOrden: window.materiasOrden || {},
        carpetas: window.carpetas || []
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
    const btnExportarSelectivo = document.getElementById('exportSelectedDataBtn')
    const btnImportarSelectivo = document.getElementById('importSelectedDataBtn')
    const inputImportarSelectivo = document.getElementById('inputImportSelectedData')

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

    if (btnExportarSelectivo) {
      btnExportarSelectivo.addEventListener('click', exportarSeleccionado)
    }

    if (btnImportarSelectivo && inputImportarSelectivo) {
      btnImportarSelectivo.addEventListener('click', () => inputImportarSelectivo.click())
      inputImportarSelectivo.addEventListener('change', e => {
        if (e.target.files[0]) {
          importarSeleccionado(e.target.files[0])
          e.target.value = ''
        }
      })
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarBotones)
  } else {
    inicializarBotones()
  }

  console.log('[ExportArticles] Sistema de exportar/importar artículos cargado')

})()
