const MODO_OSCURO_STORAGE_KEY = "modoOscuroActivo"
const appBanner = document.getElementById("appBanner")
const bannerInput = document.getElementById("bannerInput")
const BANNER_STORAGE_KEY = "bannerImagenApp"
const fondoInput = document.getElementById("fondoInput")
const FONDO_STORAGE_KEY = "fondoImagenApp"
const mallaInput = document.getElementById("mallaInput")
const mallaToggle = document.getElementById("mallaToggle")
const mallaSize = document.getElementById("mallaSize")
const MALLA_STORAGE_KEY = "mallaImagenHorario"
const MALLA_ENABLED_KEY = "mallaActivaHorario"
const MALLA_SIZE_KEY = "mallaSizeHorario"
const scheduleMallaImage = document.getElementById("scheduleMallaImage")
const scheduleMallaPlaceholder = document.getElementById("scheduleMallaPlaceholder")
const mallaPreviewBackdrop = document.getElementById("mallaPreviewBackdrop")
const mallaPreviewImage = document.getElementById("mallaPreviewImage")
const mallaPreviewClose = document.getElementById("mallaPreviewClose")

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
    scheduleMallaPlaceholder.hidden = true
    if (mallaPreviewImage) mallaPreviewImage.src = src
  } else {
    scheduleMallaImage.removeAttribute("src")
    scheduleMallaImage.hidden = true
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
  if (mallaSize) mallaSize.disabled = !activa
}

function aplicarMallaSize(value) {
  if (!value) return
  const size = Number.parseInt(value, 10)
  if (Number.isNaN(size)) return
  document.documentElement.style.setProperty("--malla-width", `${size}px`)
  if (mallaSize) mallaSize.value = `${size}`
}

function restablecerMalla() {
  aplicarMallaImagen("")
  localStorage.removeItem(MALLA_STORAGE_KEY)
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

mallaSize?.addEventListener("input", () => {
  const valor = mallaSize.value
  aplicarMallaSize(valor)
  localStorage.setItem(MALLA_SIZE_KEY, valor)
})

scheduleMallaImage?.addEventListener("click", abrirMallaPreview)
mallaPreviewClose?.addEventListener("click", cerrarMallaPreview)
mallaPreviewBackdrop?.addEventListener("click", event => {
  if (event.target === mallaPreviewBackdrop) cerrarMallaPreview()
})

document.addEventListener("keydown", event => {
  if (event.key === "Escape") cerrarMallaPreview()
})

aplicarModoGuardado()
aplicarBanner(localStorage.getItem(BANNER_STORAGE_KEY) || "")
aplicarFondo(localStorage.getItem(FONDO_STORAGE_KEY) || "")
aplicarMallaImagen(localStorage.getItem(MALLA_STORAGE_KEY) || "")
aplicarMallaActiva(localStorage.getItem(MALLA_ENABLED_KEY) === "true")
aplicarMallaSize(localStorage.getItem(MALLA_SIZE_KEY) || "320")