/**
 * SISTEMA DE EXPORTAR/IMPORTAR ARTÍCULOS
 * 
 * - Exportar: descarga JSON con todos los artículos
 * - Importar: carga artículos desde JSON y los agrega
 */

(function() {
  'use strict'

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
        return
      }

      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        cantidad: window.articulos.length,
        articulos: window.articulos
      }

      console.log('[ExportArticles] Exportando', backup.cantidad, 'artículos...')

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

    } catch (error) {
      console.error('[ExportArticles] Error:', error)
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

        console.log('[ExportArticles] ✓ Agregados:', agregados, 'Duplicados:', duplicados)

        // Guardar a localStorage e IndexedDB
        guardarJSONConRespaldo('articulosGuardados', window.articulos)

        // Redibujar la lista
        if (typeof ordenarYMostrar === 'function') {
          ordenarYMostrar()
        }

      } catch (error) {
        console.error('[ExportArticles] Error importando:', error)
      }
    }

    lector.onerror = function() {
      console.error('[ExportArticles] Error leyendo archivo')
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
