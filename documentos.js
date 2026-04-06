const DOCUMENTOS_STORAGE_KEY = "documentosSubidos"
const DOCUMENTOS_CHUNK_PREFIX = `${DOCUMENTOS_STORAGE_KEY}__chunk__`
const DOCUMENTOS_CHUNK_COUNT_KEY = `${DOCUMENTOS_STORAGE_KEY}__chunks_count`
const CHUNKED_MARKER_PREFIX = "__chunked__:"
const DOCUMENTOS_CHUNK_SIZE = 350000
const documentoInput = document.getElementById("documentoInput")
const documentoReemplazoInput = document.createElement("input")
documentoReemplazoInput.type = "file"
documentoReemplazoInput.hidden = true
documentoReemplazoInput.tabIndex = -1
const listaDocumentos = document.getElementById("listaDocumentos")
const visorDocumentos = document.getElementById("visorDocumentos")
const botonDocumentos = document.querySelector(".documentos-btn")

let documentoPendienteReemplazoId = null
let modalLecturaDocumentos = null

document.body.appendChild(documentoReemplazoInput)

let documentosCargados = cargarDocumentosGuardados()
let documentoArrastradoId = null

if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
}

documentoInput?.addEventListener("change", e => {
  const archivo = e.target.files?.[0]
  if (archivo) {
    procesarDocumento(archivo)
  }
  e.target.value = ""
})

documentoReemplazoInput.addEventListener("change", async e => {
  const archivo = e.target.files?.[0]
  const documentoId = documentoPendienteReemplazoId
  documentoPendienteReemplazoId = null
  e.target.value = ""

  if (!archivo || !documentoId) return

  await reemplazarDocumento(documentoId, archivo)
})

if (botonDocumentos) {
  ;["dragenter", "dragover"].forEach(evento => {
    botonDocumentos.addEventListener(evento, e => {
      e.preventDefault()
      e.stopPropagation()
      botonDocumentos.classList.add("arrastrando")
    })
  })

  ;["dragleave", "drop"].forEach(evento => {
    botonDocumentos.addEventListener(evento, e => {
      e.preventDefault()
      e.stopPropagation()
      botonDocumentos.classList.remove("arrastrando")
    })
  })

  botonDocumentos.addEventListener("drop", e => {
    const archivo = e.dataTransfer?.files?.[0]
    if (archivo) procesarDocumento(archivo)
  })
}

prepararRecepcionDocumentoDesdeCarpetas()

function sincronizarSidebarDocumentos() {
  if (typeof ordenarYMostrar === "function") {
    ordenarYMostrar()
  }
}

function restaurarDocumentoDesdeCarpeta(documentoId) {
  if (!documentoId) return false

  const existente = documentosCargados.find(d => d.id === documentoId)

  const respaldo =
    typeof obtenerDocumentoRespaldoEnCarpetas === "function"
      ? obtenerDocumentoRespaldoEnCarpetas(documentoId)
      : null

  if (!respaldo && !existente) return false

  const base = {
    id: respaldo?.id || existente?.id || documentoId,
    nombre: respaldo?.nombre || existente?.nombre || "Documento",
    extension: respaldo?.extension || existente?.extension || "",
    url: respaldo?.url || existente?.url || "",
    texto: respaldo?.texto || existente?.texto || "",
    mensaje: respaldo?.mensaje || existente?.mensaje || ""
  }

  const documentoFinal = existente ? { ...existente, ...base, archived: false } : { ...base, archived: false }
  documentosCargados = [
    documentoFinal,
    ...documentosCargados.filter(d => d.id !== documentoId)
  ]

  guardarDocumentos()
  renderDocumentos()
  mostrarDocumento(documentoId)
  sincronizarSidebarDocumentos()
  return true
}

