const MODO_OSCURO_STORAGE_KEY = "modoOscuroActivo"
const appBanner = document.getElementById("appBanner")
const bannerInput = document.getElementById("bannerInput")
const BANNER_STORAGE_KEY = "bannerImagenApp"
const BANNER_FILL_ENABLED_KEY = "bannerColorFondoActivo"
const bannerFillToggle = document.getElementById("bannerFillToggle")
const fondoInput = document.getElementById("fondoInput")
const FONDO_STORAGE_KEY = "fondoImagenApp"
const accentColorInput = document.getElementById("accentColorInput")
const accentApplyDarkToggle = document.getElementById("accentApplyDarkToggle")
const ACCENT_COLOR_STORAGE_KEY = "colorAcentoApp"
const ACCENT_COLOR_APPLY_DARK_KEY = "colorAcentoModoOscuro"
const mallaInput = document.getElementById("mallaInput")
const mallaToggle = document.getElementById("mallaToggle")
const MALLA_STORAGE_KEY = "mallaImagenHorario"
const MALLA_BASE_KEY = "mallaImagenBaseHorario"
const MALLA_OVERLAY_KEY = "mallaOverlayHorario"
const MALLA_ENABLED_KEY = "mallaActivaHorario"
const MALLA_SIZE_KEY = "mallaSizeHorario"
const MALLA_MIN_WIDTH = 220
const MALLA_MAX_WIDTH = 700
const MALLA_DEFAULT_WIDTH = 320
const MALLA_RESIZE_SENSITIVITY = 0.45
const scheduleMallaImage = document.getElementById("scheduleMallaImage")
const scheduleMallaPlaceholder = document.getElementById("scheduleMallaPlaceholder")
const mallaPreviewBackdrop = document.getElementById("mallaPreviewBackdrop")
const mallaPreviewBody = document.getElementById("mallaPreviewBody")
const mallaPreviewZoomArea = document.getElementById("mallaPreviewZoomArea")
const mallaPreviewImage = document.getElementById("mallaPreviewImage")
const mallaPreviewClose = document.getElementById("mallaPreviewClose")
const mallaPreviewCanvasWrap = document.getElementById("mallaPreviewCanvasWrap")
const mallaPreviewCanvas = document.getElementById("mallaPreviewCanvas")
const mallaDrawToggle = document.getElementById("mallaDrawToggle")
const mallaEraseToggle = document.getElementById("mallaEraseToggle")
const mallaClearLines = document.getElementById("mallaClearLines")
const mallaSaveLines = document.getElementById("mallaSaveLines")
const mallaPreviewEdit = document.getElementById("mallaPreviewEdit")
const mallaPreviewRemove = document.getElementById("mallaPreviewRemove")
const mallaResizeHandle = document.getElementById("mallaResizeHandle")
const mallaZoomIn = document.getElementById("mallaZoomIn")
const mallaZoomOut = document.getElementById("mallaZoomOut")
const MALLA_ZOOM_STEP = 0.05
const MALLA_MIN_ZOOM = 1
const MALLA_MAX_ZOOM = 2.5
let mallaDrawActive = false
let mallaIsDrawing = false
let mallaEraseActive = false
let mallaZoomScale = 1
let mallaZoomBaseSize = null
let mallaZoomFocus = false
let mallaPanActivo = false
let mallaPanPointerId = null
let mallaPanStartX = 0
let mallaPanStartY = 0
let mallaPanScrollLeft = 0
let mallaPanScrollTop = 0

function asegurarMallaPreviewEnBody() {
  if (!mallaPreviewBackdrop) return
  if (mallaPreviewBackdrop.parentElement === document.body) return
  document.body.appendChild(mallaPreviewBackdrop)
}

function aplicarModoGuardado() {
  if (localStorage.getItem(MODO_OSCURO_STORAGE_KEY) === "true") {
    document.body.classList.add("oscuro")
  }
}

function clampColorByte(value) {
  return Math.max(0, Math.min(255, value))
}

