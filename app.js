let codigoActual = {}
let articulos = JSON.parse(localStorage.getItem("articulosGuardados") || "[]")
  .map(a => ({ ...a, contenidoHTML: a.contenidoHTML ?? null }))
let materiasOrden = JSON.parse(localStorage.getItem("materiasOrden") || "{}")
let carpetas = JSON.parse(localStorage.getItem("carpetasMaterias") || "[]").map(c => ({
  ...c,
  color: c.color || "#1e3a8a",
  semestre: (c.semestre || "Semestre").trim() || "Semestre",
  documentos: c.documentos || [],
  documentosData: c.documentosData || {}
}))
let normativaSeleccionada = null
let materiaSeleccionada = null
let materiaDropProcesado = false
const appRoot = document.getElementById("appRoot")
const contenedorArticulosPrincipal = document.getElementById("contenidoArticulos")
const modalConfiguracion = document.getElementById("modalConfiguracion")

function escaparComoHTML(texto) {
  if (texto === undefined || texto === null) return ""
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

const ZOOM_STEP = 0.05
const MIN_ZOOM = 1
const MAX_ZOOM = 1.25
const ZOOM_STORAGE_KEY = "appZoomScale"
let zoomActual = obtenerZoomInicial()
let pinchStartDistance = null
let pinchStartZoom = 1
let articuloArrastradoId = null
let materiaArrastrada = null
let materiaArrastradaNormativa = null
let materiaArrastradaCarpetaId = null
let documentoSeleccionadoEnCarpetaId = null
const DOCUMENTOS_SIDEBAR_STORAGE_KEY = "documentosSidebarIds"
let documentosSidebarIds = cargarDocumentosSidebarIds()

function cargarDocumentosSidebarIds() {
  try {
    const guardados = JSON.parse(localStorage.getItem(DOCUMENTOS_SIDEBAR_STORAGE_KEY) || "[]")
    if (!Array.isArray(guardados)) return []
    return Array.from(new Set(guardados.filter(id => typeof id === "string" && id.trim())))
  } catch (error) {
    return []
  }
}

function guardarDocumentosSidebarIds() {
  localStorage.setItem(DOCUMENTOS_SIDEBAR_STORAGE_KEY, JSON.stringify(documentosSidebarIds))
}

function agregarDocumentoASidebar(documentoId) {
  if (!documentoId) return false
  if (documentosSidebarIds.includes(documentoId)) return false
  documentosSidebarIds = [...documentosSidebarIds, documentoId]
  guardarDocumentosSidebarIds()
  return true
}

function quitarDocumentoDeSidebar(documentoId) {
  const totalAntes = documentosSidebarIds.length
  documentosSidebarIds = documentosSidebarIds.filter(id => id !== documentoId)
  if (documentosSidebarIds.length !== totalAntes) {
    guardarDocumentosSidebarIds()
    return true
  }
  return false
}

window.quitarDocumentoDeSidebar = quitarDocumentoDeSidebar


modalConfiguracion?.addEventListener("click", e => {
  if (e.target === modalConfiguracion) cerrarModalConfiguracion()
})

function manejarReordenArticulos(e) {
  if (!articuloArrastradoId) return

  const contenedor = e.currentTarget
  if (!(contenedor instanceof HTMLElement)) return

  const articulosEnDom = Array.from(contenedor.querySelectorAll(".articulo"))
    .filter(el => el.dataset.id !== articuloArrastradoId)
  if (!articulosEnDom.length) return

  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move"

  const arrastrandoElem = contenedor.querySelector(
    `.articulo[data-id="${articuloArrastradoId}"]`
  )

  if (!arrastrandoElem) return

  const objetivoDespues = articulosEnDom.reduce(
    (cercano, el) => {
      const rect = el.getBoundingClientRect()
      const offset = e.clientY - (rect.top + rect.height / 2)

      if (offset < 0 && offset > cercano.offset) {
        return { offset, elemento: el }
      }

      return cercano
    },
    { offset: Number.NEGATIVE_INFINITY, elemento: null }
  ).elemento

  if (!objetivoDespues) {
    contenedor.appendChild(arrastrandoElem)
  } else {
    contenedor.insertBefore(arrastrandoElem, objetivoDespues)
  }
}

function marcarListaComoObjetivo(lista) {
  lista.classList.add("drop-activa")
  if (lista.classList.contains("carpetaLista")) {
    lista.classList.add("carpetaLista-drop")
  }
}

if (contenedorArticulosPrincipal) {
  contenedorArticulosPrincipal.addEventListener("dragover", manejarReordenArticulos)
  contenedorArticulosPrincipal.addEventListener("drop", manejarReordenArticulos)
}


function valorOrdenArticulo(a) {
  if (typeof a.orden === "number") return a.orden
  if (typeof a.numero === "number") return a.numero
  return 0
}

function guardarOrdenMaterias() {
  localStorage.setItem("materiasOrden", JSON.stringify(materiasOrden))
}

function siguienteOrdenMateria(normativa) {
  const ordenes = materiasOrden[normativa]
    ? Object.values(materiasOrden[normativa]).filter(n => typeof n === "number")
    : []

  if (!ordenes.length) return 1
  return Math.max(...ordenes) + 1
}

function asegurarOrdenMateria(normativa, materia) {
  if (!materiasOrden[normativa]) materiasOrden[normativa] = {}
  if (typeof materiasOrden[normativa][materia] !== "number") {
    materiasOrden[normativa][materia] = siguienteOrdenMateria(normativa)
    guardarOrdenMaterias()
  }
}

function ordenarMaterias(nombres, normativa) {
  nombres.forEach(nombre => asegurarOrdenMateria(normativa, nombre))
  return [...nombres].sort(
    (a, b) => (materiasOrden[normativa][a] ?? 0) - (materiasOrden[normativa][b] ?? 0)
  )
}

function guardarCarpetas() {
  localStorage.setItem("carpetasMaterias", JSON.stringify(carpetas))
}

function crearCarpeta(nombre) {
  return {
    id: `carpeta-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    nombre,
    color: "#1e3a8a",
    semestre: "Semestre",
    materias: [],
    documentos: [],
    documentosData: {},
    colapsada: false
  }
}

function configurarNombreEditableCarpeta(carpeta, nombreEl) {
  if (!nombreEl) return
  nombreEl.setAttribute("contenteditable", "true")
  nombreEl.setAttribute("role", "textbox")
  nombreEl.setAttribute("aria-label", "Editar nombre de carpeta")
  nombreEl.setAttribute("spellcheck", "false")

  const restaurarTexto = valor => {
    nombreEl.textContent = valor || "Carpeta sin título"
  }

  let textoOriginal = carpeta.nombre || "Carpeta sin título"

  nombreEl.addEventListener("focus", () => {
    textoOriginal = nombreEl.textContent || textoOriginal
  })

  nombreEl.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault()
      nombreEl.blur()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      restaurarTexto(textoOriginal)
      nombreEl.blur()
    }
  })

  nombreEl.addEventListener("blur", () => {
    const nuevo = (nombreEl.textContent || "").trim()
    if (!nuevo) {
      restaurarTexto(textoOriginal)
      return
    }
    if (nuevo === textoOriginal) {
      restaurarTexto(nuevo)
      return
    }
    carpetas = carpetas.map(c => (c.id === carpeta.id ? { ...c, nombre: nuevo } : c))
    guardarCarpetas()
    ordenarYMostrar()
  })
}

function insertarEditorCarpeta(contenedor) {
  if (!contenedor || contenedor.querySelector(".carpetaBox.carpeta-editor")) {
    const existente = contenedor?.querySelector(".carpetaBox.carpeta-editor input")
    existente?.focus()
    return
  }

  const placeholder = contenedor.querySelector(":scope > .carpetaVacia")
  if (placeholder) placeholder.remove()

  const card = document.createElement("div")
  card.className = "carpetaBox carpeta-editor"

  const header = document.createElement("div")
  header.className = "carpetaHeader"

  const tituloWrap = document.createElement("div")
  tituloWrap.className = "carpetaTituloWrap"

  const input = document.createElement("input")
  input.type = "text"
  input.className = "carpetaNombreInput"
  input.placeholder = "Nombre de la carpeta"

  tituloWrap.appendChild(input)
  header.appendChild(tituloWrap)

  const acciones = document.createElement("div")
  acciones.className = "carpetaActions"

  const guardar = document.createElement("button")
  guardar.type = "button"
  guardar.className = "carpetaGuardar"
  guardar.textContent = "Guardar"

  const cancelar = document.createElement("button")
  cancelar.type = "button"
  cancelar.className = "carpetaCancelar"
  cancelar.textContent = "Cancelar"

  acciones.appendChild(guardar)
  acciones.appendChild(cancelar)
  header.appendChild(acciones)
  card.appendChild(header)

  const cerrarEditor = () => {
    card.remove()
  }

  const confirmar = () => {
    const nombre = input.value.trim()
    if (!nombre) {
      input.focus()
      return
    }
    carpetas = [...carpetas, crearCarpeta(nombre)]
    guardarCarpetas()
    ordenarYMostrar()
  }

  guardar.addEventListener("click", confirmar)
  cancelar.addEventListener("click", cerrarEditor)
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault()
      confirmar()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      cerrarEditor()
    }
  })

  contenedor.prepend(card)
  requestAnimationFrame(() => input.focus())
}

function carpetaDeDocumento(documentoId) {
  return carpetas.find(carpeta => carpeta.documentos?.includes(documentoId)) || null
}

function materiaEnCarpeta(normativa, materia) {
  const carpeta = carpetas.find(c =>
    c.materias?.some(m => m.materia === materia && m.normativa === normativa)
  )
  return carpeta ? carpeta.id : null
}

function removerDocumentoDeCarpetas(documentoId, carpetaId = null) {
  let cambio = false

  carpetas = carpetas.map(carpeta => {
    if (carpetaId && carpeta.id !== carpetaId) return carpeta

    const documentos = (carpeta.documentos || []).filter(id => id !== documentoId)
    const documentosData = { ...(carpeta.documentosData || {}) }

    if (documentos.length !== (carpeta.documentos || []).length) cambio = true
    if (documentosData[documentoId]) {
      delete documentosData[documentoId]
      cambio = true
    }

    return { ...carpeta, documentos, documentosData }
  })

  if (cambio) guardarCarpetas()
  return cambio
}

function removerMateriaDeCarpetas(normativa, materia) {
  let cambio = false
  carpetas = carpetas.map(carpeta => {
    const materias = (carpeta.materias || []).filter(
      m => !(m.materia === materia && m.normativa === normativa)
    )
    if (materias.length !== (carpeta.materias || []).length) cambio = true
    return { ...carpeta, materias }
  })

  if (cambio) guardarCarpetas()
  return cambio
}

function renombrarMateriaEnCarpetas(normativa, materiaAnterior, materiaNueva) {
  let cambio = false

  carpetas = carpetas.map(carpeta => {
    const materias = (carpeta.materias || []).map(m => {
      if (m.normativa === normativa && m.materia === materiaAnterior) {
        cambio = true
        return { ...m, materia: materiaNueva }
      }
      return m
    })

    const set = new Set()
    const materiasUnicas = materias.filter(m => {
      const key = `${m.normativa}||${m.materia}`
      if (set.has(key)) {
        cambio = true
        return false
      }
      set.add(key)
      return true
    })

    return { ...carpeta, materias: materiasUnicas }
  })

  if (cambio) guardarCarpetas()
}

function moverMateriaACarpeta(normativa, materia, carpetaId) {
  if (!carpetaId) return
  removerMateriaDeCarpetas(normativa, materia)
  carpetas = carpetas.map(carpeta => {
    if (carpeta.id !== carpetaId) return carpeta
    const materias = [...(carpeta.materias || [])]
    if (!materias.some(m => m.materia === materia && m.normativa === normativa)) {
      materias.push({ normativa, materia })
    }
    return { ...carpeta, materias }
  })
  guardarCarpetas()
  ordenarYMostrar()
}

function normalizarDocumentoParaCarpeta(documento) {
  if (!documento || !documento.id) return null
  return {
    id: documento.id,
    nombre: documento.nombre || "Documento",
    extension: documento.extension || "",
    url: documento.url || "",
    texto: documento.texto || "",
    mensaje: documento.mensaje || ""
  }
}

function actualizarDocumentoEnCarpetas(documento) {
  const base = normalizarDocumentoParaCarpeta(documento)
  if (!base) return

  let cambio = false
  carpetas = carpetas.map(carpeta => {
    if (!(carpeta.documentos || []).includes(base.id) && !(carpeta.documentosData || {})[base.id]) {
      return carpeta
    }

    const documentosData = { ...(carpeta.documentosData || {}), [base.id]: base }
    cambio = true
    return { ...carpeta, documentosData }
  })

  if (cambio) guardarCarpetas()
}

function obtenerDocumentoRespaldoEnCarpetas(documentoId) {
  if (!documentoId) return null
  for (const carpeta of carpetas) {
    const respaldo = carpeta.documentosData?.[documentoId]
    if (respaldo) return { ...respaldo }
  }
  return null
}

function moverDocumentoACarpeta(documentoId, carpetaId) {
  if (!carpetaId || !documentoId) return
  removerDocumentoDeCarpetas(documentoId)
  quitarDocumentoDeSidebar(documentoId)
  documentoSeleccionadoEnCarpetaId = documentoId

  const documento = documentosCargados.find(doc => doc.id === documentoId)
  const documentoBase = normalizarDocumentoParaCarpeta(documento)

  carpetas = carpetas.map(carpeta => {
    if (carpeta.id !== carpetaId) return carpeta
    const documentos = new Set(carpeta.documentos || [])
    documentos.add(documentoId)

    const documentosData = { ...(carpeta.documentosData || {}) }
    if (documentoBase) documentosData[documentoId] = documentoBase

    return { ...carpeta, documentos: Array.from(documentos), documentosData }
  })

  guardarCarpetas()
  ordenarYMostrar()
  renderDocumentos()
}

function moverMateriaAFueraDeCarpeta(materia, normativa) {
  const cambio = removerMateriaDeCarpetas(normativa, materia)
  if (cambio) ordenarYMostrar()
}

function aplicarOrdenMateriasDesdeDOM(lista) {
  if (!lista) return
  const items = Array.from(lista.querySelectorAll(".sidebarItem"))
  if (!items.length) return

  const ordenesPorNormativa = {}

  items.forEach((item, index) => {
    const normativa = item.dataset.normativa
    const materia = item.dataset.materia
    if (!normativa || !materia) return
    if (!ordenesPorNormativa[normativa]) ordenesPorNormativa[normativa] = []
    ordenesPorNormativa[normativa].push({ materia, posicion: index + 1 })
  })

  Object.entries(ordenesPorNormativa).forEach(([normativa, materias]) => {
    if (!materiasOrden[normativa]) materiasOrden[normativa] = {}
    materias.forEach(({ materia, posicion }) => {
      materiasOrden[normativa][materia] = posicion
    })
  })

  guardarOrdenMaterias()
}

function siguienteOrdenPara(normativa, materia) {
  const ordenes = articulos
    .filter(a => a.normativa === normativa && a.materia === materia)
    .map(valorOrdenArticulo)

  if (!ordenes.length) return 1
  return Math.max(...ordenes) + 1
}

function obtenerZoomInicial() {
  const guardado = parseFloat(localStorage.getItem(ZOOM_STORAGE_KEY) || "")
  if (!Number.isFinite(guardado)) return 1
  return guardado
}

function aplicarZoom(nivel) {
  const limitado = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nivel))
  zoomActual = limitado
  document.documentElement.style.setProperty("--zoom-scale", limitado.toFixed(3))
  localStorage.setItem(ZOOM_STORAGE_KEY, limitado.toFixed(3))
}

function distanciaEntreToques(touches) {
  if (touches.length < 2) return 0
  const [a, b] = touches
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

function esCampoEditable(elem) {
  if (!elem) return null
  const destino = elem.closest(
    "input, textarea, [contenteditable=\"true\"], .articulo-contenido, .nota-box"
  )
  return destino || (elem.isContentEditable ? elem : null)
}

let menuContextual
let botonCopiarMenu
let botonPegarMenu
let objetivoContextual

function crearMenuContextual() {
  const menu = document.createElement("div")
  menu.className = "menu-contextual"

  const copiar = document.createElement("button")
  copiar.type = "button"
  copiar.textContent = "Copiar"

  const pegar = document.createElement("button")
  pegar.type = "button"
  pegar.textContent = "Pegar"

  menu.appendChild(copiar)
  menu.appendChild(pegar)

  return { menu, copiar, pegar }
}

function ocultarMenuContextual() {
  if (menuContextual) menuContextual.style.display = "none"
  objetivoContextual = null
}

function seleccionPerteneceAlObjetivo(objetivo, seleccion) {
  if (!seleccion) return false
  if (!seleccion.anchorNode) return false
  if (seleccion.anchorNode === objetivo) return true
  return objetivo.contains(seleccion.anchorNode)
}

function textoSeleccionadoEnObjetivo(objetivo) {
  if (!objetivo) return ""

  if (objetivo instanceof HTMLInputElement || objetivo instanceof HTMLTextAreaElement) {
    const inicio = objetivo.selectionStart ?? 0
    const fin = objetivo.selectionEnd ?? 0
    if (inicio !== fin) return objetivo.value.slice(inicio, fin)
    return objetivo.value
  }

  const seleccion = window.getSelection()
  if (seleccion && seleccion.toString().trim() && seleccionPerteneceAlObjetivo(objetivo, seleccion)) {
    return seleccion.toString()
  }

  return objetivo.textContent || ""
}

function actualizarEstadoMenuContextual() {
  if (!menuContextual) return

  const hayObjetivo = Boolean(objetivoContextual)
  const textoSeleccion = hayObjetivo ? textoSeleccionadoEnObjetivo(objetivoContextual).trim() : ""

  const soporteClipboard = Boolean(navigator.clipboard)
  const puedeCopiar = soporteClipboard && hayObjetivo && Boolean(textoSeleccion)
  const puedePegar = soporteClipboard && hayObjetivo && Boolean(navigator.clipboard.readText)

  botonCopiarMenu.disabled = !puedeCopiar
  botonPegarMenu.disabled = !puedePegar
}

function mostrarMenuContextual(x, y) {
  if (!menuContextual) return

  menuContextual.style.display = "flex"

  const ancho = menuContextual.offsetWidth
  const alto = menuContextual.offsetHeight
  const margen = 12

  let posX = x
  let posY = y

  const maxX = window.innerWidth - ancho - margen
  const maxY = window.innerHeight - alto - margen

  posX = Math.min(posX, Math.max(margen, maxX))
  posY = Math.min(posY, Math.max(margen, maxY))

  menuContextual.style.left = `${posX}px`
  menuContextual.style.top = `${posY}px`
}

function obtenerPosicionMenuContextual(objetivo) {
  if (!objetivo) return { x: window.innerWidth / 2, y: window.innerHeight / 2 }

  const seleccion = window.getSelection()
  if (seleccion && seleccion.rangeCount > 0 && seleccionPerteneceAlObjetivo(objetivo, seleccion)) {
    const rango = seleccion.getRangeAt(0)
    const rect = rango.getBoundingClientRect()
    if (rect.width || rect.height) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8
      }
    }
  }

  const rect = objetivo.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.bottom + 8
  }
}

function enfocarObjetivoParaPegar() {
  if (!objetivoContextual) return
  const seleccion = window.getSelection()

  if (
    objetivoContextual instanceof HTMLInputElement ||
    objetivoContextual instanceof HTMLTextAreaElement
  ) {
    objetivoContextual.focus({ preventScroll: true })
    return
  }

  if (seleccion && seleccionPerteneceAlObjetivo(objetivoContextual, seleccion)) return

  const rango = document.createRange()
  const ultimoNodo = objetivoContextual.lastChild
  if (ultimoNodo) {
    rango.setStartAfter(ultimoNodo)
  } else {
    rango.setStart(objetivoContextual, 0)
  }
  rango.collapse(true)

  if (seleccion) {
    seleccion.removeAllRanges()
    seleccion.addRange(rango)
  }

  objetivoContextual.focus({ preventScroll: true })
}

function pegarEnObjetivo(texto) {
  if (!objetivoContextual || !texto) return

  if (objetivoContextual instanceof HTMLInputElement || objetivoContextual instanceof HTMLTextAreaElement) {
    const inicio = objetivoContextual.selectionStart ?? objetivoContextual.value.length
    const fin = objetivoContextual.selectionEnd ?? objetivoContextual.value.length
    try {
      objetivoContextual.setRangeText(texto, inicio, fin, "end")
    } catch (error) {
      const nuevoValor =
        objetivoContextual.value.slice(0, inicio) + texto + objetivoContextual.value.slice(fin)

      objetivoContextual.value = nuevoValor

      const nuevaPos = inicio + texto.length
      objetivoContextual.setSelectionRange(nuevaPos, nuevaPos)
    }

    objetivoContextual.dispatchEvent(new Event("input", { bubbles: true }))
    return
  }

  enfocarObjetivoParaPegar()

  const seleccion = window.getSelection()
  if (seleccion && seleccion.rangeCount > 0) {
    const rango = seleccion.getRangeAt(0)
    const rangoClonado = rango.cloneRange()

    const pudoInsertar =
      typeof document.queryCommandSupported === "function" &&
      document.queryCommandSupported("insertText")
        ? document.execCommand("insertText", false, texto)
        : false

    if (!pudoInsertar) {
      rangoClonado.deleteContents()
      rangoClonado.insertNode(document.createTextNode(texto))
      rangoClonado.collapse(false)
      seleccion.removeAllRanges()
      seleccion.addRange(rangoClonado)
    }
  } else {
    objetivoContextual.textContent += texto
  }

  objetivoContextual.dispatchEvent(new Event("input", { bubbles: true }))
}

function inicializarMenuContextual() {
  const { menu, copiar, pegar } = crearMenuContextual()
  menuContextual = menu
  botonCopiarMenu = copiar
  botonPegarMenu = pegar

  document.body.appendChild(menuContextual)

  document.addEventListener("contextmenu", e => {
    const editable = esCampoEditable(e.target)

    if (!editable) {
      ocultarMenuContextual()
      return
    }

    e.preventDefault()
    objetivoContextual = editable
    actualizarEstadoMenuContextual()
    mostrarMenuContextual(e.clientX, e.clientY)
  })

  botonCopiarMenu.addEventListener("click", async () => {
    if (!objetivoContextual || !navigator.clipboard?.writeText) return

    const texto = textoSeleccionadoEnObjetivo(objetivoContextual)
    if (!texto.trim()) return

    try {
      await navigator.clipboard.writeText(texto)
    } catch (error) {
      console.error("No se pudo copiar", error)
    }

    ocultarMenuContextual()
  })

  botonPegarMenu.addEventListener("click", async () => {
    if (!objetivoContextual || !navigator.clipboard?.readText) return

    try {
      const texto = await navigator.clipboard.readText()
      pegarEnObjetivo(texto)
    } catch (error) {
      console.error("No se pudo pegar", error)
    }

    ocultarMenuContextual()
  })

  document.addEventListener(
    "pointerdown",
    e => {
      if (e.button !== 0) return
      if (!menuContextual || menuContextual.style.display === "none") return
      if (!menuContextual.contains(e.target)) ocultarMenuContextual()
    },
    true
  )

  document.addEventListener("click", e => {
    if (!menuContextual || menuContextual.style.display === "none") return
    if (!menuContextual.contains(e.target)) ocultarMenuContextual()
  })

  window.addEventListener("resize", ocultarMenuContextual)
  window.addEventListener("scroll", ocultarMenuContextual, true)
}

function aplicarOrdenDesdeDOM(contenedorLista, normativa, materia) {
  if (!contenedorLista) return

  const idsEnOrden = Array.from(contenedorLista.querySelectorAll(".articulo"))
    .map(el => Number(el.dataset.id))
    .filter(Boolean)

  idsEnOrden.forEach((id, index) => {
    const art = articulos.find(a => a.id === id)
    if (art && art.normativa === normativa && art.materia === materia) {
      art.orden = index + 1
    }
  })

  guardarLocal()
  ordenarYMostrar()
}

function obtenerElementoMateriaDespues(lista, posicionY) {
  return Array.from(lista.querySelectorAll(".sidebarItem"))
    .filter(
      el =>
        el.dataset.materia !== materiaArrastrada ||
        el.dataset.normativa !== materiaArrastradaNormativa
    )
    .reduce(
      (cercano, el) => {
        const rect = el.getBoundingClientRect()
        const offset = posicionY - (rect.top + rect.height / 2)

        if (offset < 0 && offset > cercano.offset) {
          return { offset, elemento: el }
        }

        return cercano
      },
      { offset: Number.NEGATIVE_INFINITY, elemento: null }
    ).elemento
}

function limpiarPlaceholderVacio(lista) {
  const placeholder = lista?.querySelector(".carpetaVacia")
  if (placeholder) placeholder.remove()
}

function manejarDragOverListaMaterias(e) {
  if (!materiaArrastrada) return
  e.preventDefault()

  const lista = e.currentTarget
  marcarListaComoObjetivo(lista)
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move"

  const arrastrandoElem = document.querySelector(
    `.sidebarItem[data-materia="${materiaArrastrada}"][data-normativa="${materiaArrastradaNormativa}"]`
  )

  if (!arrastrandoElem) return

  limpiarPlaceholderVacio(lista)

  const despuesDe = obtenerElementoMateriaDespues(lista, e.clientY)

  if (arrastrandoElem.parentElement !== lista) {
    lista.appendChild(arrastrandoElem)
  }

  if (!despuesDe) {
    lista.appendChild(arrastrandoElem)
  } else {
    lista.insertBefore(arrastrandoElem, despuesDe)
  }
}

function manejarDropListaMaterias(e) {
  if (!materiaArrastrada || !materiaArrastradaNormativa) return
  e.preventDefault()

  const listaObjetivo = e.currentTarget
  listaObjetivo.classList.remove("carpetaLista-drop", "drop-activa")

  const carpetaObjetivo = listaObjetivo.dataset.carpetaId || null
  const mismaCarpeta = (materiaArrastradaCarpetaId || null) === carpetaObjetivo

  if (!mismaCarpeta) {
    materiaDropProcesado = true
    if (carpetaObjetivo) {
      moverMateriaACarpeta(
        materiaArrastradaNormativa,
        materiaArrastrada,
        carpetaObjetivo
      )
    } else {
      moverMateriaAFueraDeCarpeta(materiaArrastrada, materiaArrastradaNormativa)
    }
    limpiarEstadoArrastreMateria()
    return
  }

  aplicarOrdenMateriasDesdeDOM(listaObjetivo)
  materiaDropProcesado = true
  limpiarEstadoArrastreMateria()
}

function prepararListaMaterias(lista) {
  if (!lista) return

  lista.addEventListener("dragover", manejarDragOverListaMaterias)
  lista.addEventListener("dragenter", e => {
    if (!materiaArrastrada) return
    marcarListaComoObjetivo(lista)
  })
  lista.addEventListener("dragleave", () => {
    lista.classList.remove("drop-activa", "carpetaLista-drop")
  })
  lista.addEventListener("drop", manejarDropListaMaterias)
}

function prepararZonaDocumentosCarpeta(zona, carpetaId) {
  if (!zona) return

  const obtenerDocumentoArrastrado = e =>
    e?.dataTransfer?.getData("application/x-documento-id") ||
    e?.dataTransfer?.getData("text/plain") ||
    documentoArrastradoId ||
    null

  zona.addEventListener("dragover", e => {
    if (!obtenerDocumentoArrastrado(e)) return
    e.preventDefault()
    e.stopPropagation()
    zona.classList.add("drop-activa")
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
  }, true)

  zona.addEventListener("dragenter", e => {
    if (!obtenerDocumentoArrastrado(e)) return
    e.stopPropagation()
    zona.classList.add("drop-activa")
  }, true)

  zona.addEventListener("dragleave", () => {
    zona.classList.remove("drop-activa")
  }, true)

  zona.addEventListener("drop", e => {
    const documentoId = obtenerDocumentoArrastrado(e)
    if (!documentoId) return
    e.preventDefault()
    e.stopPropagation()
    zona.classList.remove("drop-activa")
    moverDocumentoACarpeta(documentoId, carpetaId)
    documentoArrastradoId = null
  }, true)
}

function prepararListaDocumentosSidebar(lista) {
  if (!lista) return

  const obtenerDocumentoArrastrado = e =>
    e?.dataTransfer?.getData("application/x-documento-id") ||
    e?.dataTransfer?.getData("text/plain") ||
    documentoArrastradoId ||
    null

  lista.addEventListener("dragover", e => {
    const documentoId = obtenerDocumentoArrastrado(e)
    if (!documentoId) return
    e.preventDefault()
    lista.classList.add("drop-activa")

    const target = e.target instanceof Element
      ? e.target.closest(".sidebarItemDocumento")
      : null
    const dragged = lista.querySelector(`.sidebarItemDocumento[data-documento-id="${documentoId}"]`)

    if (!(target instanceof HTMLElement) || !(dragged instanceof HTMLElement)) {
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
      return
    }
    if (target === dragged) {
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
      return
    }

    const rect = target.getBoundingClientRect()
    const before = e.clientY < rect.top + rect.height / 2
    if (before) {
      lista.insertBefore(dragged, target)
    } else {
      lista.insertBefore(dragged, target.nextSibling)
    }

    if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
  })

  lista.addEventListener("dragenter", e => {
    if (!obtenerDocumentoArrastrado(e)) return
    lista.classList.add("drop-activa")
  })

  lista.addEventListener("dragleave", () => {
    lista.classList.remove("drop-activa")
  })

  lista.addEventListener("drop", e => {
    const documentoId = obtenerDocumentoArrastrado(e)
    if (!documentoId) return
    e.preventDefault()
    lista.classList.remove("drop-activa")

    if (documentosSidebarIds.includes(documentoId)) {
      aplicarOrdenDocumentosSidebarDesdeDOM(lista)
      documentoArrastradoId = null
      ordenarYMostrar()
      return
    }

    const cambio = removerDocumentoDeCarpetas(documentoId)
    const agregado = agregarDocumentoASidebar(documentoId)
    documentoSeleccionadoEnCarpetaId = documentoId
    documentoArrastradoId = null
    if (cambio || agregado) ordenarYMostrar()
  })
}

function aplicarOrdenDocumentosSidebarDesdeDOM(lista) {
  if (!lista) return

  const idsEnDOM = Array.from(lista.querySelectorAll(".sidebarItemDocumento"))
    .map(item => item.dataset.documentoId)
    .filter(Boolean)

  if (!idsEnDOM.length || idsEnDOM.length !== documentosSidebarIds.length) return

  const idsActuales = new Set(documentosSidebarIds)
  const contieneLosMismos = idsEnDOM.every(id => idsActuales.has(id))
  if (!contieneLosMismos) return

  const cambio = idsEnDOM.some((id, index) => id !== documentosSidebarIds[index])
  if (!cambio) return

  documentosSidebarIds = idsEnDOM
  guardarDocumentosSidebarIds()
}

function crearItemDocumentoSidebar(doc, sidebar) {
  const item = document.createElement("div")
  item.className = "sidebarItem sidebarItemDocumento"
  item.draggable = true
  item.dataset.documentoId = doc.id

  const nombre = document.createElement("span")
  nombre.className = "sidebarItemDocumentoNombre"
  nombre.textContent = doc.nombre || "Documento"
  nombre.title = doc.nombre || "Documento"

  const extension = document.createElement("small")
  extension.className = "sidebarItemDocumentoTipo"
  extension.textContent = doc.extension ? doc.extension.toUpperCase() : "Archivo"

  item.appendChild(nombre)
  item.appendChild(extension)

  const docActualEnPreview = document.getElementById("visorDocumentos")?.dataset.docActual || ""
  if (doc.id === documentoSeleccionadoEnCarpetaId || doc.id === docActualEnPreview) {
    item.classList.add("is-selected")
  }

  item.addEventListener("click", () => {
    documentoSeleccionadoEnCarpetaId = doc.id
    sidebar
      ?.querySelectorAll(".sidebarItemDocumento.is-selected")
      .forEach(nodo => nodo.classList.remove("is-selected"))
    item.classList.add("is-selected")
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
    item.classList.remove("documento-arrastrando")
    documentoArrastradoId = null
    document
      .querySelectorAll(".carpetaDocumentos, .sidebarDocumentosLista")
      .forEach(z => z.classList.remove("drop-activa"))
  })

  return item
}

function activarArrastreMateria(item, lista, normativa) {
  item.draggable = true

  item.addEventListener("dragstart", e => {
    materiaArrastrada = item.dataset.materia
    materiaArrastradaNormativa = normativa
    materiaArrastradaCarpetaId = item.dataset.carpetaId || null
    materiaDropProcesado = false
    item.classList.add("arrastrando")
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", materiaArrastrada)
    }
  })

  item.addEventListener("dragend", () => {
    item.classList.remove("arrastrando")
    if (!materiaDropProcesado) {
      aplicarOrdenMateriasDesdeDOM(item.parentElement)
      limpiarEstadoArrastreMateria()
    }
  })
}

function limpiarEstadoArrastreMateria() {
  document
    .querySelectorAll(".sidebarGroupList")
    .forEach(l => l.classList.remove("drop-activa", "carpetaLista-drop"))
  materiaArrastrada = null
  materiaArrastradaNormativa = null
  materiaArrastradaCarpetaId = null
}

function activarArrastreArticulo(box, normativa, materia) {
  box.draggable = true

  const bloquearSiEditable = e => {
    if (esCampoEditable(e.target)) {
      box.draggable = false
    } else {
      box.draggable = true
    }
  }

  const restaurarArrastre = () => {
    if (!box.draggable) box.draggable = true
  }

  box.addEventListener("mousedown", bloquearSiEditable)
  box.addEventListener("touchstart", bloquearSiEditable)
  box.addEventListener("mouseup", restaurarArrastre)
  box.addEventListener("mouseleave", restaurarArrastre)
  box.addEventListener("touchend", restaurarArrastre)
  box.addEventListener("touchcancel", restaurarArrastre)

  box.addEventListener("dragstart", e => {
    if (esCampoEditable(e.target)) {
      box.draggable = false
      setTimeout(() => {
        box.draggable = true
      }, 0)
      e.preventDefault()
      return
    }

    articuloArrastradoId = box.dataset.id
    materiaArrastrada = materia
    materiaArrastradaNormativa = normativa
    materiaArrastradaCarpetaId = materiaEnCarpeta(normativa, materia)
    materiaDropProcesado = false

    box.classList.add("arrastrando")
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", box.dataset.id)
    }
  })

  box.addEventListener("dragenter", () => {
    if (box.dataset.id === articuloArrastradoId) return
    box.classList.add("drag-over")
  })

  box.addEventListener("dragleave", () => {
    box.classList.remove("drag-over")
  })

  box.addEventListener("dragover", e => {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move"

    const objetivo = e.currentTarget
    if (!articuloArrastradoId || objetivo.dataset.id === articuloArrastradoId) return
  })

  box.addEventListener("drop", e => {
    e.preventDefault()
    box.classList.remove("drag-over")
  })

  box.addEventListener("dragend", () => {
    box.classList.remove("arrastrando")
    box.classList.remove("drag-over")
    const contenedor = box.parentElement
    aplicarOrdenDesdeDOM(contenedor, normativa, materia)
    articuloArrastradoId = null
    if (!materiaDropProcesado) limpiarEstadoArrastreMateria()
  })
}

document.addEventListener(
  "wheel",
  e => {
    if (!e.ctrlKey) return
    if (window.mallaZoomApi?.handleWheel?.(e)) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    aplicarZoom(zoomActual + delta)
  },
  { passive: false }
)

document.addEventListener("keydown", e => {
  if (window.mallaZoomApi?.handleKeydown?.(e)) return
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl) return

  if (e.key === "+" || e.key === "=") {
    e.preventDefault()
    aplicarZoom(zoomActual + ZOOM_STEP)
  } else if (e.key === "-" || e.key === "_") {
    e.preventDefault()
    aplicarZoom(zoomActual - ZOOM_STEP)
  } else if (e.key === "0") {
    e.preventDefault()
    aplicarZoom(1)
  }
})

if (appRoot) {
  appRoot.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      pinchStartDistance = distanciaEntreToques(e.touches)
      pinchStartZoom = zoomActual
    }
  })

  appRoot.addEventListener(
    "touchmove",
    e => {
      if (e.touches.length === 2 && pinchStartDistance) {
        e.preventDefault()
        const nuevaDistancia = distanciaEntreToques(e.touches)
        const factor = pinchStartDistance ? nuevaDistancia / pinchStartDistance : 1
        aplicarZoom(pinchStartZoom * factor)
      }
    },
    { passive: false }
  )

  const limpiarPinch = e => {
    if (e.touches && e.touches.length >= 2) return
    pinchStartDistance = null
    pinchStartZoom = zoomActual
  }

  appRoot.addEventListener("touchend", limpiarPinch)
  appRoot.addEventListener("touchcancel", limpiarPinch)
}

aplicarZoom(zoomActual)

function abrirModalConfiguracion() {
  if (!modalConfiguracion) return
  modalConfiguracion.classList.add("visible")
  const primerBoton = modalConfiguracion.querySelector("button")
  primerBoton?.focus()
}

function cerrarModalConfiguracion() {
  if (!modalConfiguracion) return
  modalConfiguracion.classList.remove("visible")
}

function cargarNormativa() {
  sincronizarEdiciones()

  const val = document.getElementById("normativa").value
  const archivoMap = {
    civil: "codigo_civil_pdf.json",
    penal: "codigo_penal_pdf.json",
    procedimiento: "codigo_procedimiento_civil_pdf.json"
  }
  const archivo = archivoMap[val] || archivoMap.civil

  fetch(archivo)
    .then(r => r.json())
    .then(d => {
      codigoActual = d
      ordenarYMostrar()
    })
    .catch(() => mostrarError("No se pudo cargar el archivo"))
}

cargarNormativa()
document.getElementById("normativa").addEventListener("change", cargarNormativa)

function mostrarError(msg) {
  const box = document.getElementById("errorBox")
  box.textContent = msg
  box.style.display = "block"
}

function obtenerColorMateria(nombre) {
  const art = articulos.find(a => a.materia === nombre && a.color)
  return art ? art.color : "#1e3a8a"
}

// Mapea cada normativa a su archivo JSON correspondiente
function rutaDocumentoPara(normativa) {
  const mapa = {
    civil: "/docs/codigo_civil.json",
    penal: "/docs/codigo_penal.json",
    procedimiento: "/docs/codigo_de_procedimiento_civil.json"
  }
  return mapa[normativa] || mapa.civil
}

// Reemplaza cargas específicas por una función genérica
async function cargarDocumentoNormativa(normativa, opciones = {}) {
  const ruta = rutaDocumentoPara(normativa)
  try {
    const res = await fetch(ruta)
    if (!res.ok) throw new Error("Error al cargar " + ruta + " : " + res.status)
    const datos = await res.json()
    return datos
  } catch (err) {
    console.error(err)
    mostrarError && mostrarError("No se pudo cargar el documento: " + err.message)
    return null
  }
}

function agregarArticulo() {
  const num = parseInt(document.getElementById("numeroArticulo").value)
  const mat = document.getElementById("materiaArticulo").value.trim()

  document.getElementById("errorBox").style.display = "none"

  if (!num || !mat) return mostrarError("Debe ingresar número y materia")

  const cont = codigoActual[num]
  if (!cont) return mostrarError("Ese artículo no existe en la base")

  const norm = document.getElementById("normativa").value

  asegurarOrdenMateria(norm, mat)

  articulos.push({
    id: Date.now(),
    numero: num,
    materia: mat,
    contenido: cont,
    contenidoEditado: null,
    contenidoHTML: null,
    normativa: norm,
    nota: "",
    color: obtenerColorMateria(mat),
    tituloPersonalizado: "",
    orden: siguienteOrdenPara(norm, mat)
  })

  normativaSeleccionada = norm
  materiaSeleccionada = mat

  guardarLocal()
  ordenarYMostrar()

  document.getElementById("numeroArticulo").value = ""
  document.getElementById("materiaArticulo").value = ""
  document.getElementById("numeroArticulo").focus()

  // Antes: fetch("/docs/codigo_penal.json")  (o llamada fija a penal)
  // Ahora: usar la ruta según la normativa seleccionada
  (async () => {
    const norma = normativaSeleccionada || "civil"
    const datos = await cargarDocumentoNormativa(norma)
    if (datos) {
      // ejemplo: buscar plantilla por número o por id según la estructura del JSON
      // const plantilla = datos.find(d => d.numero === numeroBuscado) || datos[0]
      // usar plantilla para llenar el nuevo artículo
    }
  })()
}

// ...existing code...
function ordenarYMostrar() {
  sincronizarEdiciones()

  const sidebar = document.getElementById("sidebarMaterias")
  const contenedorArticulos = document.getElementById("contenidoArticulos")

  sidebar.innerHTML = ""
  contenedorArticulos.innerHTML = ""

  const accionesSidebar = document.createElement("div")
  accionesSidebar.className = "sidebarAcciones"
  const tituloSidebar = document.createElement("div")
  tituloSidebar.className = "sidebarAccionesTitulo"
  tituloSidebar.textContent = "Organiza tus materias"
  const nuevaCarpetaBtn = document.createElement("button")
  nuevaCarpetaBtn.className = "btn-carpeta"
  nuevaCarpetaBtn.type = "button"
  nuevaCarpetaBtn.textContent = "Nueva carpeta"
  accionesSidebar.appendChild(tituloSidebar)
  accionesSidebar.appendChild(nuevaCarpetaBtn)
  sidebar.appendChild(accionesSidebar)

  const seccionCarpetas = document.createElement("div")
  seccionCarpetas.className = "carpetasSection"
  const tituloCarpetas = document.createElement("div")
  tituloCarpetas.className = "sidebarGroupTitle"
  tituloCarpetas.textContent = "Carpetas"
  const listaCarpetas = document.createElement("div")
  listaCarpetas.className = "carpetasLista"
  seccionCarpetas.appendChild(tituloCarpetas)
  seccionCarpetas.appendChild(listaCarpetas)
  sidebar.appendChild(seccionCarpetas)
  nuevaCarpetaBtn.addEventListener("click", () => insertarEditorCarpeta(listaCarpetas))

  const agrupado = { civil: {}, penal: {} }

  articulos.forEach(a => {
    if (!agrupado[a.normativa]) agrupado[a.normativa] = {}
    if (!agrupado[a.normativa][a.materia]) agrupado[a.normativa][a.materia] = []
    agrupado[a.normativa][a.materia].push(a)
  })

  const combos = []
  let tieneSeleccionValida = false

  carpetas.forEach(carpeta => {
    (carpeta.materias || []).forEach(({ normativa, materia }) => {
      if (!agrupado[normativa]?.[materia]) return
      if (!combos.some(c => c.normativa === normativa && c.materia === materia)) {
        combos.push({ normativa, materia, items: agrupado[normativa][materia] })
      }
      if (normativaSeleccionada === normativa && materiaSeleccionada === materia) {
        tieneSeleccionValida = true
      }
    })
  })

  renderizarCarpetasSidebar(listaCarpetas, agrupado, sidebar)

  const seccionDocumentos = document.createElement("div")
  seccionDocumentos.className = "sidebarGroup sidebarGroupDocumentos"

  const tituloDocumentos = document.createElement("div")
  tituloDocumentos.className = "sidebarGroupTitle"
  tituloDocumentos.textContent = "Documentos"
  seccionDocumentos.appendChild(tituloDocumentos)

  const listaDocumentosSidebar = document.createElement("div")
  listaDocumentosSidebar.className = "sidebarGroupList sidebarDocumentosLista"
  prepararListaDocumentosSidebar(listaDocumentosSidebar)

  const documentosFueraDeCarpeta = documentosCargados.filter(doc => !carpetaDeDocumento(doc.id))
  const disponiblesPorId = new Map(documentosFueraDeCarpeta.map(doc => [doc.id, doc]))
  documentosSidebarIds = documentosSidebarIds.filter(id => disponiblesPorId.has(id))
  guardarDocumentosSidebarIds()
  const documentosSidebar = documentosSidebarIds
    .map(id => disponiblesPorId.get(id))
    .filter(Boolean)

  if (!documentosSidebar.length) {
    const aviso = document.createElement("div")
    aviso.className = "carpetaVacia"
    aviso.textContent = "Arrastra documentos aquí"
    listaDocumentosSidebar.appendChild(aviso)
  } else {
    documentosSidebar.forEach(doc => {
      listaDocumentosSidebar.appendChild(crearItemDocumentoSidebar(doc, sidebar))
    })
  }

  seccionDocumentos.appendChild(listaDocumentosSidebar)
  sidebar.appendChild(seccionDocumentos)

  const ordenNormativas = ["civil", "penal", "procedimiento"]
  ordenNormativas.forEach(norm => {
    const materiasObj = agrupado[norm]
    const nombresMaterias = Object.keys(materiasObj || {})
    if (!nombresMaterias.length) return

    const grupo = document.createElement("div")
    grupo.className = "sidebarGroup sidebarGroupNormativa"

    const tituloGrupo = document.createElement("div")
    tituloGrupo.className = "sidebarGroupTitle"
    tituloGrupo.textContent = norm === "civil" ? "Código Civil" : norm === "penal" ? "Código Penal" : "Código de Procedimiento Civil"
    grupo.appendChild(tituloGrupo)

    const listaMaterias = document.createElement("div")
    listaMaterias.className = "sidebarGroupList"
    listaMaterias.dataset.normativa = norm
    prepararListaMaterias(listaMaterias)
    grupo.appendChild(listaMaterias)

    const nombresOrdenados = ordenarMaterias(nombresMaterias, norm).filter(
      m => !materiaEnCarpeta(norm, m)
    )

    nombresOrdenados.forEach(m => {
      const item = document.createElement("div")
      item.className = "sidebarItem"
      item.textContent = m
      item.dataset.normativa = norm
      item.dataset.materia = m
      item.style.borderLeftColor = obtenerColorMateria(m)

      item.addEventListener("click", () => {
        normativaSeleccionada = norm
        materiaSeleccionada = m
        sidebar.querySelectorAll(".sidebarItem").forEach(i => i.classList.remove("activa"))
        item.classList.add("activa")
        mostrarArticulosDeMateria(norm, m, agrupado[norm][m])
      })

      if (norm === normativaSeleccionada && m === materiaSeleccionada) {
        item.classList.add("activa")
        tieneSeleccionValida = true
      }

      activarArrastreMateria(item, listaMaterias, norm)

      listaMaterias.appendChild(item)
      if (!combos.some(c => c.normativa === norm && c.materia === m)) {
        combos.push({ normativa: norm, materia: m })
      }
    })

    sidebar.appendChild(grupo)
  })

  if (!combos.length) {
    contenedorArticulos.innerHTML = `
      <div class="estado-vacio">
        <h2>No hay materias aún</h2>
        <p>Agrega artículos para crear automáticamente tu primera materia.</p>
      </div>
    `

    return
  }

  if (!tieneSeleccionValida) {
    normativaSeleccionada = combos[0].normativa
    materiaSeleccionada = combos[0].materia
  }

  const activo = sidebar.querySelector(
    `.sidebarItem[data-normativa="${normativaSeleccionada}"][data-materia="${materiaSeleccionada}"]`
  )
  if (activo) activo.classList.add("activa")

  const itemsSeleccionados =
    agrupado[normativaSeleccionada] && agrupado[normativaSeleccionada][materiaSeleccionada]
      ? agrupado[normativaSeleccionada][materiaSeleccionada]
      : []

  mostrarArticulosDeMateria(normativaSeleccionada, materiaSeleccionada, itemsSeleccionados)
  reaplicarBusqueda()
}

function normalizarSemestre(valor) {
  return (valor || "Semestre").trim() || "Semestre"
}

function claveSemestre(valor) {
  return normalizarSemestre(valor).toLocaleLowerCase("es")
}

function valorOrdenSemestre(semestre) {
  const texto = normalizarSemestre(semestre)
  const match = texto.match(/\d+/)
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER
}

function ordenarCarpetasPorSemestre(items) {
  return [...items].sort((a, b) => {
    const ordenA = valorOrdenSemestre(a.semestre)
    const ordenB = valorOrdenSemestre(b.semestre)
    if (ordenA !== ordenB) return ordenA - ordenB
    const semCmp = normalizarSemestre(a.semestre).localeCompare(normalizarSemestre(b.semestre), "es", {
      sensitivity: "base",
      numeric: true
    })
    if (semCmp !== 0) return semCmp
    return (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
  })
}

function configurarSemestreEditableCarpeta(carpeta, semestreEl) {
  if (!semestreEl) return
  semestreEl.setAttribute("contenteditable", "true")
  semestreEl.setAttribute("role", "textbox")
  semestreEl.setAttribute("aria-label", "Editar semestre de carpeta")
  semestreEl.setAttribute("spellcheck", "false")

  const restaurar = valor => {
    semestreEl.textContent = normalizarSemestre(valor)
  }

  let original = normalizarSemestre(carpeta.semestre)

  semestreEl.addEventListener("focus", () => {
    original = normalizarSemestre(semestreEl.textContent || original)
  })

  semestreEl.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault()
      semestreEl.blur()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      restaurar(original)
      semestreEl.blur()
    }
  })

  semestreEl.addEventListener("blur", () => {
    const nuevo = normalizarSemestre(semestreEl.textContent)
    restaurar(nuevo)
    if (nuevo === original) return
    carpetas = carpetas.map(c => (c.id === carpeta.id ? { ...c, semestre: nuevo } : c))
    guardarCarpetas()
    ordenarYMostrar()
  })
}

function renderizarCarpetasSidebar(contenedor, agrupado, sidebar) {
  contenedor.innerHTML = ""

  if (!carpetas.length) {
    const vacio = document.createElement("div")
    vacio.className = "carpetaVacia"
    vacio.textContent = "Crea carpetas y arrastra tus materias aquí"
    contenedor.appendChild(vacio)
    return
  }

  const carpetasOrdenadas = ordenarCarpetasPorSemestre(carpetas)
  const docActualEnPreview = document.getElementById("visorDocumentos")?.dataset.docActual || ""
  const grupos = new Map()

  carpetasOrdenadas.forEach(carpeta => {
    const key = claveSemestre(carpeta.semestre)
    if (!grupos.has(key)) {
      grupos.set(key, {
        semestre: normalizarSemestre(carpeta.semestre),
        items: []
      })
    }
    grupos.get(key).items.push(carpeta)
  })

  Array.from(grupos.values()).forEach(grupo => {
      const grupoEl = document.createElement("div")
      grupoEl.className = "carpetaGrupoSemestre"

    grupo.items.forEach((carpeta, index) => {
      const colorCarpeta = carpeta.color || "#1e3a8a"

      const card = document.createElement("div")
      card.className = "carpetaBox"
      if (index > 0) card.classList.add("carpeta-apilada")
      card.dataset.carpetaId = carpeta.id
      if (carpeta.colapsada) card.classList.add("carpeta-colapsada")
      card.style.setProperty("--carpeta-color", colorCarpeta)
      card.style.borderColor = colorCarpeta
      card.draggable = false

      if (index === 0) {
        const aleta = document.createElement("div")
        aleta.className = "carpetaSemestreAleta"
        const semestreLabel = document.createElement("div")
        semestreLabel.className = "carpetaSemestreTexto"
        semestreLabel.textContent = normalizarSemestre(carpeta.semestre)
        configurarSemestreEditableCarpeta(carpeta, semestreLabel)

        aleta.appendChild(semestreLabel)
        card.appendChild(aleta)
      }

      const header = document.createElement("div")
      header.className = "carpetaHeader"
      header.draggable = false

      const tituloWrap = document.createElement("div")
      tituloWrap.className = "carpetaTituloWrap"

      const toggleBtn = document.createElement("button")
      toggleBtn.className = "carpetaToggle"
      toggleBtn.type = "button"
      toggleBtn.setAttribute("aria-expanded", carpeta.colapsada ? "false" : "true")
      toggleBtn.setAttribute(
        "aria-label",
        carpeta.colapsada ? "Expandir carpeta" : "Colapsar carpeta"
      )

      const toggleIcon = document.createElement("span")
      toggleIcon.className = "carpetaToggleIcon"
      toggleIcon.textContent = "▾"
      toggleBtn.appendChild(toggleIcon)
      if (carpeta.colapsada) toggleBtn.classList.add("colapsada")
      toggleBtn.addEventListener("click", () => toggleCarpetaColapsada(carpeta.id))
      toggleBtn.style.color = colorCarpeta

      const nombreBtn = document.createElement("div")
      nombreBtn.className = "carpetaNombre"
      nombreBtn.textContent = carpeta.nombre || "Carpeta sin título"
      nombreBtn.title = carpeta.nombre || "Carpeta sin título"
      nombreBtn.style.color = colorCarpeta
      configurarNombreEditableCarpeta(carpeta, nombreBtn)

      const acciones = document.createElement("div")
      acciones.className = "carpetaActions"

      const colorInput = document.createElement("input")
      colorInput.type = "color"
      colorInput.className = "carpeta-color-input"
      colorInput.value = colorCarpeta
      colorInput.addEventListener("click", e => e.stopPropagation())
      colorInput.addEventListener("input", () => {
        card.style.setProperty("--carpeta-color", colorInput.value)
        card.style.borderColor = colorInput.value
      })
      colorInput.addEventListener("change", () => {
        const nuevoColor = colorInput.value
        carpetas = carpetas.map(c => (c.id === carpeta.id ? { ...c, color: nuevoColor } : c))
        guardarCarpetas()
        renderizarCarpetasSidebar(contenedor, agrupado, sidebar)
      })

      const eliminarBtn = document.createElement("button")
      eliminarBtn.className = "carpetaEliminar"
      eliminarBtn.type = "button"
      eliminarBtn.textContent = "Borrar"
      eliminarBtn.addEventListener("click", () => eliminarCarpeta(carpeta.id))

      tituloWrap.appendChild(toggleBtn)
      tituloWrap.appendChild(nombreBtn)

      acciones.appendChild(colorInput)
      acciones.appendChild(eliminarBtn)

      header.appendChild(tituloWrap)
      header.appendChild(acciones)
      card.appendChild(header)

      const lista = document.createElement("div")
      lista.className = "sidebarGroupList carpetaLista"
      lista.dataset.carpetaId = carpeta.id
      lista.hidden = Boolean(carpeta.colapsada)

      const materiasDisponibles = (carpeta.materias || []).filter(m =>
        agrupado[m.normativa]?.[m.materia]
      )

      prepararListaMaterias(lista)

      if (!materiasDisponibles.length) {
        const aviso = document.createElement("div")
        aviso.className = "carpetaVacia"
        aviso.textContent = "Arrastra materias aquí"
        lista.appendChild(aviso)
      } else {
        materiasDisponibles.forEach(({ normativa, materia }) => {
          const item = document.createElement("div")
          item.className = "sidebarItem sidebarItemCarpeta"
          item.textContent = materia
          item.dataset.normativa = normativa
          item.dataset.materia = materia
          item.dataset.carpetaId = carpeta.id
          item.style.borderLeftColor = obtenerColorMateria(materia)

          if (normativaSeleccionada === normativa && materiaSeleccionada === materia) {
            item.classList.add("activa")
          }

          item.addEventListener("click", () => {
            normativaSeleccionada = normativa
            materiaSeleccionada = materia
            sidebar.querySelectorAll(".sidebarItem").forEach(i => i.classList.remove("activa"))
            item.classList.add("activa")
            mostrarArticulosDeMateria(normativa, materia, agrupado[normativa][materia])
          })

          activarArrastreMateria(item, lista, normativa)
          lista.appendChild(item)
        })
      }

      card.appendChild(lista)

      const documentosTitulo = document.createElement("div")
      documentosTitulo.className = "carpetaDocumentosTitulo"
      documentosTitulo.textContent = "Documentos"

      const zonaDocumentos = document.createElement("div")
      zonaDocumentos.className = "carpetaDocumentos"
      zonaDocumentos.dataset.carpetaId = carpeta.id
      prepararZonaDocumentosCarpeta(zonaDocumentos, carpeta.id)

      const documentosEnCarpeta = (carpeta.documentos || [])
        .map(id => documentosCargados.find(d => d.id === id) || carpeta.documentosData?.[id])
        .filter(Boolean)

      if (!documentosEnCarpeta.length) {
        const avisoDocs = document.createElement("div")
        avisoDocs.className = "carpetaDocumentosVacio"
        avisoDocs.textContent = "Arrastra documentos aquí"
        zonaDocumentos.appendChild(avisoDocs)
      } else {
        const listaDocs = document.createElement("div")
        listaDocs.className = "carpetaDocumentosLista"

        documentosEnCarpeta.forEach(doc => {
          listaDocs.appendChild(crearItemDocumentoSidebar(doc, sidebar))
        })

        zonaDocumentos.appendChild(listaDocs)
      }

      card.appendChild(documentosTitulo)
      card.appendChild(zonaDocumentos)
      grupoEl.appendChild(card)
    })

      contenedor.appendChild(grupoEl)
  })
}

function mostrarArticulosDeMateria(normativa, materia, items) {
  sincronizarEdiciones()

  const contenedor = document.getElementById("contenidoArticulos")
  contenedor.innerHTML = ""

  const wrap = document.createElement("div")
  wrap.className = "materia-wrap"

  const tituloM = document.createElement("div")
  tituloM.className = "materia-title"
  tituloM.contentEditable = "true"
  tituloM.textContent = materia
  const colorMateria = obtenerColorMateria(materia)
  tituloM.style.color = colorMateria
  tituloM.style.setProperty("--materia-underline", colorMateria)

  // Nombre actual que se va actualizando en vivo
  let nombreActual = materia

  // Actualización en tiempo real sin perder foco
  tituloM.addEventListener("input", () => {
    const nuevo = tituloM.textContent.trim()
    if (nuevo === "" || nuevo === nombreActual) return

    articulos.forEach(a => {
      if (a.materia === nombreActual && a.normativa === normativa) {
        a.materia = nuevo
      }
    })

    renombrarMateriaEnCarpetas(normativa, nombreActual, nuevo)

    document.querySelectorAll(".sidebarItem").forEach(item => {
      if (item.dataset.materia === nombreActual && item.dataset.normativa === normativa) {
        item.dataset.materia = nuevo
        item.textContent = nuevo
      }
    })

    if (
      materiasOrden[normativa] &&
      typeof materiasOrden[normativa][nombreActual] === "number"
    ) {
      materiasOrden[normativa][nuevo] = materiasOrden[normativa][nombreActual]
      delete materiasOrden[normativa][nombreActual]
      guardarOrdenMaterias()
    }

    nombreActual = nuevo
    materiaSeleccionada = nuevo
    guardarLocal()
  })

  // Al salir del título se reordena todo
  tituloM.addEventListener("blur", () => {
    ordenarYMostrar()
  })

  const controles = document.createElement("div")
  controles.className = "materia-controls"

  const colorInput = document.createElement("input")
  colorInput.type = "color"
  colorInput.className = "materia-color-input"
  colorInput.value = colorMateria

  colorInput.addEventListener("click", e => e.stopPropagation())
  colorInput.addEventListener("pointerdown", e => e.stopImmediatePropagation())

  colorInput.addEventListener("input", () => {
    const nuevoColor = colorInput.value
    tituloM.style.color = nuevoColor
    tituloM.style.setProperty("--materia-underline", nuevoColor)

    const tarjetas = contenedor.querySelectorAll(".articulo")
    tarjetas.forEach(t => {
      if (t.dataset.materia === nombreActual) {
        t.style.borderLeftColor = nuevoColor
        const tituloArt = t.querySelector(".articulo-titulo")
        if (tituloArt) tituloArt.style.color = nuevoColor
      }
    })

    const sidebarItems = document.querySelectorAll(".sidebarItem")
    sidebarItems.forEach(si => {
      if (si.dataset.materia === nombreActual) {
        si.style.borderLeftColor = nuevoColor
      }
    })
  })

  colorInput.addEventListener("change", () => {
    const nuevoColor = colorInput.value
    articulos.forEach(a => {
      if (a.materia === nombreActual && a.normativa === normativa) a.color = nuevoColor
    })
    guardarLocal()
  })

  const borrarMat = document.createElement("button")
  borrarMat.className = "btn-small"
  borrarMat.textContent = "Borrar materia"
  borrarMat.onclick = () => borrarMateria(nombreActual, normativa)

  controles.appendChild(colorInput)
  controles.appendChild(borrarMat)

  wrap.appendChild(tituloM)
  wrap.appendChild(controles)
  contenedor.appendChild(wrap)

  const listaOrdenada = [...items].sort((a, b) => valorOrdenArticulo(a) - valorOrdenArticulo(b))

  listaOrdenada.forEach(a => {
    const box = document.createElement("div")
    box.className = "articulo"
    box.style.borderLeftColor = a.color
    box.dataset.id = a.id
    box.dataset.materia = a.materia

    const titulo = document.createElement("div")
    titulo.className = "articulo-titulo"
    titulo.style.color = a.color

    const tituloEditable = document.createElement("span")
    tituloEditable.className = "articulo-titulo-texto"
    tituloEditable.contentEditable = "true"
    tituloEditable.textContent =
      a.tituloPersonalizado && a.tituloPersonalizado.trim()
        ? a.tituloPersonalizado
        : `Artículo ${a.numero}`

    tituloEditable.addEventListener("click", e => e.stopPropagation())

    tituloEditable.addEventListener("input", () => {
      const nuevo = tituloEditable.textContent.trim()
      a.tituloPersonalizado = nuevo
      guardarLocal()
    })

    tituloEditable.addEventListener("blur", () => {
      if (!tituloEditable.textContent.trim()) {
        a.tituloPersonalizado = ""
        tituloEditable.textContent = `Artículo ${a.numero}`
        guardarLocal()
      }
    })

    const indicador = document.createElement("span")
    indicador.className = "indicador"
    indicador.textContent = "▶"

    titulo.appendChild(tituloEditable)
    titulo.appendChild(indicador)

    const norm = document.createElement("div")
    norm.style.fontSize = "13px"
    norm.style.color = "#6b7280"
    const _etiquetasNormativa = {
      civil: "Normativa Código Civil",
      penal: "Normativa Código Penal",
      procedimiento: "Normativa Código de Procedimiento Civil"
    }
    norm.textContent = _etiquetasNormativa[a.normativa] || a.normativa

    const contenido = document.createElement("div")
    contenido.className = "articulo-contenido"
    contenido.contentEditable = "true"
    const contenidoGuardado =
      a.contenidoHTML ??
      (a.contenidoEditado !== undefined && a.contenidoEditado !== null
        ? escaparComoHTML(a.contenidoEditado)
        : escaparComoHTML(a.contenido))

    contenido.innerHTML = contenidoGuardado

    contenido.addEventListener("input", () => {
      a.contenidoEditado = contenido.textContent
      a.contenidoHTML = contenido.innerHTML
      guardarLocal()
    })

    contenido.addEventListener("click", e => e.stopPropagation())

    const botonNota = document.createElement("button")
    botonNota.className = "btn-note"
    botonNota.textContent = "Agregar nota"
    botonNota.style.display = "none"

    const botonEliminarNota = document.createElement("button")
    botonEliminarNota.className = "btn-note-delete"
    botonEliminarNota.textContent = "Eliminar nota"
    botonEliminarNota.style.display = "none"

    const notaBox = document.createElement("textarea")
    notaBox.className = "nota-box"
    notaBox.value = a.nota || ""

    notaBox.addEventListener("click", e => e.stopPropagation())
    notaBox.addEventListener("input", () => {
      a.nota = notaBox.value
      guardarLocal()
      if (notaBox.value.trim() !== "") {
        botonEliminarNota.style.display = "inline-block"
      }
    })

    const resizer = document.createElement("div")
    resizer.className = "nota-resizer"

    resizer.addEventListener("mousedown", e => {
      e.stopPropagation()
      const startY = e.clientY
      const startHeight = notaBox.offsetHeight

      function mover(ev) {
        const nueva = startHeight + (ev.clientY - startY)
        notaBox.style.height = Math.max(nueva, 70) + "px"
      }

      function stop() {
        window.removeEventListener("mousemove", mover)
        window.removeEventListener("mouseup", stop)
      }

      window.addEventListener("mousemove", mover)
      window.addEventListener("mouseup", stop)
    })

    botonNota.addEventListener("click", e => {
      e.stopPropagation()
      notaBox.style.display = "block"
      resizer.style.display = "block"
      notaBox.focus()
    })

    botonEliminarNota.addEventListener("click", e => {
      e.stopPropagation()
      notaBox.value = ""
      a.nota = ""
      guardarLocal()
      notaBox.style.display = "none"
      resizer.style.display = "none"
      botonEliminarNota.style.display = "none"
    })

    if (a.nota && a.nota.trim() !== "") {
      notaBox.style.display = "block"
      resizer.style.display = "block"
      botonEliminarNota.style.display = "inline-block"
    }

    const botonBorrar = document.createElement("button")
    botonBorrar.className = "btn-small"
    botonBorrar.textContent = "Eliminar artículo"
    botonBorrar.style.marginTop = "16px"
    botonBorrar.addEventListener("click", e => {
      e.stopPropagation()
      borrarArticulo(a.id)
    })

    box.appendChild(titulo)
    box.appendChild(norm)
    box.appendChild(contenido)
    box.appendChild(botonNota)
    box.appendChild(botonEliminarNota)
    box.appendChild(notaBox)
    box.appendChild(resizer)
    box.appendChild(botonBorrar)

    box.addEventListener("click", () => {
      const abierta = box.classList.toggle("abierto")

      if (abierta) {
        botonNota.style.display = "inline-block"
        if (a.nota && a.nota.trim() !== "") {
          notaBox.style.display = "block"
          resizer.style.display = "block"
          botonEliminarNota.style.display = "inline-block"
        }
      } else {
        botonNota.style.display = "none"
        if (!a.nota || a.nota.trim() === "") {
          notaBox.style.display = "none"
          resizer.style.display = "none"
          botonEliminarNota.style.display = "none"
        }
      }
    })

    activarArrastreArticulo(box, normativa, materia)

    contenedor.appendChild(box)
  })
}

function guardarLocal() {
  localStorage.setItem("articulosGuardados", JSON.stringify(articulos))
}

function sincronizarEdiciones() {
  document.querySelectorAll(".articulo").forEach(box => {
    const id = Number(box.dataset.id)
    const articulo = articulos.find(a => a.id === id)
    if (!articulo) return

    const tituloEl = box.querySelector(".articulo-titulo-texto")
    if (tituloEl) articulo.tituloPersonalizado = tituloEl.textContent.trim()

    const contenidoEl = box.querySelector(".articulo-contenido")
    if (contenidoEl) {
      articulo.contenidoEditado = contenidoEl.textContent
      articulo.contenidoHTML = contenidoEl.innerHTML
    }

    const notaEl = box.querySelector(".nota-box")
    if (notaEl) articulo.nota = notaEl.value
  })

  guardarLocal()
}

function borrarArticulo(id) {
  articulos = articulos.filter(a => a.id !== id)
  guardarLocal()
  ordenarYMostrar()
}

function borrarMateria(nombre, normativa = null) {
  articulos = articulos.filter(a => {
    if (normativa) return a.materia !== nombre || a.normativa !== normativa
    return a.materia !== nombre
  })
  if (normativa) {
    removerMateriaDeCarpetas(normativa, nombre)
  } else {
    ["civil", "penal"].forEach(norm => removerMateriaDeCarpetas(norm, nombre))
  }
  if (normativa && materiasOrden[normativa]) {
    delete materiasOrden[normativa][nombre]
    guardarOrdenMaterias()
  }
  guardarLocal()
  normativaSeleccionada = null
  materiaSeleccionada = null
  ordenarYMostrar()
}

function eliminarCarpeta(id) {
  carpetas = carpetas.filter(c => c.id !== id)
  guardarCarpetas()
  ordenarYMostrar()
}

function toggleCarpetaColapsada(id) {
  carpetas = carpetas.map(carpeta =>
    carpeta.id === id ? { ...carpeta, colapsada: !carpeta.colapsada } : carpeta
  )
  guardarCarpetas()
  ordenarYMostrar()
}

// Función para cargar un JSON con artículos del Código de Procedimiento Civil
async function cargarDocumentoProcedimiento(ruta = "/docs/codigo_de_procedimiento_civil.json") {
  try {
    const res = await fetch(ruta)
    if (!res.ok) throw new Error("No se pudo cargar el documento: " + res.status)
    const nuevos = await res.json() // esperar array de artículos { id, numero, materia, normativa: "procedimiento", tituloPersonalizado?, contenido? ... }
    // evitar duplicados por id
    const existentesIds = new Set(articulos.map(a => a.id))
    nuevos.forEach(n => { if (!existentesIds.has(n.id)) articulos.push(n) })
    guardarLocal()
    ordenarYMostrar()
  } catch (err) {
    console.error(err)
    mostrarError("Error cargando el documento de procedimiento: " + err.message)
  }
}

inicializarMenuContextual()
renderDocumentos()
ordenarYMostrar()

window.addEventListener("beforeunload", sincronizarEdiciones)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") sincronizarEdiciones()
})