function prepararRecepcionDocumentoDesdeCarpetas() {
  const zonas = [listaDocumentos, visorDocumentos].filter(Boolean)
  if (!zonas.length) return

  const obtenerDocumentoArrastrado = e =>
    e.dataTransfer?.getData("application/x-documento-id") ||
    e.dataTransfer?.getData("text/plain") ||
    documentoArrastradoId ||
    null

  zonas.forEach(zona => {
    zona.addEventListener("dragover", e => {
      if (!obtenerDocumentoArrastrado(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
    })

    zona.addEventListener("dragenter", e => {
      if (!obtenerDocumentoArrastrado(e)) return
      e.preventDefault()
      zona.classList.add("drop-activa")
    })

    zona.addEventListener("dragleave", e => {
      const related = e.relatedTarget
      if (related instanceof Node && zona.contains(related)) return
      zona.classList.remove("drop-activa")
    })

    zona.addEventListener("drop", e => {
      e.preventDefault()
      zona.classList.remove("drop-activa")
      const id = obtenerDocumentoArrastrado(e)
      if (!id) return
      restaurarDocumentoDesdeCarpeta(id)
      documentoArrastradoId = null
      sincronizarSidebarDocumentos()
    })
  })
}

function cargarDocumentosGuardados() {
  try {
    const guardados = JSON.parse(leerDocumentosStorageRaw() || "[]")
    if (!Array.isArray(guardados)) return []

    return guardados.map(doc => ({
      id: doc.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      nombre: doc.nombre || "Documento",
      extension: doc.extension || "",
      url: doc.url || doc.dataUrl || "",
      texto: doc.texto || "",
      mensaje: doc.mensaje || "",
      archived: Boolean(doc.archived)
    }))
  } catch (e) {
    console.error("No se pudieron leer los documentos guardados", e)
    return []
  }
}

function guardarDocumentos() {
  const serializado = JSON.stringify(documentosCargados)
  escribirDocumentosStorageRaw(serializado)
}

function leerDocumentosStorageRaw() {
  const raw = localStorage.getItem(DOCUMENTOS_STORAGE_KEY)
  const marcadoComoChunks = typeof raw === "string" && raw.startsWith(CHUNKED_MARKER_PREFIX)

  if (raw && !marcadoComoChunks) return raw

  const chunksCount = parseInt(localStorage.getItem(DOCUMENTOS_CHUNK_COUNT_KEY) || "0", 10)
  if (!Number.isFinite(chunksCount) || chunksCount <= 0) {
    return marcadoComoChunks ? "[]" : raw || "[]"
  }

  let combinado = ""
  for (let index = 0; index < chunksCount; index += 1) {
    const parte = localStorage.getItem(`${DOCUMENTOS_CHUNK_PREFIX}${index}`)
    if (typeof parte !== "string") return "[]"
    combinado += parte
  }

  return combinado || "[]"
}

function limpiarChunksDocumentos() {
  const chunksCount = parseInt(localStorage.getItem(DOCUMENTOS_CHUNK_COUNT_KEY) || "0", 10)
  if (Number.isFinite(chunksCount) && chunksCount > 0) {
    for (let index = 0; index < chunksCount; index += 1) {
      localStorage.removeItem(`${DOCUMENTOS_CHUNK_PREFIX}${index}`)
    }
  }

  let index = 0
  while (localStorage.getItem(`${DOCUMENTOS_CHUNK_PREFIX}${index}`) !== null) {
    localStorage.removeItem(`${DOCUMENTOS_CHUNK_PREFIX}${index}`)
    index += 1
  }

  localStorage.removeItem(DOCUMENTOS_CHUNK_COUNT_KEY)
}

function escribirDocumentosStorageRaw(valor) {
  limpiarChunksDocumentos()

  try {
    localStorage.setItem(DOCUMENTOS_STORAGE_KEY, valor)
    return
  } catch (error) {
    if (error?.name !== "QuotaExceededError" && error?.code !== 22 && error?.code !== 1014) {
      throw error
    }
  }

  localStorage.removeItem(DOCUMENTOS_STORAGE_KEY)

  const totalChunks = Math.ceil(valor.length / DOCUMENTOS_CHUNK_SIZE)
  if (totalChunks <= 0) {
    localStorage.setItem(DOCUMENTOS_STORAGE_KEY, "[]")
    return
  }

  for (let index = 0; index < totalChunks; index += 1) {
    const inicio = index * DOCUMENTOS_CHUNK_SIZE
    const fin = inicio + DOCUMENTOS_CHUNK_SIZE
    const parte = valor.slice(inicio, fin)
    localStorage.setItem(`${DOCUMENTOS_CHUNK_PREFIX}${index}`, parte)
  }

  localStorage.setItem(DOCUMENTOS_CHUNK_COUNT_KEY, String(totalChunks))
  localStorage.setItem(DOCUMENTOS_STORAGE_KEY, `${CHUNKED_MARKER_PREFIX}${totalChunks}`)
}

function estaDocumentoVinculado(id) {
  if (!id) return false
  const enSidebar = typeof documentosSidebarIds !== "undefined" && documentosSidebarIds.includes(id)
  const enCarpeta = typeof carpetaDeDocumento === "function" && Boolean(carpetaDeDocumento(id))
  return enSidebar || enCarpeta
}

function guardarTextoDocumentoEditado(id, textoEditado) {
  const doc = documentosCargados.find(d => d.id === id)
  if (!doc) return

  doc.texto = textoEditado
  guardarDocumentos()

  if (typeof actualizarDocumentoEnCarpetas === "function") {
    actualizarDocumentoEnCarpetas(doc)
  }
}

const EXTENSIONES_DOCUMENTO_OCULTABLES = new Set(["pdf", "doc", "docx", "ppt", "pptx"])

function obtenerExtension(nombre = "") {
  const partes = nombre.split(".")
  return partes.length > 1 ? partes.pop().toLowerCase() : ""
}

function obtenerNombreDocumento(nombre = "") {
  const limpio = (nombre || "").trim()
  if (!limpio) return "Documento"

  const extension = obtenerExtension(limpio)
  if (!EXTENSIONES_DOCUMENTO_OCULTABLES.has(extension)) return limpio

  const sufijo = `.${extension}`
  const nombreSinExtension = limpio.slice(0, -sufijo.length).trim()
  return nombreSinExtension || "Documento"
}

function obtenerNombreDescarga(doc) {
  if (!doc) return "Documento"

  const nombreBase = (doc.nombre || "").trim() || "Documento"
  const extension = (doc.extension || "").trim().toLowerCase()

  if (!extension) return nombreBase

  const sufijo = `.${extension}`
  if (nombreBase.toLowerCase().endsWith(sufijo)) return nombreBase

  return `${nombreBase}${sufijo}`
}

function leerArchivoComoDataUrl(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(typeof lector.result === "string" ? lector.result : "")
    lector.onerror = () => reject(new Error("No se pudo leer el archivo"))
    lector.readAsDataURL(archivo)
  })
}