function normalizarHexColor(hex) {
  if (typeof hex !== "string") return ""
  const limpio = hex.trim().replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return ""
  return `#${limpio.toLowerCase()}`
}

function aclararColor(hex, factor = 0.24) {
  const normalizado = normalizarHexColor(hex)
  if (!normalizado) return "#3b5ccc"
  const r = parseInt(normalizado.slice(1, 3), 16)
  const g = parseInt(normalizado.slice(3, 5), 16)
  const b = parseInt(normalizado.slice(5, 7), 16)
  const blend = canal => Math.round(canal + (255 - canal) * factor)
  const resultado = [blend(r), blend(g), blend(b)]
    .map(canal => clampColorByte(canal).toString(16).padStart(2, "0"))
    .join("")
  return `#${resultado}`
}

function aplicarColorAcento(hex, incluirModoOscuro = false) {
  const color = normalizarHexColor(hex)
  if (!color) return
  const colorClaro = aclararColor(color)
  document.documentElement.style.setProperty("--accent", color)
  document.documentElement.style.setProperty("--accent-light", colorClaro)

  if (incluirModoOscuro) {
    document.body.style.setProperty("--accent", color)
    document.body.style.setProperty("--accent-light", colorClaro)
  } else {
    document.body.style.removeProperty("--accent")
    document.body.style.removeProperty("--accent-light")
  }

  if (accentColorInput) accentColorInput.value = color
}

function aplicarColorAcentoGuardado() {
  const colorGuardado = normalizarHexColor(localStorage.getItem(ACCENT_COLOR_STORAGE_KEY) || "")
  const incluirModoOscuro = localStorage.getItem(ACCENT_COLOR_APPLY_DARK_KEY) === "true"

  if (accentApplyDarkToggle) accentApplyDarkToggle.checked = incluirModoOscuro

  if (!colorGuardado) {
    document.documentElement.style.removeProperty("--accent")
    document.documentElement.style.removeProperty("--accent-light")
    document.body.style.removeProperty("--accent")
    document.body.style.removeProperty("--accent-light")
    if (accentColorInput) accentColorInput.value = "#1e3a8a"
    return
  }

  aplicarColorAcento(colorGuardado, incluirModoOscuro)
}

function restablecerColorAcento() {
  localStorage.removeItem(ACCENT_COLOR_STORAGE_KEY)
  aplicarColorAcentoGuardado()
}

function abrirSelectorBanner() {
  bannerInput?.click()
}

function aplicarBanner(src) {
  if (!appBanner) return

  if (src) {
    appBanner.style.backgroundImage =
      `linear-gradient(rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0.28)), url(${src})`
    appBanner.classList.add("banner-con-imagen")
  } else {
    appBanner.style.backgroundImage = ""
    appBanner.classList.remove("banner-con-imagen")
  }
}

function aplicarFondoBannerActivo(activo) {
  document.body.classList.toggle("banner-sin-fondo", !activo)
  if (bannerFillToggle) bannerFillToggle.checked = activo
}

function restablecerBanner() {
  aplicarBanner("")
  localStorage.removeItem(BANNER_STORAGE_KEY)
  if (bannerInput) bannerInput.value = ""
}

bannerInput?.addEventListener("change", e => {
  const archivo = e.target.files?.[0]
  if (!archivo) return

  const lector = new FileReader()
  lector.onload = () => {
    const dataUrl = lector.result
    if (typeof dataUrl === "string") {
      aplicarBanner(dataUrl)
      localStorage.setItem(BANNER_STORAGE_KEY, dataUrl)
    }
  }
  lector.readAsDataURL(archivo)
  e.target.value = ""
})

bannerFillToggle?.addEventListener("change", () => {
  const activo = bannerFillToggle.checked
  aplicarFondoBannerActivo(activo)
  localStorage.setItem(BANNER_FILL_ENABLED_KEY, String(activo))
})

function abrirSelectorFondo() {
  fondoInput?.click()
}

