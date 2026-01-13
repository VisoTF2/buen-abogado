const buscadorInput = document.getElementById("buscadorInput")

let resultadosBusqueda = []
let indiceResultado = 0
let ultimoTerminoBusqueda = ""
const elementosMarcados = new Set()

function abrirBuscador() {
  const panel = document.getElementById("buscadorFlotante")
  panel.classList.add("activo")
  buscadorInput.focus()
  buscadorInput.select()
  if (ultimoTerminoBusqueda) {
    buscadorInput.value = ultimoTerminoBusqueda
  }
}

function cerrarBuscador() {
  const panel = document.getElementById("buscadorFlotante")
  panel.classList.remove("activo")
  buscadorInput.value = ""
  limpiarResaltadosBusqueda()
}

function limpiarResaltadosBusqueda() {
  resultadosBusqueda = []
  indiceResultado = 0

  elementosMarcados.forEach(el => {
    if (el.dataset.busquedaOriginalHtml !== undefined) {
      el.innerHTML = el.dataset.busquedaOriginalHtml
    } else if (el.isContentEditable) {
      const plano = el.textContent
      el.textContent = plano
    }
    if (el.normalize) el.normalize()
    delete el.dataset.busquedaOriginalHtml
  })
  elementosMarcados.clear()

  document.querySelectorAll(".articulo").forEach(a => {
    a.classList.remove("resaltado-busqueda")
    a.classList.remove("resaltado-busqueda-activo")
  })

  document.querySelectorAll(".resaltado-busqueda-activo").forEach(el =>
    el.classList.remove("resaltado-busqueda-activo")
  )

  if (visorDocumentos?.dataset.docActual) {
    const doc = documentosCargados.find(d => d.id === visorDocumentos.dataset.docActual)
    if (doc) mostrarDocumento(doc.id)
  }
}

function resaltarResultadoActual(mantenerFocoBuscador = false) {
  const habiaFocoEnBuscador = mantenerFocoBuscador || document.activeElement === buscadorInput

  document.querySelectorAll(".resaltado-busqueda-activo").forEach(el =>
    el.classList.remove("resaltado-busqueda-activo")
  )

  document.querySelectorAll(".resaltado-busqueda-marca-activa").forEach(el =>
    el.classList.remove("resaltado-busqueda-marca-activa")
  )

  if (!resultadosBusqueda.length) return

  const actual = resultadosBusqueda[indiceResultado]
  const articulo = actual.articulo

  if (actual.tipo === "documento") {
    const doc = documentosCargados.find(d => d.id === actual.documentoId)
    if (doc) {
      mostrarDocumento(doc.id, ultimoTerminoBusqueda, actual.indiceDocumento)
      const marcaActiva = visorDocumentos?.querySelector(".resaltado-busqueda-activo")
      if (marcaActiva) {
        marcaActiva.scrollIntoView({ behavior: "smooth", block: "center" })
      } else {
        visorDocumentos?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
    return
  }

  if (articulo && !articulo.classList.contains("abierto")) {
    articulo.classList.add("abierto")

    const nota = articulo.querySelector(".nota-box")
    const resizer = articulo.querySelector(".nota-resizer")
    const botonNota = articulo.querySelector(".btn-note")
    const botonEliminarNota = articulo.querySelector(".btn-note-delete")

    if (botonNota) botonNota.style.display = "inline-block"
    if (nota && nota.value.trim() !== "") {
      nota.style.display = "block"
      if (resizer) resizer.style.display = "block"
      if (botonEliminarNota) botonEliminarNota.style.display = "inline-block"
    }
  }

  if (actual.tipo === "nota") {
    actual.nodo.classList.add("resaltado-busqueda-activo")
    actual.nodo.setSelectionRange(actual.inicio, actual.fin)
    actual.nodo.scrollIntoView({ behavior: "smooth", block: "center" })

    if (habiaFocoEnBuscador) {
      buscadorInput.focus({ preventScroll: true })
      const caret = buscadorInput.value.length
      buscadorInput.setSelectionRange(caret, caret)
    }
    return
  }

  if (actual.tipo === "marca" && actual.nodo) {
    actual.nodo.classList.add("resaltado-busqueda-marca-activa")
    if (articulo) articulo.classList.add("resaltado-busqueda-activo")
    const destino = actual.nodo.closest(".articulo") || actual.nodo
    destino.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  if (habiaFocoEnBuscador) {
    buscadorInput.focus({ preventScroll: true })
    const caret = buscadorInput.value.length
    buscadorInput.setSelectionRange(caret, caret)
  }
}

function ejecutarBusqueda(termino) {
  ultimoTerminoBusqueda = termino
  const limpio = termino.trim().toLowerCase()
  const info = document.getElementById("buscadorInfo")

  limpiarResaltadosBusqueda()
  resultadosBusqueda = []
  indiceResultado = 0

  if (!limpio) {
    info.textContent = "Escribe una palabra clave"
    return
  }

  document.querySelectorAll(".articulo").forEach(art => {
    const titulo = art.querySelector(".articulo-titulo-texto") || art.querySelector(".articulo-titulo")
    const contenido = art.querySelector(".articulo-contenido")
    const nota = art.querySelector(".nota-box")

    marcarCoincidencias(titulo, limpio, art)
    marcarCoincidencias(contenido, limpio, art)
    registrarCoincidenciasNota(nota, limpio, art)
  })

  documentosCargados.forEach(doc => registrarCoincidenciasDocumento(doc, limpio))

  if (!resultadosBusqueda.length) {
    info.textContent = "Sin resultados"
    return
  }

  info.textContent = `${resultadosBusqueda.length} resultado(s)`
  resaltarResultadoActual(true)
}

function marcarCoincidencias(elemento, termino, articulo) {
  if (!elemento) return

  const largo = termino.length
  if (!largo) return

  if (elemento.dataset.busquedaOriginalHtml === undefined) {
    elemento.dataset.busquedaOriginalHtml = elemento.innerHTML
    elementosMarcados.add(elemento)
  }

  const nodosTexto = []
  const walker = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT
      if (node.parentElement && node.parentElement.closest(".resaltado-busqueda-marca")) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    }
  })

  let nodo = walker.nextNode()
  while (nodo) {
    nodosTexto.push(nodo)
    nodo = walker.nextNode()
  }

  let hayCoincidencias = false

  nodosTexto.forEach(textNode => {
    const textoOriginal = textNode.textContent
    const textoMin = textoOriginal.toLowerCase()
    let indice = textoMin.indexOf(termino)
    if (indice === -1) return

    hayCoincidencias = true
    const frag = document.createDocumentFragment()
    let ultimoCorte = 0

    while (indice !== -1) {
      if (indice > ultimoCorte) {
        frag.appendChild(document.createTextNode(textoOriginal.slice(ultimoCorte, indice)))
      }

      const marca = document.createElement("span")
      marca.className = "resaltado-busqueda-marca"
      marca.textContent = textoOriginal.slice(indice, indice + largo)
      resultadosBusqueda.push({ tipo: "marca", nodo: marca, articulo })
      frag.appendChild(marca)

      ultimoCorte = indice + largo
      indice = textoMin.indexOf(termino, ultimoCorte)
    }

    if (ultimoCorte < textoOriginal.length) {
      frag.appendChild(document.createTextNode(textoOriginal.slice(ultimoCorte)))
    }

    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(frag, textNode)
    }
  })

  if (hayCoincidencias) articulo.classList.add("resaltado-busqueda")
}