async function procesarDocumento(archivo) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`

  try {
    const base = await construirDocumentoDesdeArchivo(archivo, id)
    documentosCargados = [{ ...base, archived: false }, ...documentosCargados.filter(d => d.nombre !== base.nombre)]
    guardarDocumentos()
    renderDocumentos()
    mostrarDocumento(base.id)
    sincronizarSidebarDocumentos()
  } catch (err) {
    console.error("No se pudo procesar el documento", err)
    const baseError = {
      id,
      nombre: obtenerNombreDocumento(archivo.name),
      extension: obtenerExtension(archivo.name),
      url: "",
      texto: "",
      mensaje: "No se pudo leer el documento."
    }
    documentosCargados = [{ ...baseError, archived: false }, ...documentosCargados]
    guardarDocumentos()
    renderDocumentos()
    mostrarDocumento(baseError.id)
    sincronizarSidebarDocumentos()
  }
}

async function construirDocumentoDesdeArchivo(archivo, id, nombreBase = null) {
  const extension = obtenerExtension(archivo.name)
  const base = {
    id,
    nombre: obtenerNombreDocumento(nombreBase || archivo.name),
    extension,
    url: "",
    texto: "",
    mensaje: ""
  }

  const dataUrl = await leerArchivoComoDataUrl(archivo)
  base.url = dataUrl

  if (extension === "pdf") {
    try {
      base.texto = await extraerTextoPdf(archivo)
    } catch (error) {
      console.error("No se pudo extraer texto del PDF", error)
      base.mensaje = "Vista previa limitada: se muestra en visor embebido cuando el navegador lo permite."
    }
  } else if (extension === "docx") {
    try {
      base.texto = await extraerTextoDocx(archivo)
    } catch (error) {
      console.error("No se pudo extraer texto del DOCX", error)
      base.mensaje = "Vista previa limitada: se muestra en visor embebido cuando el navegador lo permite."
    }
  } else if (extension === "pptx") {
    try {
      base.texto = await extraerTextoPptx(archivo)
    } catch (error) {
      console.error("No se pudo extraer texto del PPTX", error)
      base.mensaje = "Vista previa limitada: se muestra en visor embebido cuando el navegador lo permite."
    }
  } else if (extension === "doc" || extension === "ppt") {
    base.mensaje = "Vista previa limitada: se muestra en visor embebido cuando el navegador lo permite."
  } else {
    base.mensaje = "Formato no soportado para vista previa."
  }

  return base
}

async function reemplazarDocumento(id, archivo) {
  const indice = documentosCargados.findIndex(d => d.id === id)
  if (indice < 0) return false

  const nombreSiguiente = obtenerNombreDocumento(archivo?.name || "")

  try {
    const reemplazo = await construirDocumentoDesdeArchivo(archivo, id, nombreSiguiente)
    documentosCargados[indice] = { ...reemplazo, archived: false }
  } catch (err) {
    console.error("No se pudo reemplazar el documento", err)
    documentosCargados[indice] = {
      id,
      nombre: nombreSiguiente,
      extension: obtenerExtension(archivo.name),
      url: "",
      texto: "",
      mensaje: "No se pudo leer el documento.",
      archived: false
    }
  }

  const docActualizado = documentosCargados[indice]
  if (docActualizado && typeof actualizarDocumentoEnCarpetas === "function") {
    actualizarDocumentoEnCarpetas(docActualizado)
  }

  guardarDocumentos()
  renderDocumentos()
  mostrarDocumento(id)
  sincronizarSidebarDocumentos()
  return true
}

function solicitarReemplazoDocumento(id) {
  if (!id || !documentoReemplazoInput) return
  documentoPendienteReemplazoId = id
  documentoReemplazoInput.click()
}

function obtenerDocumentoPorId(id) {
  return documentosCargados.find(doc => doc.id === id) || null
}

const DOCUMENTO_ZOOM_STEP = 0.05
const DOCUMENTO_MIN_ZOOM = 1
const DOCUMENTO_MAX_ZOOM = 2.5
let documentoZoomScale = 1
let documentoZoomBaseSize = null
let documentoZoomFocus = false
let documentoPanActivo = false
let documentoPanPointerId = null
let documentoPanStartX = 0
let documentoPanStartY = 0
let documentoPanScrollLeft = 0
let documentoPanScrollTop = 0

function calcularBaseDocumentoSize(modal) {
  if (!modal?.body || !modal?.contentWrap) return null
  const contenido = modal.contentWrap.firstElementChild
  if (!contenido) return null
  const bodyWidth = modal.body.clientWidth || 1
  const bodyHeight = modal.body.clientHeight || 1
  const contenidoWidth = Math.max(contenido.scrollWidth || 0, contenido.clientWidth || 0, contenido.offsetWidth || 0)
  const contenidoHeight = Math.max(contenido.scrollHeight || 0, contenido.clientHeight || 0, contenido.offsetHeight || 0)
  const width = Math.max(1, Math.min(bodyWidth, contenidoWidth || bodyWidth))
  const height = Math.max(1, Math.min(Math.max(bodyHeight, 560), contenidoHeight || bodyHeight))
  return { width: Math.round(width), height: Math.round(height) }
}

function actualizarEstadoPaneoDocumento(modal) {
  if (!modal?.body || !modal?.backdrop) return
  const previewVisible = modal.backdrop.classList.contains("visible")
  const paneoDisponible = previewVisible && documentoZoomScale > 1
  modal.body.classList.toggle("pan-enabled", paneoDisponible)
  modal.body.classList.toggle("is-panning", paneoDisponible && documentoPanActivo)
}

function detenerPaneoDocumento(modal) {
  documentoPanActivo = false
  documentoPanPointerId = null
  actualizarEstadoPaneoDocumento(modal)
}

function actualizarZoomDocumento(modal) {
  if (!modal?.contentWrap || !modal?.zoomArea || !documentoZoomBaseSize) return
  const width = documentoZoomBaseSize.width
  const height = documentoZoomBaseSize.height
  const scaledWidth = Math.round(width * documentoZoomScale)
  const scaledHeight = Math.round(height * documentoZoomScale)
  modal.contentWrap.style.setProperty("--documento-zoom", documentoZoomScale.toFixed(3))
  modal.zoomArea.style.width = `${scaledWidth}px`
  modal.zoomArea.style.height = `${scaledHeight}px`
  actualizarEstadoPaneoDocumento(modal)
}

function aplicarZoomDocumento(modal, nivel) {
  const limitado = Math.min(DOCUMENTO_MAX_ZOOM, Math.max(DOCUMENTO_MIN_ZOOM, nivel))
  documentoZoomScale = limitado
  actualizarZoomDocumento(modal)
}

function ajustarZoomDocumento(modal) {
  const baseSize = calcularBaseDocumentoSize(modal)
  if (!baseSize || !modal?.contentWrap) return
  documentoZoomBaseSize = baseSize
  modal.contentWrap.style.width = `${baseSize.width}px`
  modal.contentWrap.style.height = `${baseSize.height}px`
  actualizarZoomDocumento(modal)
}

function asegurarModalLecturaDocumentos() {
  if (modalLecturaDocumentos) return modalLecturaDocumentos

  const backdrop = document.createElement("div")
  backdrop.className = "modal-backdrop documento-lectura-backdrop"
  backdrop.setAttribute("aria-hidden", "true")

  const card = document.createElement("div")
  card.className = "modal-card documento-lectura-card"
  card.setAttribute("role", "dialog")
  card.setAttribute("aria-modal", "true")

  const head = document.createElement("div")
  head.className = "modal-head"

  const titulo = document.createElement("h3")
  titulo.className = "documento-lectura-titulo"
  titulo.textContent = "Lectura de documento"

  const toolbar = document.createElement("div")
  toolbar.className = "malla-preview-toolbar documento-lectura-toolbar"

  const zoomControls = document.createElement("div")
  zoomControls.className = "malla-zoom-controls"
  zoomControls.setAttribute("aria-label", "Controles de zoom del documento")

  const zoomIn = document.createElement("button")
  zoomIn.type = "button"
  zoomIn.className = "zoom-btn"
  zoomIn.setAttribute("aria-label", "Aumentar zoom del documento")
  zoomIn.setAttribute("title", "Aumentar zoom (Ctrl +)")
  zoomIn.textContent = "+"

  const zoomOut = document.createElement("button")
  zoomOut.type = "button"
  zoomOut.className = "zoom-btn"
  zoomOut.setAttribute("aria-label", "Disminuir zoom del documento")
  zoomOut.setAttribute("title", "Disminuir zoom (Ctrl -)")
  zoomOut.textContent = "−"

  const cerrar = document.createElement("button")
  cerrar.type = "button"
  cerrar.className = "modal-close"
  cerrar.id = "documentoLecturaClose"
  cerrar.setAttribute("aria-label", "Cerrar")
  cerrar.textContent = "×"

  const body = document.createElement("div")
  body.className = "modal-body documento-lectura-body"

  const zoomArea = document.createElement("div")
  zoomArea.className = "documento-lectura-zoom-area"

  const contentWrap = document.createElement("div")
  contentWrap.className = "documento-lectura-canvas-wrap"
  contentWrap.tabIndex = 0
  contentWrap.setAttribute("aria-label", "Vista del documento con zoom")

  zoomControls.appendChild(zoomIn)
  zoomControls.appendChild(zoomOut)
  toolbar.appendChild(zoomControls)

  head.appendChild(titulo)
  head.appendChild(toolbar)
  head.appendChild(cerrar)

  zoomArea.appendChild(contentWrap)
  body.appendChild(zoomArea)

  card.appendChild(head)
  card.appendChild(body)
  backdrop.appendChild(card)
  document.body.appendChild(backdrop)

  const cerrarModal = () => {
    detenerPaneoDocumento(modalLecturaDocumentos)
    backdrop.classList.remove("visible")
    backdrop.setAttribute("aria-hidden", "true")
  }

  cerrar.addEventListener("click", cerrarModal)
  backdrop.addEventListener("click", e => {
    if (e.target === backdrop) cerrarModal()
  })

  zoomIn.addEventListener("click", () => {
    aplicarZoomDocumento(modalLecturaDocumentos, documentoZoomScale + DOCUMENTO_ZOOM_STEP)
  })

  zoomOut.addEventListener("click", () => {
    aplicarZoomDocumento(modalLecturaDocumentos, documentoZoomScale - DOCUMENTO_ZOOM_STEP)
  })

  contentWrap.addEventListener("mouseenter", () => {
    documentoZoomFocus = true
  })

  contentWrap.addEventListener("mouseleave", () => {
    documentoZoomFocus = false
  })

  contentWrap.addEventListener("focusin", () => {
    documentoZoomFocus = true
  })

  contentWrap.addEventListener("focusout", () => {
    documentoZoomFocus = false
  })

  contentWrap.addEventListener("pointerdown", () => {
    contentWrap.focus?.()
  })

  body.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse" || event.button !== 2) return
    if (!backdrop.classList.contains("visible")) return
    if (documentoZoomScale <= 1) return
    documentoPanActivo = true
    documentoPanPointerId = event.pointerId
    documentoPanStartX = event.clientX
    documentoPanStartY = event.clientY
    documentoPanScrollLeft = body.scrollLeft
    documentoPanScrollTop = body.scrollTop
    body.setPointerCapture?.(event.pointerId)
    event.preventDefault()
    actualizarEstadoPaneoDocumento(modalLecturaDocumentos)
  })

  body.addEventListener("pointermove", event => {
    if (!documentoPanActivo || event.pointerId !== documentoPanPointerId) return
    const deltaX = event.clientX - documentoPanStartX
    const deltaY = event.clientY - documentoPanStartY
    body.scrollLeft = documentoPanScrollLeft - deltaX
    body.scrollTop = documentoPanScrollTop - deltaY
  })

  const detenerPaneoPorPointer = event => {
    if (event.pointerId !== documentoPanPointerId) return
    body.releasePointerCapture?.(event.pointerId)
    detenerPaneoDocumento(modalLecturaDocumentos)
  }

  body.addEventListener("pointerup", detenerPaneoPorPointer)
  body.addEventListener("pointercancel", detenerPaneoPorPointer)
  body.addEventListener("contextmenu", event => {
    if (!backdrop.classList.contains("visible")) return
    if (documentoZoomScale <= 1) return
    event.preventDefault()
  })

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && backdrop.classList.contains("visible")) {
      cerrarModal()
    }
  })

  window.documentoZoomApi = {
    handleWheel(event) {
      if (!event.ctrlKey) return false
      if (!backdrop.classList.contains("visible")) return false
      if (!contentWrap.contains(event.target)) return false
      event.preventDefault()
      const delta = event.deltaY > 0 ? -DOCUMENTO_ZOOM_STEP : DOCUMENTO_ZOOM_STEP
      aplicarZoomDocumento(modalLecturaDocumentos, documentoZoomScale + delta)
      return true
    },
    handleKeydown(event) {
      const ctrl = event.ctrlKey || event.metaKey
      if (!ctrl) return false
      if (!backdrop.classList.contains("visible")) return false
      if (!documentoZoomFocus) return false
      if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        aplicarZoomDocumento(modalLecturaDocumentos, documentoZoomScale + DOCUMENTO_ZOOM_STEP)
        return true
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault()
        aplicarZoomDocumento(modalLecturaDocumentos, documentoZoomScale - DOCUMENTO_ZOOM_STEP)
        return true
      }
      if (event.key === "0") {
        event.preventDefault()
        aplicarZoomDocumento(modalLecturaDocumentos, 1)
        return true
      }
      return false
    }
  }

  window.addEventListener("resize", () => {
    if (!backdrop.classList.contains("visible")) return
    ajustarZoomDocumento(modalLecturaDocumentos)
  })

  modalLecturaDocumentos = {
    backdrop,
    body,
    titulo,
    zoomArea,
    contentWrap,
    cerrarModal
  }

  return modalLecturaDocumentos
}

function abrirLecturaDocumento(id) {
  const doc = obtenerDocumentoPorId(id)
  if (!doc) return

  const modal = asegurarModalLecturaDocumentos()
  modal.titulo.textContent = doc.nombre || "Lectura de documento"
  modal.contentWrap.innerHTML = ""

  if (doc.texto) {
    const texto = document.createElement("div")
    texto.className = "documento-lectura-texto"
    texto.textContent = doc.texto
    modal.contentWrap.appendChild(texto)
  } else if ((doc.extension === "pdf" || doc.extension === "doc" || doc.extension === "docx" || doc.extension === "ppt" || doc.extension === "pptx") && doc.url) {
    const iframe = document.createElement("iframe")
    iframe.className = "documento-lectura-iframe"
    iframe.src = doc.url
    iframe.title = `Lectura ampliada de ${doc.nombre || "documento"}`
    modal.contentWrap.appendChild(iframe)
  } else {
    const alerta = document.createElement("div")
    alerta.className = "documento-alerta"
    alerta.textContent = doc.mensaje || "No se pudo generar vista previa ampliada."
    modal.contentWrap.appendChild(alerta)
  }

  documentoZoomScale = 1
  documentoZoomBaseSize = null
  modal.backdrop.classList.add("visible")
  modal.backdrop.setAttribute("aria-hidden", "false")
  requestAnimationFrame(() => ajustarZoomDocumento(modal))
}

async function extraerTextoDocx(archivo) {
  if (typeof JSZip === "undefined") {
    throw new Error("JSZip no está disponible para leer .docx")
  }

  const buffer = await archivo.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)
  const documento = zip.file("word/document.xml")

  if (!documento) {
    throw new Error("El archivo no contiene texto legible")
  }

  const xml = await documento.async("text")
  const parser = new DOMParser()
  const dom = parser.parseFromString(xml, "application/xml")
  const parrafos = Array.from(dom.getElementsByTagName("w:p"))

  const texto = parrafos
    .map(p => {
      const runs = p.getElementsByTagName("w:t")
      let acumulado = ""
      for (let i = 0; i < runs.length; i++) {
        acumulado += runs[i].textContent
      }
      return acumulado.trim()
    })
    .filter(Boolean)
    .join("\n\n")

  return texto || "No se encontró texto en el documento"
}

async function extraerTextoPdf(archivo) {
  if (typeof pdfjsLib === "undefined") {
    throw new Error("PDF.js no está disponible para leer el PDF")
  }

  const buffer = await archivo.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  let texto = ""

  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i)
    const contenido = await pagina.getTextContent()
    const linea = contenido.items
      .map(item => (item.str || "").trim())
      .filter(Boolean)
      .join(" ")

    if (linea) {
      texto += linea + (i < pdf.numPages ? "\n\n" : "")
    }
  }

  return texto.trim() || "No se encontró texto en el PDF"
}

function renderDocumentos() {
  if (!listaDocumentos) return

  listaDocumentos.innerHTML = ""
  const visibles = documentosCargados.filter(doc => !doc.archived)

  if (!visibles.length) {
    const vacio = document.createElement("div")
    vacio.className = "documentos-vacio"
    vacio.textContent = "Aún no hay documentos cargados."
    listaDocumentos.appendChild(vacio)
    return
  }

  visibles.forEach(doc => {
    const item = document.createElement("div")
    item.className = "documento-item"
    item.draggable = true
    item.dataset.documentoId = doc.id

    const info = document.createElement("div")
    info.className = "documento-info"

    const nombreWrap = document.createElement("div")
    nombreWrap.className = "documento-nombre-wrap"

    const nombreTexto = document.createElement("span")
    nombreTexto.className = "documento-nombre-text"
    nombreTexto.textContent = doc.nombre || "Documento"
    nombreTexto.title = doc.nombre || "Documento"

    nombreWrap.appendChild(nombreTexto)

    const tipo = document.createElement("div")
    tipo.innerHTML = `<small>${doc.extension ? doc.extension.toUpperCase() : "Archivo"}</small>`

    info.appendChild(nombreWrap)
    info.appendChild(tipo)

    const acciones = document.createElement("div")
    acciones.className = "documento-acciones"

    const eliminar = document.createElement("button")
    eliminar.className = "documento-eliminar"
    eliminar.type = "button"
    eliminar.textContent = "Eliminar"
    eliminar.addEventListener("click", e => {
      e.stopPropagation()
      eliminarDocumento(doc.id)
    })

    acciones.appendChild(eliminar)

    item.appendChild(info)
    item.appendChild(acciones)
    item.addEventListener("click", () => {
      const actual = visorDocumentos?.dataset.docActual || ""
      if (actual === doc.id) {
        cerrarVistaDocumento()
      } else {
        mostrarDocumento(doc.id)
      }
    })
    item.addEventListener("dragstart", e => {
      documentoArrastradoId = doc.id
      item.classList.add("documento-arrastrando")
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", doc.id)
        e.dataTransfer.setData("application/x-documento-id", doc.id)
      }
    })
    item.addEventListener("dragend", () => {
      documentoArrastradoId = null
      item.classList.remove("documento-arrastrando")
      listaDocumentos?.classList.remove("drop-activa")
      visorDocumentos?.classList.remove("drop-activa")
      document
        .querySelectorAll(".carpetaDocumentos, .carpetaDocumentosLista, .sidebarDocumentosLista")
        .forEach(z => z.classList.remove("drop-activa"))
    })
    listaDocumentos.appendChild(item)
  })

  actualizarBotonesVer()
}

function obtenerDocumentoDespuesPorPuntero(lista, documentoIdArrastrado, clientY) {
  if (!(lista instanceof HTMLElement) || !documentoIdArrastrado) return null

  const items = Array.from(lista.querySelectorAll(".documento-item")).filter(
    item => item.dataset.documentoId !== documentoIdArrastrado
  )

  if (!items.length) return null

  const escala = Number.isFinite(zoomActual) && zoomActual > 0 ? zoomActual : 1
  const punteroY = clientY / escala

  return items.reduce(
    (cercano, el) => {
      const rect = el.getBoundingClientRect()
      const centroY = (rect.top + rect.height / 2) / escala
      const offset = punteroY - centroY

      if (offset < 0 && offset > cercano.offset) {
        return { offset, elemento: el }
      }

      return cercano
    },
    { offset: Number.NEGATIVE_INFINITY, elemento: null }
  ).elemento
}

function buscarDocumentoItemEnLista(lista, documentoId) {
  if (!(lista instanceof HTMLElement) || !documentoId) return null
  return Array.from(lista.querySelectorAll(".documento-item")).find(
    item => item.dataset.documentoId === documentoId
  ) || null
}

function aplicarOrdenDocumentosPreviewDesdeDOM(lista) {
  if (!(lista instanceof HTMLElement)) return

  const idsVisiblesOrdenados = Array.from(lista.querySelectorAll(".documento-item"))
    .map(item => item.dataset.documentoId)
    .filter(Boolean)

  if (!idsVisiblesOrdenados.length) return

  const docsPorId = new Map(documentosCargados.map(doc => [doc.id, doc]))
  const idsVisiblesSet = new Set(
    documentosCargados.filter(doc => !doc.archived).map(doc => doc.id)
  )

  const ordenVisibleFinal = idsVisiblesOrdenados.filter(id => idsVisiblesSet.has(id))
  if (!ordenVisibleFinal.length) return

  const docsVisibles = ordenVisibleFinal
    .map(id => docsPorId.get(id))
    .filter(Boolean)
  const docsArchivados = documentosCargados.filter(doc => doc.archived)

  documentosCargados = [...docsVisibles, ...docsArchivados]
  guardarDocumentos()
}

function prepararArrastreListaPreview() {
  if (!listaDocumentos || listaDocumentos.dataset.dndPreparado === "1") return
  listaDocumentos.dataset.dndPreparado = "1"

  const obtenerDocumentoArrastrado = e =>
    e?.dataTransfer?.getData("application/x-documento-id") ||
    e?.dataTransfer?.getData("text/plain") ||
    documentoArrastradoId ||
    null

  listaDocumentos.addEventListener("dragover", e => {
    const documentoId = obtenerDocumentoArrastrado(e)
    if (!documentoId) return

    const dragged = buscarDocumentoItemEnLista(listaDocumentos, documentoId)
    if (!(dragged instanceof HTMLElement)) return

    e.preventDefault()
    listaDocumentos.classList.add("drop-activa")
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move"

    const despuesDe = obtenerDocumentoDespuesPorPuntero(listaDocumentos, documentoId, e.clientY)
    if (!despuesDe) {
      listaDocumentos.appendChild(dragged)
    } else {
      listaDocumentos.insertBefore(dragged, despuesDe)
    }
  })

  listaDocumentos.addEventListener("dragenter", e => {
    if (!obtenerDocumentoArrastrado(e)) return
    listaDocumentos.classList.add("drop-activa")
  })

  listaDocumentos.addEventListener("dragleave", e => {
    const related = e.relatedTarget
    if (related instanceof Node && listaDocumentos.contains(related)) return
    listaDocumentos.classList.remove("drop-activa")
  })

  listaDocumentos.addEventListener("drop", e => {
    const documentoId = obtenerDocumentoArrastrado(e)
    if (!documentoId) return

    const dragged = buscarDocumentoItemEnLista(listaDocumentos, documentoId)
    if (!(dragged instanceof HTMLElement)) return

    e.preventDefault()
    listaDocumentos.classList.remove("drop-activa")

    aplicarOrdenDocumentosPreviewDesdeDOM(listaDocumentos)
    documentoArrastradoId = null
    renderDocumentos()
    sincronizarSidebarDocumentos()
  })
}

prepararArrastreListaPreview()

function eliminarDocumento(id) {
  const doc = documentosCargados.find(d => d.id === id)
  if (!doc) return

  const estabaAbiertoEnVista = visorDocumentos?.dataset.docActual === id

  if (estaDocumentoVinculado(id)) {
    documentosCargados = documentosCargados.map(item => (
      item.id === id ? { ...item, archived: true } : item
    ))

    guardarDocumentos()
    renderDocumentos()
    sincronizarSidebarDocumentos()

    if (estabaAbiertoEnVista) {
      cerrarVistaDocumento()
    }
    return
  }

  documentosCargados = documentosCargados.filter(d => d.id !== id)

  removerDocumentoDeCarpetas(id)
  if (typeof quitarDocumentoDeSidebar === "function") {
    quitarDocumentoDeSidebar(id)
  }

  if (doc?.url) {
    try { URL.revokeObjectURL(doc.url) } catch (e) { /* noop */ }
  }

  guardarDocumentos()
  renderDocumentos()
  sincronizarSidebarDocumentos()

  if (estabaAbiertoEnVista) {
    cerrarVistaDocumento()
  }
}

function mostrarDocumento(id, terminoBusqueda = "", indiceCoincidencia = null) {
  if (!visorDocumentos) return

  const doc = documentosCargados.find(d => d.id === id)

  if (!doc) {
    cerrarVistaDocumento()
    return
  }

  visorDocumentos.innerHTML = ""
  visorDocumentos.dataset.docActual = doc.id

  visorDocumentos.appendChild(construirEncabezadoVista(doc))

  if ((doc.extension === "pdf" || doc.extension === "docx" || doc.extension === "pptx") && doc.texto) {
    const texto = document.createElement("div")
    texto.className = "documento-texto"

    const tieneBusqueda = Boolean((terminoBusqueda || "").trim())
    if (!tieneBusqueda) {
      texto.textContent = doc.texto
    } else {
      aplicarResaltadoEnTexto(doc.texto, texto, terminoBusqueda, indiceCoincidencia)
    }

    visorDocumentos.appendChild(texto)
  } else if ((doc.extension === "pdf" || doc.extension === "doc" || doc.extension === "docx" || doc.extension === "ppt" || doc.extension === "pptx") && doc.url) {
    const iframe = document.createElement("iframe")
    iframe.className = "documento-iframe"
    iframe.src = doc.url
    iframe.title = `Vista previa de ${doc.nombre}`
    visorDocumentos.appendChild(iframe)
  } else {
    const alerta = document.createElement("div")
    alerta.className = "documento-alerta"
    alerta.textContent = doc.mensaje || "No se pudo generar vista previa."
    visorDocumentos.appendChild(alerta)
  }

  if (doc.url) {
    const descarga = document.createElement("a")
    descarga.href = doc.url
    descarga.className = "documento-descarga"
    descarga.download = obtenerNombreDescarga(doc)
    descarga.textContent = "Descargar original"
    descarga.style.fontWeight = "700"
    descarga.style.color = "var(--accent)"
    descarga.style.textDecoration = "none"
    descarga.style.marginTop = "6px"
    visorDocumentos.appendChild(descarga)
  }

  actualizarBotonesVer()
}

function construirEncabezadoVista(doc) {
  const encabezado = document.createElement("div")
  encabezado.className = "documento-preview-head"

  const titulo = document.createElement("h4")
  titulo.className = "documento-preview-titulo"
  titulo.textContent = doc ? doc.nombre : "Vista previa"

  if (doc) {
    const abrirLectura = document.createElement("button")
    abrirLectura.type = "button"
    abrirLectura.className = "documento-preview-ampliar"
    abrirLectura.textContent = "Abrir lectura"
    abrirLectura.setAttribute("aria-label", "Abrir vista ampliada del documento")
    abrirLectura.addEventListener("click", () => abrirLecturaDocumento(doc.id))

    const cerrar = document.createElement("button")
    cerrar.type = "button"
    cerrar.className = "preview-close-x documento-preview-cerrar"
    cerrar.textContent = "×"
    cerrar.setAttribute("aria-label", "Cerrar vista previa")
    cerrar.addEventListener("click", cerrarVistaDocumento)

    titulo.tabIndex = 0
    titulo.setAttribute("role", "button")
    titulo.setAttribute("aria-label", "Editar nombre del documento")
    titulo.title = doc.nombre || "Documento"

    const activarEdicion = () => {
      if (encabezado.querySelector(".documento-nombre-input")) return
      const nombreOriginal = doc.nombre || ""

      const input = document.createElement("input")
      input.type = "text"
      input.className = "documento-nombre-input documento-preview-nombre-input"
      input.value = doc.nombre || ""
      input.placeholder = "Nombre del documento"

      const restaurarTitulo = () => {
        const docActual = documentosCargados.find(d => d.id === doc.id)
        titulo.textContent = docActual?.nombre || "Documento"
        titulo.title = docActual?.nombre || "Documento"
        encabezado.insertBefore(titulo, cerrar)
        input.remove()
      }

      input.addEventListener("input", () => previsualizarNombreDocumentoEnVista(doc.id, input.value))
      input.addEventListener("blur", () => {
        normalizarNombreDocumento(doc.id, input)
        restaurarTitulo()
      })
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          e.preventDefault()
          input.blur()
        }
        if (e.key === "Escape") {
          input.value = nombreOriginal
          input.blur()
        }
      })

      titulo.replaceWith(input)
      requestAnimationFrame(() => {
        input.focus()
        input.select()
      })
    }

    titulo.addEventListener("click", activarEdicion)
    titulo.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        activarEdicion()
      }
    })
    encabezado.appendChild(abrirLectura)
    encabezado.appendChild(titulo)
    encabezado.appendChild(cerrar)
  } else {
    encabezado.appendChild(titulo)
  }

  return encabezado
}

function cerrarVistaDocumento() {
  if (!visorDocumentos) return

  visorDocumentos.dataset.docActual = ""
  visorDocumentos.innerHTML = ""
  visorDocumentos.appendChild(construirEncabezadoVista(null))

  if (typeof documentoSeleccionadoEnCarpetaId !== "undefined") {
    documentoSeleccionadoEnCarpetaId = null
  }

  document
    .querySelectorAll(".sidebarItemDocumento.is-selected, .documento-item.is-selected")
    .forEach(item => item.classList.remove("is-selected"))

  const vacio = document.createElement("div")
  vacio.className = "documentos-vacio"
  vacio.textContent = "Selecciona un documento para verlo aquí mismo."
  visorDocumentos.appendChild(vacio)

  actualizarBotonesVer()
  if (typeof ordenarYMostrar === "function") ordenarYMostrar()
  if (typeof reaplicarBusqueda === "function") reaplicarBusqueda()
}

function actualizarBotonesVer() {
  const actual = visorDocumentos?.dataset.docActual || ""

  document.querySelectorAll(".documento-item").forEach(item => {
    const id = item.dataset.documentoId
    item.classList.toggle("is-selected", Boolean(id && id === actual))
  })
}

function previsualizarNombreDocumentoEnVista(id, nombreTemporal) {
  if (visorDocumentos?.dataset.docActual !== id) return
  const titulo = visorDocumentos.querySelector(".documento-preview-titulo")
  if (titulo) titulo.textContent = (nombreTemporal || "").trim() || "Vista previa"
}

function actualizarNombreDocumento(id, nuevoNombre) {
  const doc = documentosCargados.find(d => d.id === id)
  if (!doc) return

  const nombreFinal = (nuevoNombre || "").trim() || "Documento"
  const sinCambios = doc.nombre === nombreFinal

  if (sinCambios) {
    previsualizarNombreDocumentoEnVista(id, nombreFinal)
    return
  }

  doc.nombre = nombreFinal
  guardarDocumentos()
  renderDocumentos()
  actualizarNombreDocumentoEnCarpetas(id, nombreFinal)
  sincronizarSidebarDocumentos()

  if (visorDocumentos?.dataset.docActual === id) {
    const titulo = visorDocumentos.querySelector(".documento-preview-titulo")
    if (titulo) titulo.textContent = nombreFinal || "Vista previa"
    const descarga = visorDocumentos.querySelector(".documento-descarga")
    if (descarga) descarga.download = obtenerNombreDescarga({ ...doc, nombre: nombreFinal })
  }
}

function normalizarNombreDocumento(id, input) {
  const valor = (input?.value || "").trim()
  const nombreFinal = valor || "Documento"

  if (input) input.value = nombreFinal
  actualizarNombreDocumento(id, nombreFinal)
}

function actualizarNombreDocumentoEnCarpetas(id, nombre) {
  document
    .querySelectorAll(`.carpetaDocumentoDetalle[data-doc-id="${id}"]`)
    .forEach(detalle => {
      detalle.textContent = nombre || "Documento"
    })

  const docActual = documentosCargados.find(d => d.id === id)
  if (docActual && typeof actualizarDocumentoEnCarpetas === "function") {
    actualizarDocumentoEnCarpetas(docActual)
  }
}

function aplicarResaltadoEnTexto(textoFuente, contenedor, termino, indiceActivo) {
  const terminoLimpio = (termino || "").trim().toLowerCase()

  if (!terminoLimpio) {
    contenedor.textContent = textoFuente
    return
  }

  const textoPlano = textoFuente || ""
  const textoMin = textoPlano.toLowerCase()
  let pos = textoMin.indexOf(terminoLimpio)
  let ultimoCorte = 0
  let contador = 0

  if (pos === -1) {
    contenedor.textContent = textoPlano
    return
  }

  while (pos !== -1) {
    if (pos > ultimoCorte) {
      contenedor.appendChild(document.createTextNode(textoPlano.slice(ultimoCorte, pos)))
    }

    const marca = document.createElement("span")
    marca.className = "resaltado-busqueda-marca"
    marca.textContent = textoPlano.slice(pos, pos + terminoLimpio.length)
    if (indiceActivo !== null && contador === indiceActivo) {
      marca.classList.add("resaltado-busqueda-activo")
    }
    contenedor.appendChild(marca)

    ultimoCorte = pos + terminoLimpio.length
    pos = textoMin.indexOf(terminoLimpio, ultimoCorte)
    contador++
  }

  if (ultimoCorte < textoPlano.length) {
    contenedor.appendChild(document.createTextNode(textoPlano.slice(ultimoCorte)))
  }
}

async function extraerTextoPptx(archivo) {
  if (typeof JSZip === "undefined") {
    throw new Error("JSZip no está disponible para leer .pptx")
  }

  const buffer = await archivo.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)
  const slidePaths = Object.keys(zip.files)
    .filter(path => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => {
      const aNum = Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0)
      const bNum = Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0)
      return aNum - bNum
    })

  if (!slidePaths.length) {
    throw new Error("El archivo no contiene diapositivas legibles")
  }

  const parser = new DOMParser()
  const chunks = []

  for (const path of slidePaths) {
    const xml = await zip.file(path)?.async("text")
    if (!xml) continue
    const dom = parser.parseFromString(xml, "application/xml")
    const textNodes = Array.from(dom.getElementsByTagName("a:t"))
    const text = textNodes.map(n => (n.textContent || "").trim()).filter(Boolean).join(" ")
    if (text) chunks.push(text)
  }

  return chunks.join("\n\n") || "No se encontró texto en la presentación"
}

function eliminarDocumentoDefinitivo(id) {
  const doc = documentosCargados.find(d => d.id === id)
  if (!doc) return false

  documentosCargados = documentosCargados.filter(d => d.id !== id)

  if (typeof removerDocumentoDeCarpetas === "function") {
    removerDocumentoDeCarpetas(id)
  }

  if (typeof quitarDocumentoDeSidebar === "function") {
    quitarDocumentoDeSidebar(id)
  }

  if (doc.url) {
    try { URL.revokeObjectURL(doc.url) } catch (e) { /* noop */ }
  }

  guardarDocumentos()
  renderDocumentos()
  sincronizarSidebarDocumentos()

  if (visorDocumentos?.dataset.docActual === id) {
    cerrarVistaDocumento()
  }

  return true
}

window.eliminarDocumentoDefinitivo = eliminarDocumentoDefinitivo
window.solicitarReemplazoDocumento = solicitarReemplazoDocumento