function aplicarFondo(src) {
  if (!document.body) return

  if (src) {
    document.body.style.backgroundImage = `url(${src})`
    document.body.style.backgroundSize = "cover"
    document.body.style.backgroundRepeat = "no-repeat"
    document.body.style.backgroundAttachment = "fixed"
    document.body.style.backgroundPosition = "center"
    document.body.classList.add("fondo-personalizado")
  } else {
    document.body.style.backgroundImage = ""
    document.body.style.backgroundSize = ""
    document.body.style.backgroundRepeat = ""
    document.body.style.backgroundAttachment = ""
    document.body.style.backgroundPosition = ""
    document.body.classList.remove("fondo-personalizado")
  }
}

function restablecerFondo() {
  aplicarFondo("")
  localStorage.removeItem(FONDO_STORAGE_KEY)
  if (fondoInput) fondoInput.value = ""
}

fondoInput?.addEventListener("change", e => {
  const archivo = e.target.files?.[0]
  if (!archivo) return

  const lector = new FileReader()
  lector.onload = () => {
    const dataUrl = lector.result
    if (typeof dataUrl === "string") {
      aplicarFondo(dataUrl)
      localStorage.setItem(FONDO_STORAGE_KEY, dataUrl)
    }
  }
  lector.readAsDataURL(archivo)
  e.target.value = ""
})

function toggleModo() {
  const activo = document.body.classList.toggle("oscuro")
  localStorage.setItem(MODO_OSCURO_STORAGE_KEY, activo ? "true" : "false")
  aplicarColorAcentoGuardado()
}

accentColorInput?.addEventListener("input", () => {
  const color = accentColorInput.value
  localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, color)
  aplicarColorAcentoGuardado()
})

accentColorInput?.addEventListener("change", () => {
  const color = accentColorInput.value
  if (normalizarHexColor(color) === "#1e3a8a") {
    restablecerColorAcento()
    return
  }
  localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, color)
  aplicarColorAcentoGuardado()
})

accentApplyDarkToggle?.addEventListener("change", () => {
  localStorage.setItem(ACCENT_COLOR_APPLY_DARK_KEY, accentApplyDarkToggle.checked ? "true" : "false")
  aplicarColorAcentoGuardado()
})

function abrirSelectorMalla() {
  mallaInput?.click()
}

function aplicarMallaImagen(src) {
  aplicarMallaBase(src, src)
}

function aplicarMallaBase(baseSrc, displaySrc) {
  if (!scheduleMallaImage || !scheduleMallaPlaceholder) return
  const resolvedDisplay = displaySrc || baseSrc

  if (baseSrc) {
    scheduleMallaImage.src = resolvedDisplay
    scheduleMallaImage.hidden = false
    if (mallaResizeHandle) mallaResizeHandle.hidden = false
    scheduleMallaPlaceholder.hidden = true
    if (mallaPreviewImage) mallaPreviewImage.src = baseSrc
    window.requestAnimationFrame(ajustarCanvasMalla)
  } else {
    scheduleMallaImage.removeAttribute("src")
    scheduleMallaImage.hidden = true
    if (mallaResizeHandle) mallaResizeHandle.hidden = true
    scheduleMallaPlaceholder.hidden = false
    if (mallaPreviewImage) mallaPreviewImage.removeAttribute("src")
    limpiarCanvasMalla()
  }
}

function obtenerOverlayMalla() {
  return localStorage.getItem(MALLA_OVERLAY_KEY) || ""
}

function calcularBaseMallaSize() {
  if (!mallaPreviewImage || !mallaPreviewBody) return null
  const naturalWidth = mallaPreviewImage.naturalWidth
  const naturalHeight = mallaPreviewImage.naturalHeight
  if (!naturalWidth || !naturalHeight) return null
  const maxWidth = mallaPreviewBody.clientWidth || naturalWidth
  const maxHeight = mallaPreviewBody.clientHeight || naturalHeight
  const escala = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1)
  return {
    width: Math.round(naturalWidth * escala),
    height: Math.round(naturalHeight * escala)
  }
}

