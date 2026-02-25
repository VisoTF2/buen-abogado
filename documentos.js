const DOCUMENTOS_STORAGE_KEY = "documentosSubidos"
const documentoInput = document.getElementById("documentoInput")
const listaDocumentos = document.getElementById("listaDocumentos")
const visorDocumentos = document.getElementById("visorDocumentos")
const botonDocumentos = document.querySelector(".documentos-btn")

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

function restaurarDocumentoDesdeCarpeta(documentoId) {
  if (!documentoId) return false

  const respaldo =
    typeof obtenerDocumentoRespaldoEnCarpetas === "function"
      ? obtenerDocumentoRespaldoEnCarpetas(documentoId)
      : null

  if (!respaldo) return false

  const existente = documentosCargados.find(d => d.id === documentoId)
  const base = {
    id: respaldo.id,
    nombre: respaldo.nombre || "Documento",
    extension: respaldo.extension || "",
    url: respaldo.url || "",
    texto: respaldo.texto || "",
    mensaje: respaldo.mensaje || ""
  }

  const documentoFinal = existente ? { ...existente, ...base } : base
  documentosCargados = [
    documentoFinal,
    ...documentosCargados.filter(d => d.id !== documentoId)
  ]

  guardarDocumentos()
  renderDocumentos()
  mostrarDocumento(documentoId)
  return true
}

function prepararRecepcionDocumentoDesdeCarpetas() {
  const zonas = [listaDocumentos, visorDocumentos].filter(Boolean)
  if (!zonas.length) return

  zonas.forEach(zona => {
    zona.addEventListener("dragover", e => {
      if (!documentoArrastradoId) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
    })

    zona.addEventListener("drop", e => {
      e.preventDefault()
      const id = documentoArrastradoId || e.dataTransfer?.getData("text/plain")
      if (!id) return
      restaurarDocumentoDesdeCarpeta(id)
      documentoArrastradoId = null
      ordenarYMostrar()
    })
  })
}

function cargarDocumentosGuardados() {
  try {
    const guardados = JSON.parse(localStorage.getItem(DOCUMENTOS_STORAGE_KEY) || "[]")
    if (!Array.isArray(guardados)) return []

    return guardados.map(doc => ({
      id: doc.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      nombre: doc.nombre || "Documento",
      extension: doc.extension || "",
      url: doc.url || doc.dataUrl || "",
      texto: doc.texto || "",
      mensaje: doc.mensaje || ""
    }))
  } catch (e) {
    console.error("No se pudieron leer los documentos guardados", e)
    return []
  }
}

function guardarDocumentos() {
  localStorage.setItem(DOCUMENTOS_STORAGE_KEY, JSON.stringify(documentosCargados))
}

function obtenerExtension(nombre = "") {
  const partes = nombre.split(".")
  return partes.length > 1 ? partes.pop().toLowerCase() : ""
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
  const extension = obtenerExtension(archivo.name)
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const base = {
    id,
    nombre: archivo.name,
    extension,
    url: "",
    texto: "",
    mensaje: ""
  }

  try {
    const dataUrl = await leerArchivoComoDataUrl(archivo)
    base.url = dataUrl

    if (extension === "pdf") {
      base.texto = await extraerTextoPdf(archivo)
    } else if (extension === "docx") {
      base.texto = await extraerTextoDocx(archivo)
    } else if (extension === "doc") {
      base.mensaje = "Vista previa limitada: descárgalo para abrirlo."
    } else {
      base.mensaje = "Formato no soportado para vista previa."
    }

    documentosCargados = [base, ...documentosCargados.filter(d => d.nombre !== base.nombre)]
    guardarDocumentos()
    renderDocumentos()
    mostrarDocumento(base.id)
  } catch (err) {
    console.error("No se pudo procesar el documento", err)
    base.mensaje = "No se pudo leer el documento."
    documentosCargados = [base, ...documentosCargados]
    guardarDocumentos()
    renderDocumentos()
    mostrarDocumento(base.id)
  }
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

  if (!documentosCargados.length) {
    const vacio = document.createElement("div")
    vacio.className = "documentos-vacio"
    vacio.textContent = "Aún no hay documentos cargados."
    listaDocumentos.appendChild(vacio)
    return
  }

  documentosCargados.forEach(doc => {
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
    nombreTexto.tabIndex = 0
    nombreTexto.setAttribute("role", "button")
    nombreTexto.setAttribute("aria-label", "Editar nombre del documento")
    nombreTexto.addEventListener("mousedown", e => e.stopPropagation())

    const activarEdicion = () => {
      if (nombreWrap.querySelector(".documento-nombre-input")) return
      const nombreOriginal = doc.nombre

      const input = document.createElement("input")
      input.type = "text"
      input.className = "documento-nombre-input"
      input.value = doc.nombre
      input.placeholder = "Nombre del documento"

      const restaurarTexto = () => {
        const docActual = documentosCargados.find(d => d.id === doc.id)
        nombreTexto.textContent = docActual?.nombre || "Documento"
        nombreTexto.title = docActual?.nombre || "Documento"
        nombreWrap.replaceChildren(nombreTexto)
      }

      input.addEventListener("input", () => actualizarNombreDocumento(doc.id, input.value))
      input.addEventListener("blur", () => {
        normalizarNombreDocumento(doc.id, input)
        restaurarTexto()
      })
      input.addEventListener("mousedown", e => e.stopPropagation())
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

      nombreWrap.replaceChildren(input)
      requestAnimationFrame(() => {
        input.focus()
        input.select()
      })
    }

    nombreTexto.addEventListener("click", activarEdicion)
    nombreTexto.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        activarEdicion()
      }
    })

    nombreWrap.appendChild(nombreTexto)

    const tipo = document.createElement("div")
    tipo.innerHTML = `<small>${doc.extension ? doc.extension.toUpperCase() : "Archivo"}</small>`

    info.appendChild(nombreWrap)
    info.appendChild(tipo)

    const acciones = document.createElement("div")
    acciones.className = "documento-acciones"

    const ver = document.createElement("button")
    ver.className = "documento-ver"
    ver.type = "button"
    ver.textContent = "Ver"
    ver.addEventListener("click", () => alternarDocumento(doc.id))

    const eliminar = document.createElement("button")
    eliminar.className = "documento-eliminar"
    eliminar.type = "button"
    eliminar.textContent = "Eliminar"
    eliminar.addEventListener("click", () => eliminarDocumento(doc.id))

    acciones.appendChild(ver)
    acciones.appendChild(eliminar)

    item.appendChild(info)
    item.appendChild(acciones)
    item.addEventListener("dragstart", e => {
      documentoArrastradoId = doc.id
      item.classList.add("documento-arrastrando")
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", doc.nombre)
      }
    })
    item.addEventListener("dragend", () => {
      documentoArrastradoId = null
      item.classList.remove("documento-arrastrando")
      document
        .querySelectorAll(".carpetaDocumentos")
        .forEach(z => z.classList.remove("drop-activa"))
    })
    listaDocumentos.appendChild(item)
  })

  actualizarBotonesVer()
}

