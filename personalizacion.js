const MODO_OSCURO_STORAGE_KEY = "modoOscuroActivo"
const appBanner = document.getElementById("appBanner")
const bannerInput = document.getElementById("bannerInput")
const BANNER_STORAGE_KEY = "bannerImagenApp"
const BANNER_FILL_ENABLED_KEY = "bannerColorFondoActivo"
const bannerFillToggle = document.getElementById("bannerFillToggle")
const fondoInput = document.getElementById("fondoInput")
const FONDO_STORAGE_KEY = "fondoImagenApp"
const mallaInput = document.getElementById("mallaInput")
const mallaToggle = document.getElementById("mallaToggle")
const MALLA_STORAGE_KEY = "mallaImagenHorario"
const MALLA_ENABLED_KEY = "mallaActivaHorario"
const MALLA_SIZE_KEY = "mallaSizeHorario"
const MALLA_MIN_WIDTH = 220
const MALLA_MAX_WIDTH = 700
const MALLA_DEFAULT_WIDTH = 320
const MALLA_RESIZE_SENSITIVITY = 0.45
const scheduleMallaImage = document.getElementById("scheduleMallaImage")
const scheduleMallaPlaceholder = document.getElementById("scheduleMallaPlaceholder")
const mallaPreviewBackdrop = document.getElementById("mallaPreviewBackdrop")
const mallaPreviewImage = document.getElementById("mallaPreviewImage")
const mallaPreviewClose = document.getElementById("mallaPreviewClose")
const mallaResizeHandle = document.getElementById("mallaResizeHandle")

function aplicarModoGuardado() {
  if (localStorage.getItem(MODO_OSCURO_STORAGE_KEY) === "true") {
    document.body.classList.add("oscuro")
  }
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
}

function abrirSelectorMalla() {
  mallaInput?.click()
}

function aplicarMallaImagen(src) {
  if (!scheduleMallaImage || !scheduleMallaPlaceholder) return

  if (src) {
    scheduleMallaImage.src = src
    scheduleMallaImage.hidden = false
    if (mallaResizeHandle) mallaResizeHandle.hidden = false
    scheduleMallaPlaceholder.hidden = true
    if (mallaPreviewImage) mallaPreviewImage.src = src
  } else {
    scheduleMallaImage.removeAttribute("src")
    scheduleMallaImage.hidden = true
    if (mallaResizeHandle) mallaResizeHandle.hidden = true
    scheduleMallaPlaceholder.hidden = false
    if (mallaPreviewImage) mallaPreviewImage.removeAttribute("src")
  }
}

function abrirMallaPreview() {
  if (!mallaPreviewBackdrop || !mallaPreviewImage) return
  if (!mallaPreviewImage.getAttribute("src")) return
  mallaPreviewBackdrop.classList.add("visible")
  mallaPreviewBackdrop.setAttribute("aria-hidden", "false")
}

function cerrarMallaPreview() {
  if (!mallaPreviewBackdrop) return
  mallaPreviewBackdrop.classList.remove("visible")
  mallaPreviewBackdrop.setAttribute("aria-hidden", "true")
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
    const delta = lastX - event.clientX
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
    currentWidth = contenedor.getBoundingClientRect().width
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
  localStorage.removeItem(MALLA_STORAGE_KEY)
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
      aplicarMallaImagen(dataUrl)
      localStorage.setItem(MALLA_STORAGE_KEY, dataUrl)
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

document.addEventListener("keydown", event => {
  if (event.key === "Escape") cerrarMallaPreview()
})

habilitarResizeMalla()
aplicarModoGuardado()
aplicarBanner(localStorage.getItem(BANNER_STORAGE_KEY) || "")
aplicarFondoBannerActivo(localStorage.getItem(BANNER_FILL_ENABLED_KEY) !== "false")
aplicarFondo(localStorage.getItem(FONDO_STORAGE_KEY) || "")
aplicarMallaImagen(localStorage.getItem(MALLA_STORAGE_KEY) || "")
aplicarMallaActiva(localStorage.getItem(MALLA_ENABLED_KEY) === "true")
aplicarMallaWidth(localStorage.getItem(MALLA_SIZE_KEY) || String(MALLA_DEFAULT_WIDTH))