function actualizarZoomMalla() {
  if (!mallaZoomBaseSize || !mallaPreviewCanvasWrap || !mallaPreviewZoomArea) return
  const width = mallaZoomBaseSize.width
  const height = mallaZoomBaseSize.height
  const scaledWidth = Math.round(width * mallaZoomScale)
  const scaledHeight = Math.round(height * mallaZoomScale)
  mallaPreviewCanvasWrap.style.setProperty("--malla-zoom", mallaZoomScale.toFixed(3))
  mallaPreviewZoomArea.style.width = `${scaledWidth}px`
  mallaPreviewZoomArea.style.height = `${scaledHeight}px`
  actualizarEstadoPaneoMalla()
}

function actualizarEstadoPaneoMalla() {
  if (!mallaPreviewBody || !mallaPreviewBackdrop) return
  const previewVisible = mallaPreviewBackdrop.classList.contains("visible")
  const paneoDisponible = previewVisible && mallaZoomScale > 1
  mallaPreviewBody.classList.toggle("pan-enabled", paneoDisponible)
  mallaPreviewBody.classList.toggle("is-panning", paneoDisponible && mallaPanActivo)
}

function detenerPaneoMalla() {
  mallaPanActivo = false
  mallaPanPointerId = null
  actualizarEstadoPaneoMalla()
}

function aplicarZoomMalla(nivel) {
  const limitado = Math.min(MALLA_MAX_ZOOM, Math.max(MALLA_MIN_ZOOM, nivel))
  mallaZoomScale = limitado
  actualizarZoomMalla()
}

function ajustarCanvasMalla() {
  if (!mallaPreviewCanvas || !mallaPreviewImage) return
  const baseSize = calcularBaseMallaSize()
  if (!baseSize) return
  const baseWidth = baseSize.width
  const baseHeight = baseSize.height
  const dpr = window.devicePixelRatio || 1
  mallaZoomBaseSize = { width: baseWidth, height: baseHeight }
  if (mallaPreviewCanvasWrap) {
    mallaPreviewCanvasWrap.style.width = `${baseWidth}px`
    mallaPreviewCanvasWrap.style.height = `${baseHeight}px`
  }
  mallaPreviewImage.style.width = `${baseWidth}px`
  mallaPreviewImage.style.height = `${baseHeight}px`
  mallaPreviewCanvas.width = Math.round(baseWidth * dpr)
  mallaPreviewCanvas.height = Math.round(baseHeight * dpr)
  mallaPreviewCanvas.style.width = `${baseWidth}px`
  mallaPreviewCanvas.style.height = `${baseHeight}px`
  const ctx = mallaPreviewCanvas.getContext("2d")
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  actualizarZoomMalla()
}

function limpiarCanvasMalla() {
  if (!mallaPreviewCanvas) return
  const ctx = mallaPreviewCanvas.getContext("2d")
  if (!ctx) return
  ctx.globalCompositeOperation = "source-over"
  ctx.clearRect(0, 0, mallaPreviewCanvas.width, mallaPreviewCanvas.height)
}

function cargarOverlayMalla() {
  if (!mallaPreviewCanvas || !mallaPreviewImage) return
  const overlaySrc = obtenerOverlayMalla()
  limpiarCanvasMalla()
  if (!overlaySrc) return
  const dpr = window.devicePixelRatio || 1
  const baseWidth = mallaPreviewCanvas.width / dpr
  const baseHeight = mallaPreviewCanvas.height / dpr
  if (!baseWidth || !baseHeight) return
  const overlayImage = new Image()
  overlayImage.onload = () => {
    const ctx = mallaPreviewCanvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(overlayImage, 0, 0, baseWidth, baseHeight)
  }
  overlayImage.src = overlaySrc
}

function obtenerCoordenadasMalla(event) {
  if (!mallaPreviewCanvas) return null
  const rect = mallaPreviewCanvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const baseWidth = mallaPreviewCanvas.width / dpr
  const baseHeight = mallaPreviewCanvas.height / dpr
  if (!rect.width || !rect.height || !baseWidth || !baseHeight) return null
  const scaleX = baseWidth / rect.width
  const scaleY = baseHeight / rect.height
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  }
}

