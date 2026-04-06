/**
 * SISTEMA DE EXPORTAR/IMPORTAR ARTÍCULOS
 * 
 * - Exportar: descarga JSON con todos los artículos
 * - Importar: carga artículos desde JSON y los agrega
 */

(function() {
  'use strict'
  const EXPORT_FOLDERS_TOGGLE_KEY = 'exportarArticulosConCarpetas'

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

      const exportWithFoldersToggle = document.getElementById('exportWithFoldersToggle')
      const incluirCarpetas = exportWithFoldersToggle ? exportWithFoldersToggle.checked : true
      const backup = {
        version: '3.0',
        timestamp: new Date().toISOString(),
        cantidad: window.articulos.length,
        articulos: window.articulos,
        materiasOrden: window.materiasOrden || {}
      }

      if (incluirCarpetas) {
        backup.carpetas = window.carpetas || []
      }

      console.log('[ExportArticles] Exportando', backup.cantidad, 'artículos', incluirCarpetas ? 'con carpetas y orden...' : 'sin carpetas...')

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
        const contenido = evento.target.result
        const datos = JSON.parse(contenido)

        // Validar estructura
        if (!datos.articulos || !Array.isArray(datos.articulos)) {
          throw new Error('Archivo no válido - no contiene artículos')
        }

        console.log('[ExportArticles] Importando', datos.articulos.length, 'artículos...')

        // Obtener IDs existentes para evitar duplicados
        const idsExistentes = new Set(window.articulos.map(a => a.id))
        let agregados = 0
        let duplicados = 0

        // Agregar artículos nuevos
        datos.articulos.forEach(articulo => {
          if (idsExistentes.has(articulo.id)) {
            duplicados++
          } else {
            window.articulos.push(articulo)
            idsExistentes.add(articulo.id)
            agregados++
          }
        })

        // IMPORTANTE: Mergear el orden (materiasOrden)
        if (datos.materiasOrden && typeof datos.materiasOrden === 'object') {
          Object.keys(datos.materiasOrden).forEach(normativa => {
            if (!window.materiasOrden[normativa]) {
              window.materiasOrden[normativa] = {}
            }
            
            // Mergear los órdenes de cada normativa
            Object.keys(datos.materiasOrden[normativa]).forEach(materia => {
              // Solo agregar si no existe la materia
              if (typeof window.materiasOrden[normativa][materia] === 'undefined') {
                window.materiasOrden[normativa][materia] = datos.materiasOrden[normativa][materia]
              }
            })
          })
          console.log('[ExportArticles] ✓ Órdenes mergeados')
        }

        // IMPORTANTE: Mergear carpetas
        if (datos.carpetas && Array.isArray(datos.carpetas)) {
          datos.carpetas.forEach(carpetaImportada => {
            // Buscar si ya existe carpeta con el mismo nombre/normativa
            const existeIndex = window.carpetas.findIndex(c => 
              c.nombre === carpetaImportada.nombre && c.normativa === carpetaImportada.normativa
            )
            
            if (existeIndex === -1) {
              // No existe, agregar nueva
              window.carpetas.push(carpetaImportada)
            } else {
              // Existe, mergear materias
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
          console.log('[ExportArticles] ✓ Carpetas mergeadas')
        }

        console.log('[ExportArticles] ✓ Agregados:', agregados, 'Duplicados:', duplicados)

        // Guardar todo
        guardarJSONConRespaldo('articulosGuardados', window.articulos)
        guardarJSONConRespaldo('materiasOrden', window.materiasOrden)
        guardarJSONConRespaldo('carpetasMaterias', window.carpetas)

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
    const exportWithFoldersToggle = document.getElementById('exportWithFoldersToggle')

    if (exportWithFoldersToggle) {
      const preferenciaGuardada = localStorage.getItem(EXPORT_FOLDERS_TOGGLE_KEY)
      if (preferenciaGuardada === 'false') {
        exportWithFoldersToggle.checked = false
      }

      exportWithFoldersToggle.addEventListener('change', () => {
        localStorage.setItem(EXPORT_FOLDERS_TOGGLE_KEY, exportWithFoldersToggle.checked ? 'true' : 'false')
      })
    }

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarBotones)
  } else {
    inicializarBotones()
  }

  console.log('[ExportArticles] Sistema de exportar/importar artículos cargado')

})()