function eliminarDocumento(id) {
  const doc = documentosCargados.find(d => d.id === id)
  documentosCargados = documentosCargados.filter(d => d.id !== id)

  const cambioCarpeta = removerDocumentoDeCarpetas(id)

  if (doc?.url) {
    try { URL.revokeObjectURL(doc.url) } catch (e) { /* noop */ }
  }

  guardarDocumentos()
  renderDocumentos()
  if (cambioCarpeta) ordenarYMostrar()

  const vistaActualId = visorDocumentos?.dataset.docActual
  if (doc && vistaActualId === doc.id) {
    mostrarDocumento(documentosCargados[0]?.id)
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

  if ((doc.extension === "pdf" || doc.extension === "docx") && doc.texto) {
    const texto = document.createElement("div")
    texto.className = "documento-texto"
    aplicarResaltadoEnTexto(doc.texto, texto, terminoBusqueda, indiceCoincidencia)
    visorDocumentos.appendChild(texto)
  } else if (doc.extension === "pdf" && doc.url) {
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
    descarga.download = doc.nombre
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
  encabezado.appendChild(titulo)

  if (doc) {
    const cerrar = document.createElement("button")
    cerrar.type = "button"
    cerrar.className = "documento-preview-cerrar"
    cerrar.textContent = "✕"
    cerrar.setAttribute("aria-label", "Cerrar vista previa")
    cerrar.addEventListener("click", cerrarVistaDocumento)
    encabezado.appendChild(cerrar)
  }

  return encabezado
}

function cerrarVistaDocumento() {
  if (!visorDocumentos) return

  visorDocumentos.dataset.docActual = ""
  visorDocumentos.innerHTML = ""
  visorDocumentos.appendChild(construirEncabezadoVista(null))

  const vacio = document.createElement("div")
  vacio.className = "documentos-vacio"
  vacio.textContent = "Selecciona un documento para verlo aquí mismo."
  visorDocumentos.appendChild(vacio)

  actualizarBotonesVer()
}

function alternarDocumento(id) {
  if (visorDocumentos?.dataset.docActual === id) {
    cerrarVistaDocumento()
  } else {
    mostrarDocumento(id)
  }
}

function actualizarBotonesVer() {
  const actual = visorDocumentos?.dataset.docActual || ""

  document.querySelectorAll(".documento-ver").forEach(btn => {
    const item = btn.closest(".documento-item")
    const id = item?.dataset.documentoId

    if (id && id === actual) {
      btn.textContent = "Cerrar"
      btn.setAttribute("aria-pressed", "true")
    } else {
      btn.textContent = "Ver"
      btn.setAttribute("aria-pressed", "false")
    }
  })
}

function actualizarNombreDocumento(id, nuevoNombre) {
  const doc = documentosCargados.find(d => d.id === id)
  if (!doc) return

  doc.nombre = nuevoNombre
  guardarDocumentos()
  actualizarNombreDocumentoEnCarpetas(id, nuevoNombre)

  if (visorDocumentos?.dataset.docActual === id) {
    const titulo = visorDocumentos.querySelector(".documento-preview-titulo")
    if (titulo) titulo.textContent = nuevoNombre || "Vista previa"
    const descarga = visorDocumentos.querySelector(".documento-descarga")
    if (descarga) descarga.download = nuevoNombre
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