function establecerModoDibujo(activo) {
  mallaDrawActive = activo
  if (activo) {
    mallaEraseActive = false
  }
  if (mallaPreviewCanvasWrap) {
    mallaPreviewCanvasWrap.classList.toggle("drawing-active", activo)
  }
  if (mallaDrawToggle) {
    mallaDrawToggle.setAttribute("aria-pressed", activo ? "true" : "false")
  }
  if (mallaEraseToggle) {
    mallaEraseToggle.setAttribute("aria-pressed", "false")
  }
}

function establecerModoBorrador(activo) {
  mallaEraseActive = activo
  if (activo) {
    mallaDrawActive = false
  }
  if (mallaPreviewCanvasWrap) {
    mallaPreviewCanvasWrap.classList.toggle("drawing-active", activo)
  }
  if (mallaEraseToggle) {
    mallaEraseToggle.setAttribute("aria-pressed", activo ? "true" : "false")
  }
  if (mallaDrawToggle) {
    mallaDrawToggle.setAttribute("aria-pressed", "false")
  }
}

function guardarEdicionMalla() {
  if (!mallaPreviewCanvas) return
  const overlayDataUrl = mallaPreviewCanvas.toDataURL("image/png")
  localStorage.setItem(MALLA_OVERLAY_KEY, overlayDataUrl)
  actualizarMallaCompuesta()
  limpiarCanvasMalla()
  cargarOverlayMalla()
  establecerModoDibujo(false)
  establecerModoBorrador(false)
}

function actualizarMallaCompuesta() {
  const baseSrc = localStorage.getItem(MALLA_BASE_KEY) || ""
  if (!baseSrc) return
  const overlaySrc = obtenerOverlayMalla()
  if (!overlaySrc) {
    aplicarMallaBase(baseSrc, baseSrc)
    localStorage.setItem(MALLA_STORAGE_KEY, baseSrc)
    return
  }
  const baseImage = new Image()
  const overlayImage = new Image()
  baseImage.onload = () => {
    const outputCanvas = document.createElement("canvas")
    outputCanvas.width = baseImage.naturalWidth
    outputCanvas.height = baseImage.naturalHeight
    const outputCtx = outputCanvas.getContext("2d")
    if (!outputCtx) return
    outputCtx.drawImage(baseImage, 0, 0)
    overlayImage.onload = () => {
      outputCtx.drawImage(overlayImage, 0, 0, outputCanvas.width, outputCanvas.height)
      const displayUrl = outputCanvas.toDataURL("image/png")
      aplicarMallaBase(baseSrc, displayUrl)
      localStorage.setItem(MALLA_STORAGE_KEY, displayUrl)
    }
    overlayImage.src = overlaySrc
  }
  baseImage.src = baseSrc
}

function abrirMallaPreview() {
  if (!mallaPreviewBackdrop || !mallaPreviewImage) return
  if (!mallaPreviewImage.getAttribute("src")) return
  asegurarMallaPreviewEnBody()
  mallaPreviewBackdrop.classList.add("visible")
  mallaPreviewBackdrop.setAttribute("aria-hidden", "false")
  actualizarEstadoPaneoMalla()
  window.requestAnimationFrame(() => {
    ajustarCanvasMalla()
    cargarOverlayMalla()
  })
}

function cerrarMallaPreview() {
  if (!mallaPreviewBackdrop) return
  mallaPreviewBackdrop.classList.remove("visible")
  mallaPreviewBackdrop.setAttribute("aria-hidden", "true")
  limpiarCanvasMalla()
  establecerModoDibujo(false)
  establecerModoBorrador(false)
  mallaZoomFocus = false
  detenerPaneoMalla()
}

function aplicarMallaActiva(activa) {
  document.body.classList.toggle("malla-activa", activa)
  if (mallaToggle) mallaToggle.checked = activa
}