function registrarCoincidenciasNota(nota, termino, articulo) {
  if (!nota) return

  const texto = nota.value.toLowerCase()
  const largo = termino.length
  if (!largo) return

  let pos = texto.indexOf(termino)
  let hayCoincidencias = false

  while (pos !== -1) {
    resultadosBusqueda.push({
      tipo: "nota",
      nodo: nota,
      articulo,
      inicio: pos,
      fin: pos + largo
    })
    hayCoincidencias = true
    pos = texto.indexOf(termino, pos + largo)
  }

  if (hayCoincidencias) articulo.classList.add("resaltado-busqueda")
}

function registrarCoincidenciasDocumento(doc, termino) {
  if (!doc?.texto) return

  const textoMin = doc.texto.toLowerCase()
  const largo = termino.length
  if (!largo) return

  let pos = textoMin.indexOf(termino)
  let coincidencia = 0

  while (pos !== -1) {
    resultadosBusqueda.push({
      tipo: "documento",
      documentoId: doc.id,
      inicio: pos,
      fin: pos + largo,
      indiceDocumento: coincidencia
    })
    coincidencia++
    pos = textoMin.indexOf(termino, pos + largo)
  }
}

function irAlSiguienteResultado(mantenerFocoBuscador = false) {
  if (!resultadosBusqueda.length) return
  indiceResultado = (indiceResultado + 1) % resultadosBusqueda.length
  resaltarResultadoActual(mantenerFocoBuscador)
}

function reaplicarBusqueda() {
  const panel = document.getElementById("buscadorFlotante")
  if (panel.classList.contains("activo") && ultimoTerminoBusqueda.trim() !== "") {
    ejecutarBusqueda(ultimoTerminoBusqueda)
  }
}

window.addEventListener("keydown", e => {
  const isCtrlF = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f"
  const isF3 = e.key === "F3"
  if (isCtrlF || isF3) {
    e.preventDefault()
    abrirBuscador()
  }
})

buscadorInput.addEventListener("input", e => {
  ejecutarBusqueda(e.target.value)
})

buscadorInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault()
    irAlSiguienteResultado(true)
  }
  if (e.key === "Escape") {
    cerrarBuscador()
    cerrarModalConfiguracion()
  }
})