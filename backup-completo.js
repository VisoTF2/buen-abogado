/**
 * SISTEMA DE RESPALDO COMPLETO
 * 
 * - Exportar: descarga JSON con TODO (artículos, carpetas, horario, documentos, personalizaciones, etc)
 * - Importar: carga respaldo completo y restaura la aplicación
 */

(function() {
  'use strict'

  // Keys que se guardan en localStorage
  const STORAGE_KEYS_ARTICULOS = [
    'articulosGuardados',
    'materiasOrden',
    'carpetasMaterias',
    'documentosSidebarIds'
  ]

  const STORAGE_KEYS_HORARIO = [
    'horarioClases',
    'horarioTitulo',
    'horarioDiasActivos'
  ]

  const STORAGE_KEYS_PERSONALIZACION = [
    'modoOscuroActivo',
    'colorAcentoApp',
    'colorAcentoModoOscuro',
    'fondoImagenApp',
    'bannerImagenApp',
    'bannerColorFondoActivo',
    'mallaImagenHorario',
    'mallaImagenBaseHorario',
    'mallaOverlayHorario',
    'mallaActivaHorario',
    'mallaSizeHorario'
  ]

  const DOCUMENTOS_STORAGE_KEY = 'documentosSubidos'
  const DOCUMENTOS_CHUNK_PREFIX = `${DOCUMENTOS_STORAGE_KEY}__chunk__`
  const DOCUMENTOS_CHUNK_COUNT_KEY = `${DOCUMENTOS_STORAGE_KEY}__chunks_count`

  /**
   * EXPORTAR RESPALDO COMPLETO
   */
  window.exportarRespalsoCompleto = function exportarRespalsoCompleto() {
    try {
      console.log('[BackupCompleto] Iniciando exportación de respaldo completo...')

      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        tipo: 'respaldo-completo',
        datos: {}
      }

      // Recopilar artículos
      console.log('[BackupCompleto] Recopilando artículos...')
      STORAGE_KEYS_ARTICULOS.forEach(key => {
        const valor = localStorage.getItem(key)
        if (valor) {
          try {
            backup.datos[key] = JSON.parse(valor)
          } catch (e) {
            console.warn(`[BackupCompleto] No se pudo parsear ${key}`)
          }
        }
      })

      // Recopilar horario
      console.log('[BackupCompleto] Recopilando horario...')
      STORAGE_KEYS_HORARIO.forEach(key => {
        const valor = localStorage.getItem(key)
        if (valor) {
          try {
            backup.datos[key] = JSON.parse(valor)
          } catch (e) {
            console.warn(`[BackupCompleto] No se pudo parsear ${key}`)
          }
        }
      })

      // Recopilar personalizaciones
      console.log('[BackupCompleto] Recopilando personalizaciones...')
      STORAGE_KEYS_PERSONALIZACION.forEach(key => {
        const valor = localStorage.getItem(key)
        if (valor) {
          backup.datos[key] = valor
        }
      })

      // Recopilar documentos (incluyendo chunks si existen)
      console.log('[BackupCompleto] Recopilando documentos...')
      const chunksCount = parseInt(localStorage.getItem(DOCUMENTOS_CHUNK_COUNT_KEY) || '0', 10)
      
      if (chunksCount > 0) {
        console.log(`[BackupCompleto] Encontrados ${chunksCount} chunks de documentos`)
        const chunks = []
        for (let i = 0; i < chunksCount; i++) {
          const chunk = localStorage.getItem(`${DOCUMENTOS_CHUNK_PREFIX}${i}`)
          if (chunk) {
            chunks.push(chunk)
          }
        }
        backup.datos.documentosChunks = chunks
        backup.datos.documentosChunkCount = chunksCount

        const porcentaje = ((chunks.length / chunksCount) * 100).toFixed(1)
        console.log(`[BackupCompleto] Documentos capturados: ${porcentaje}%`)
      }

      // Capturar metadata principal de documentos
      const docsRaw = localStorage.getItem(DOCUMENTOS_STORAGE_KEY)
      if (docsRaw) {
        backup.datos[DOCUMENTOS_STORAGE_KEY] = docsRaw
      }

      // Información de resumen
      const resumen = {
        articulosCount: window.articulos?.length || 0,
        carpetasCount: window.carpetas?.length || 0,
        documentosCount: window.documentosCargados?.length || 0,
        tieneHorario: !!backup.datos.horarioClases,
        tienePersonalizaciones: Object.keys(backup.datos).some(k => 
          STORAGE_KEYS_PERSONALIZACION.includes(k)
        )
      }
      backup.resumen = resumen

      console.log('[BackupCompleto] Resumen:', resumen)

      // Crear y descargar
      const jsonStr = JSON.stringify(backup, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json; charset=utf-8' })

      const ahora = new Date()
      const fecha = ahora.toISOString().split('T')[0]
      const hora = ahora.toTimeString().split(' ')[0].replace(/:/g, '-')
      const nombre = `respaldo-completo-buen-abogado-${fecha}-${hora}.json`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = nombre
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log('[BackupCompleto] ✓ Respaldo exportado exitosamente')
      mostrarNotificacion('✓ Respaldo completo exportado', 'success')

    } catch (error) {
      console.error('[BackupCompleto] Error:', error)
      mostrarNotificacion('✗ Error al exportar respaldo', 'error')
    }
  }

  /**
   * IMPORTAR RESPALDO COMPLETO
   */
  window.importarRespalsoCompleto = function importarRespalsoCompleto(archivo) {
    if (!archivo) {
      return
    }

    const lector = new FileReader()

    lector.onload = function(evento) {
      try {
        const contenido = evento.target.result
        const backup = JSON.parse(contenido)

        // Validar estructura
        if (!backup.datos || typeof backup.datos !== 'object') {
          throw new Error('Archivo no válido - no contiene datos de respaldo')
        }

        if (backup.tipo !== 'respaldo-completo') {
          throw new Error('Archivo no válido - no es un respaldo completo')
        }

        console.log('[BackupCompleto] Respaldo válido encontrado:', backup.resumen)

        // Mostrar diálogo de confirmación
        mostrarDialogoImportacion(backup)

      } catch (error) {
        console.error('[BackupCompleto] Error importando:', error)
        mostrarNotificacion(`✗ Error: ${error.message}`, 'error')
      }
    }

    lector.onerror = function() {
      console.error('[BackupCompleto] Error leyendo archivo')
      mostrarNotificacion('✗ Error al leer archivo', 'error')
    }

    lector.readAsText(archivo)
  }

  /**
   * RESTAURAR APP COMPLETAMENTE (borrar todo)
   */
  window.restaurarAppCompletamente = function restaurarAppCompletamente() {
    try {
      console.log('[BackupCompleto] Iniciando restauración completa de la aplicación...')
      
      // Obtener todos los keys actuales
      const allKeys = Object.keys(localStorage)
      
      // Limpiar TODO lo que no sea respaldo
      allKeys.forEach(key => {
        if (!key.endsWith('__backup')) {
          localStorage.removeItem(key)
        }
      })

      // Limpiar chunks de documentos explícitamente
      const chunksCount = parseInt(localStorage.getItem(DOCUMENTOS_CHUNK_COUNT_KEY) || '0', 10)
      for (let i = 0; i < chunksCount; i++) {
        localStorage.removeItem(`${DOCUMENTOS_CHUNK_PREFIX}${i}`)
      }
      localStorage.removeItem(DOCUMENTOS_CHUNK_COUNT_KEY)

      console.log('[BackupCompleto] ✓ Aplicación completamente limpiada')
      mostrarNotificacion('✓ Aplicación restaurada. Recargando...', 'success')
      
      setTimeout(() => {
        location.reload()
      }, 1500)

    } catch (error) {
      console.error('[BackupCompleto] Error en restauración completa:', error)
      mostrarNotificacion(`✗ Error al restaurar: ${error.message}`, 'error')
    }
  }

  /**
   * IMPORTAR RESPALDO COMPLETO (Sin diálogo - directo)
   */
  window.importarRespalsoCompletoDirecto = function importarRespalsoCompletoDirecto(archivo) {
    if (!archivo) {
      return
    }

    const lector = new FileReader()

    lector.onload = function(evento) {
      try {
        const contenido = evento.target.result
        const backup = JSON.parse(contenido)

        // Validar estructura
        if (!backup.datos || typeof backup.datos !== 'object') {
          throw new Error('Archivo no válido - no contiene datos de respaldo')
        }

        if (backup.tipo !== 'respaldo-completo') {
          throw new Error('Archivo no válido - no es un respaldo completo')
        }

        console.log('[BackupCompleto] Restaurando directamente en modo reemplazar...')
        
        // Importar directamente en modo reemplazar sin diálogo
        ejecutarImportacion(backup, 'reemplazar')

      } catch (error) {
        console.error('[BackupCompleto] Error importando:', error)
        mostrarNotificacion(`✗ Error: ${error.message}`, 'error')
      }
    }

    lector.onerror = function() {
      console.error('[BackupCompleto] Error leyendo archivo')
      mostrarNotificacion('✗ Error al leer archivo', 'error')
    }

    lector.readAsText(archivo)
  }

  /**
   * Mostrar diálogo de importación con opciones
   */
  function mostrarDialogoImportacion(backup) {
    // Crear overlay
    const overlay = document.createElement('div')
    overlay.className = 'modal-backdrop'
    overlay.id = 'backupImportDialog'
    overlay.style.display = 'flex'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.zIndex = '10000'

    const card = document.createElement('div')
    card.className = 'modal-card'
    card.style.maxWidth = '450px'

    // Encabezado
    const head = document.createElement('div')
    head.className = 'modal-head'
    const title = document.createElement('h3')
    title.textContent = 'Restaurar respaldo completo'
    head.appendChild(title)
    const closeBtn = document.createElement('button')
    closeBtn.className = 'modal-close'
    closeBtn.type = 'button'
    closeBtn.innerHTML = '×'
    closeBtn.onclick = () => cerrarDialogoImportacion(overlay)
    head.appendChild(closeBtn)
    card.appendChild(head)

    // Cuerpo
    const body = document.createElement('div')
    body.className = 'modal-body'
    body.style.fontSize = '14px'
    body.style.lineHeight = '1.6'

    // Resumen del respaldo
    const resumenEl = document.createElement('div')
    resumenEl.style.backgroundColor = '#f5f5f5'
    resumenEl.style.padding = '12px'
    resumenEl.style.borderRadius = '6px'
    resumenEl.style.marginBottom = '16px'
    resumenEl.innerHTML = `
      <strong>Contenido del respaldo:</strong><br>
      • Artículos: ${backup.resumen.articulosCount || 0}<br>
      • Carpetas: ${backup.resumen.carpetasCount || 0}<br>
      • Documentos: ${backup.resumen.documentosCount || 0}<br>
      • Horario: ${backup.resumen.tieneHorario ? 'Sí' : 'No'}<br>
      • Personalizaciones: ${backup.resumen.tienePersonalizaciones ? 'Sí' : 'No'}<br>
      <br>
      <small style="color: #666;">Fecha: ${new Date(backup.timestamp).toLocaleString('es-ES')}</small>
    `
    body.appendChild(resumenEl)

    // Opciones de importación
    const opcionesEl = document.createElement('div')
    opcionesEl.innerHTML = `
      <strong style="display: block; margin-bottom: 10px;">¿Cómo deseas restaurar?</strong>
      <label style="display: block; margin: 8px 0; cursor: pointer;">
        <input type="radio" name="importMode" value="reemplazar" checked>
        <strong>Reemplazar todo</strong> - Borra todos tus datos actuales y restaura este respaldo
      </label>
      <label style="display: block; margin: 8px 0; cursor: pointer;">
        <input type="radio" name="importMode" value="merge">
        <strong>Merge (Combinar)</strong> - Agrega los datos del respaldo a los existentes
      </label>
    `
    body.appendChild(opcionesEl)

    // Advertencia
    const advertencia = document.createElement('div')
    advertencia.style.backgroundColor = '#fff3cd'
    advertencia.style.border = '1px solid #ffc107'
    advertencia.style.color = '#856404'
    advertencia.style.padding = '10px'
    advertencia.style.borderRadius = '4px'
    advertencia.style.marginTop = '16px'
    advertencia.style.fontSize = '12px'
    advertencia.innerHTML = `
      <strong>⚠️ Advertencia:</strong> Esta acción no se puede deshacer. 
      Si eliges "Reemplazar todo", todo lo actual se perderá.
    `
    body.appendChild(advertencia)

    card.appendChild(body)

    // Botones
    const footer = document.createElement('div')
    footer.style.display = 'flex'
    footer.style.gap = '10px'
    footer.style.justifyContent = 'flex-end'
    footer.style.padding = '16px 0'
    footer.style.borderTop = '1px solid #e0e0e0'

    const btnCancelar = document.createElement('button')
    btnCancelar.className = 'modo'
    btnCancelar.type = 'button'
    btnCancelar.textContent = 'Cancelar'
    btnCancelar.onclick = () => cerrarDialogoImportacion(overlay)

    const btnRestaurar = document.createElement('button')
    btnRestaurar.className = 'modo'
    btnRestaurar.style.backgroundColor = '#4caf50'
    btnRestaurar.type = 'button'
    btnRestaurar.textContent = 'Restaurar'
    btnRestaurar.onclick = () => {
      const modo = document.querySelector('input[name="importMode"]:checked').value
      cerrarDialogoImportacion(overlay)
      ejecutarImportacion(backup, modo)
    }

    footer.appendChild(btnCancelar)
    footer.appendChild(btnRestaurar)
    body.appendChild(footer)

    overlay.appendChild(card)
    document.body.appendChild(overlay)
  }

  function cerrarDialogoImportacion(overlay) {
    if (overlay && overlay.parentElement) {
      overlay.parentElement.removeChild(overlay)
    }
  }

  /**
   * Ejecutar la importación
   */
  function ejecutarImportacion(backup, modo) {
    try {
      console.log(`[BackupCompleto] Importando en modo: ${modo}`)

      if (modo === 'reemplazar') {
        // Limpiar datos existentes (excepto respaldos)
        const allKeys = Object.keys(localStorage)
        allKeys.forEach(key => {
          // No eliminar respaldos (_backup)
          if (!key.endsWith('__backup') && !key.endsWith('__chunk__') && !key.endsWith('__chunks_count')) {
            // Eliminar chunks de documentos específicamente
            const isDocChunk = key.startsWith('documentosSubidos__chunk__')
            const isDocCountKey = key === 'documentosSubidos__chunks_count'
            if (!(isDocChunk || isDocCountKey)) {
              localStorage.removeItem(key)
            }
          }
        })
        
        // Limpiar chunks de documentos
        const chunksCount = parseInt(localStorage.getItem(DOCUMENTOS_CHUNK_COUNT_KEY) || '0', 10)
        for (let i = 0; i < chunksCount; i++) {
          localStorage.removeItem(`${DOCUMENTOS_CHUNK_PREFIX}${i}`)
        }
        localStorage.removeItem(DOCUMENTOS_CHUNK_COUNT_KEY)

        console.log('[BackupCompleto] Datos existentes limpiados')
      }

      // Restaurar datos de artículos
      console.log('[BackupCompleto] Restaurando artículos...')
      STORAGE_KEYS_ARTICULOS.forEach(key => {
        if (backup.datos[key]) {
          const valor = typeof backup.datos[key] === 'string' 
            ? backup.datos[key]
            : JSON.stringify(backup.datos[key])
          localStorage.setItem(key, valor)
        }
      })

      // Restaurar horario
      console.log('[BackupCompleto] Restaurando horario...')
      STORAGE_KEYS_HORARIO.forEach(key => {
        if (backup.datos[key]) {
          const valor = typeof backup.datos[key] === 'string'
            ? backup.datos[key]
            : JSON.stringify(backup.datos[key])
          localStorage.setItem(key, valor)
        }
      })

      // Restaurar personalizaciones
      console.log('[BackupCompleto] Restaurando personalizaciones...')
      STORAGE_KEYS_PERSONALIZACION.forEach(key => {
        if (backup.datos[key]) {
          localStorage.setItem(key, backup.datos[key])
        }
      })

      // Restaurar documentos
      console.log('[BackupCompleto] Restaurando documentos...')
      if (backup.datos[DOCUMENTOS_STORAGE_KEY]) {
        localStorage.setItem(DOCUMENTOS_STORAGE_KEY, backup.datos[DOCUMENTOS_STORAGE_KEY])
      }

      // Restaurar chunks de documentos
      if (backup.datos.documentosChunks && Array.isArray(backup.datos.documentosChunks)) {
        console.log(`[BackupCompleto] Restaurando ${backup.datos.documentosChunks.length} chunks...`)
        backup.datos.documentosChunks.forEach((chunk, index) => {
          localStorage.setItem(`${DOCUMENTOS_CHUNK_PREFIX}${index}`, chunk)
        })
        localStorage.setItem(DOCUMENTOS_CHUNK_COUNT_KEY, String(backup.datos.documentosChunks.length))
      }

      console.log('[BackupCompleto] ✓ Datos restaurados en localStorage')

      // Recargar la página para que se apliquen todos los cambios
      mostrarNotificacion('✓ Respaldo restaurado. Recargando aplicación...', 'success')
      setTimeout(() => {
        location.reload()
      }, 1500)

    } catch (error) {
      console.error('[BackupCompleto] Error en importación:', error)
      mostrarNotificacion(`✗ Error al restaurar: ${error.message}`, 'error')
    }
  }

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
    if (!document.querySelector('style[data-notif-anim]')) {
      const style = document.createElement('style')
      style.setAttribute('data-notif-anim', '')
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
   * Inicializar botones
   */
  function inicializarBotones() {
    console.log('[BackupCompleto] Buscando elementos...')

    const btnExportar = document.getElementById('exportRespalsoCompletoBtn')
    const btnImportar = document.getElementById('importRespalsoCompletoBtn')
    const inputArchivo = document.getElementById('inputImportRespalsoCompleto')
    const btnRestaurarApp = document.getElementById('restaurarAppBtn')

    if (btnExportar) {
      btnExportar.addEventListener('click', exportarRespalsoCompleto)
      console.log('[BackupCompleto] ✓ Botón crear respaldo inicializado')
    }

    if (btnImportar && inputArchivo) {
      btnImportar.addEventListener('click', () => {
        console.log('[BackupCompleto] Click en cargar respaldo, abriendo selector...')
        inputArchivo.click()
      })
      console.log('[BackupCompleto] ✓ Botón cargar respaldo inicializado')
    }

    if (inputArchivo) {
      inputArchivo.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          console.log('[BackupCompleto] Archivo seleccionado:', e.target.files[0].name)
          importarRespalsoCompletoDirecto(e.target.files[0])
          e.target.value = ''
        }
      })
      console.log('[BackupCompleto] ✓ Input archivo carga respaldo inicializado')
    }

    if (btnRestaurarApp) {
      btnRestaurarApp.addEventListener('click', () => {
        const confirmar = confirm('⚠️ Esto borrará TODOS los datos y restaurará la app. ¿Estás seguro?')
        if (confirmar) {
          restaurarAppCompletamente()
        }
      })
      console.log('[BackupCompleto] ✓ Botón restaurar app inicializado')
    }
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarBotones)
  } else {
    inicializarBotones()
  }

})()