function aplicarMallaWidth(value) {
  if (!value) return
  const size = Number.parseInt(value, 10)
  if (Number.isNaN(size)) return
  const clamped = Math.min(MALLA_MAX_WIDTH, Math.max(MALLA_MIN_WIDTH, size))
  document.documentElement.style.setProperty("--malla-width", `${clamped}px`)
}

function obtenerZoomApp() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--zoom-scale")
  const escala = Number.parseFloat(raw)
  if (!Number.isFinite(escala) || escala <= 0) return 1
  return escala
}

function habilitarResizeMalla() {
  const contenedor = document.getElementById("scheduleMalla")
  if (!contenedor || !mallaResizeHandle) return

  let resizing = false
  let lastX = 0
  let currentWidth = 0
  let widthPendiente = null
  let rafId = null

  const clampWidth = width => Math.min(MALLA_MAX_WIDTH, Math.max(MALLA_MIN_WIDTH, Math.round(width)))

  const aplicarWidthPendiente = () => {
    rafId = null
    if (widthPendiente == null) return
    aplicarMallaWidth(String(clampWidth(widthPendiente)))
  }

  const guardarAncho = width => {
    const clamped = clampWidth(width)
    aplicarMallaWidth(String(clamped))
    localStorage.setItem(MALLA_SIZE_KEY, String(clamped))
  }

  const onPointerMove = event => {
    if (!resizing) return
    const zoomScale = obtenerZoomApp()
    const delta = (lastX - event.clientX) / zoomScale
    lastX = event.clientX
    currentWidth += delta * MALLA_RESIZE_SENSITIVITY
    widthPendiente = currentWidth
    if (!rafId) rafId = window.requestAnimationFrame(aplicarWidthPendiente)
  }

  const onPointerUp = () => {
    if (!resizing) return
    resizing = false
    if (rafId) {
      window.cancelAnimationFrame(rafId)
      rafId = null
    }
    if (widthPendiente != null) {
      guardarAncho(widthPendiente)
      widthPendiente = null
    }
    document.body.classList.remove("malla-resizing")
    window.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("pointerup", onPointerUp)
  }

  mallaResizeHandle.addEventListener("pointerdown", event => {
    event.preventDefault()
    event.stopPropagation()
    resizing = true
    lastX = event.clientX
    currentWidth = contenedor.getBoundingClientRect().width / obtenerZoomApp()
    widthPendiente = currentWidth
    mallaResizeHandle.setPointerCapture?.(event.pointerId)
    document.body.classList.add("malla-resizing")
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
  })
}

function restablecerMalla() {
  aplicarMallaImagen("")
  aplicarMallaWidth(String(MALLA_DEFAULT_WIDTH))
  localStorage.removeItem(MALLA_BASE_KEY)
  localStorage.removeItem(MALLA_STORAGE_KEY)
  localStorage.removeItem(MALLA_OVERLAY_KEY)
  localStorage.removeItem(MALLA_SIZE_KEY)
  if (mallaInput) mallaInput.value = ""
}

mallaInput?.addEventListener("change", e => {
  const archivo = e.target.files?.[0]
  if (!archivo) return

  const lector = new FileReader()
  lector.onload = () => {
    const dataUrl = lector.result
    if (typeof dataUrl === "string") {
      aplicarMallaBase(dataUrl, dataUrl)
      localStorage.setItem(MALLA_BASE_KEY, dataUrl)
      localStorage.setItem(MALLA_STORAGE_KEY, dataUrl)
      localStorage.removeItem(MALLA_OVERLAY_KEY)
      aplicarMallaActiva(true)
      localStorage.setItem(MALLA_ENABLED_KEY, "true")
    }
  }
  lector.readAsDataURL(archivo)
  e.target.value = ""
})

mallaToggle?.addEventListener("change", () => {
  const activa = mallaToggle.checked
  aplicarMallaActiva(activa)
  localStorage.setItem(MALLA_ENABLED_KEY, activa ? "true" : "false")
})


scheduleMallaImage?.addEventListener("click", abrirMallaPreview)
mallaPreviewClose?.addEventListener("click", cerrarMallaPreview)
mallaPreviewBackdrop?.addEventListener("click", event => {
  if (event.target === mallaPreviewBackdrop) cerrarMallaPreview()
})
mallaPreviewImage?.addEventListener("load", () => {
  ajustarCanvasMalla()
  cargarOverlayMalla()
})
window.addEventListener("resize", () => {
  ajustarCanvasMalla()
  cargarOverlayMalla()
})

mallaDrawToggle?.addEventListener("click", () => {
  establecerModoDibujo(!mallaDrawActive)
})

mallaEraseToggle?.addEventListener("click", () => {
  establecerModoBorrador(!mallaEraseActive)
})

mallaClearLines?.addEventListener("click", () => {
  limpiarCanvasMalla()
  localStorage.removeItem(MALLA_OVERLAY_KEY)
  actualizarMallaCompuesta()
})

mallaSaveLines?.addEventListener("click", guardarEdicionMalla)

mallaPreviewEdit?.addEventListener("click", () => {
  abrirSelectorMalla()
})

mallaPreviewRemove?.addEventListener("click", () => {
  restablecerMalla()
  cerrarMallaPreview()
})

mallaZoomIn?.addEventListener("click", () => {
  aplicarZoomMalla(mallaZoomScale + MALLA_ZOOM_STEP)
})

mallaZoomOut?.addEventListener("click", () => {
  aplicarZoomMalla(mallaZoomScale - MALLA_ZOOM_STEP)
})

mallaPreviewCanvasWrap?.addEventListener("mouseenter", () => {
  mallaZoomFocus = true
})

mallaPreviewCanvasWrap?.addEventListener("mouseleave", () => {
  mallaZoomFocus = false
})

mallaPreviewCanvasWrap?.addEventListener("focusin", () => {
  mallaZoomFocus = true
})

mallaPreviewCanvasWrap?.addEventListener("focusout", () => {
  mallaZoomFocus = false
})

mallaPreviewCanvasWrap?.addEventListener("pointerdown", () => {
  mallaPreviewCanvasWrap.focus?.()
})

mallaPreviewBody?.addEventListener("pointerdown", event => {
  if (event.pointerType !== "mouse" || event.button !== 2) return
  if (!mallaPreviewBackdrop?.classList.contains("visible")) return
  if (mallaZoomScale <= 1) return
  mallaPanActivo = true
  mallaPanPointerId = event.pointerId
  mallaPanStartX = event.clientX
  mallaPanStartY = event.clientY
  mallaPanScrollLeft = mallaPreviewBody.scrollLeft
  mallaPanScrollTop = mallaPreviewBody.scrollTop
  mallaPreviewBody.setPointerCapture?.(event.pointerId)
  event.preventDefault()
  actualizarEstadoPaneoMalla()
})

mallaPreviewBody?.addEventListener("pointermove", event => {
  if (!mallaPanActivo || event.pointerId !== mallaPanPointerId) return
  const deltaX = event.clientX - mallaPanStartX
  const deltaY = event.clientY - mallaPanStartY
  mallaPreviewBody.scrollLeft = mallaPanScrollLeft - deltaX
  mallaPreviewBody.scrollTop = mallaPanScrollTop - deltaY
})

const detenerPaneoPorPointer = event => {
  if (event.pointerId !== mallaPanPointerId) return
  mallaPreviewBody?.releasePointerCapture?.(event.pointerId)
  detenerPaneoMalla()
}

mallaPreviewBody?.addEventListener("pointerup", detenerPaneoPorPointer)
mallaPreviewBody?.addEventListener("pointercancel", detenerPaneoPorPointer)
mallaPreviewBody?.addEventListener("contextmenu", event => {
  if (!mallaPreviewBackdrop?.classList.contains("visible")) return
  if (mallaZoomScale <= 1) return
  event.preventDefault()
})

mallaPreviewCanvas?.addEventListener("pointerdown", event => {
  if (event.button !== 0) return
  if ((!mallaDrawActive && !mallaEraseActive) || !mallaPreviewCanvas) return
  const ctx = mallaPreviewCanvas.getContext("2d")
  if (!ctx) return
  const coords = obtenerCoordenadasMalla(event)
  if (!coords) return
  const { x, y } = coords
  if (mallaEraseActive) {
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 18
    ctx.globalCompositeOperation = "destination-out"
  } else {
    ctx.strokeStyle = "#e11d2e"
    ctx.lineWidth = 3
    ctx.globalCompositeOperation = "source-over"
  }
  ctx.beginPath()
  ctx.moveTo(x, y)
  mallaIsDrawing = true
  mallaPreviewCanvas.setPointerCapture?.(event.pointerId)
})

mallaPreviewCanvas?.addEventListener("pointermove", event => {
  if (!mallaIsDrawing || !mallaPreviewCanvas) return
  const ctx = mallaPreviewCanvas.getContext("2d")
  if (!ctx) return
  const coords = obtenerCoordenadasMalla(event)
  if (!coords) return
  const { x, y } = coords
  ctx.lineTo(x, y)
  ctx.stroke()
})

const detenerDibujo = event => {
  if (!mallaIsDrawing || !mallaPreviewCanvas) return
  mallaIsDrawing = false
  mallaPreviewCanvas.releasePointerCapture?.(event.pointerId)
}

mallaPreviewCanvas?.addEventListener("pointerup", detenerDibujo)
mallaPreviewCanvas?.addEventListener("pointerleave", detenerDibujo)

document.addEventListener("keydown", event => {
  if (event.key === "Escape") cerrarMallaPreview()
})

window.mallaZoomApi = {
  handleWheel(event) {
    if (!event.ctrlKey) return false
    if (!mallaPreviewBackdrop?.classList.contains("visible")) return false
    if (!mallaPreviewCanvasWrap?.contains(event.target)) return false
    event.preventDefault()
    const delta = event.deltaY > 0 ? -MALLA_ZOOM_STEP : MALLA_ZOOM_STEP
    aplicarZoomMalla(mallaZoomScale + delta)
    return true
  },
  handleKeydown(event) {
    const ctrl = event.ctrlKey || event.metaKey
    if (!ctrl) return false
    if (!mallaPreviewBackdrop?.classList.contains("visible")) return false
    if (!mallaZoomFocus) return false
    if (event.key === "+" || event.key === "=") {
      event.preventDefault()
      aplicarZoomMalla(mallaZoomScale + MALLA_ZOOM_STEP)
      return true
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault()
      aplicarZoomMalla(mallaZoomScale - MALLA_ZOOM_STEP)
      return true
    }
    if (event.key === "0") {
      event.preventDefault()
      aplicarZoomMalla(1)
      return true
    }
    return false
  }
}

habilitarResizeMalla()
aplicarModoGuardado()
const accentColorGuardado = localStorage.getItem(ACCENT_COLOR_STORAGE_KEY) || ""
if (!normalizarHexColor(accentColorGuardado) && accentColorGuardado) {
  localStorage.removeItem(ACCENT_COLOR_STORAGE_KEY)
}
aplicarColorAcentoGuardado()
aplicarBanner(localStorage.getItem(BANNER_STORAGE_KEY) || "")
aplicarFondoBannerActivo(localStorage.getItem(BANNER_FILL_ENABLED_KEY) !== "false")
aplicarFondo(localStorage.getItem(FONDO_STORAGE_KEY) || "")
const storedDisplayMalla = localStorage.getItem(MALLA_STORAGE_KEY) || ""
const storedBaseMalla = localStorage.getItem(MALLA_BASE_KEY) || storedDisplayMalla
if (storedBaseMalla && !localStorage.getItem(MALLA_BASE_KEY)) {
  localStorage.setItem(MALLA_BASE_KEY, storedBaseMalla)
}
aplicarMallaBase(storedBaseMalla, storedDisplayMalla)
aplicarMallaActiva(localStorage.getItem(MALLA_ENABLED_KEY) === "true")
aplicarMallaWidth(localStorage.getItem(MALLA_SIZE_KEY) || String(MALLA_DEFAULT_WIDTH))
