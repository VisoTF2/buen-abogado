const MODO_OSCURO_STORAGE_KEY = "modoOscuroActivo"
const appBanner = document.getElementById("appBanner")
const bannerInput = document.getElementById("bannerInput")
const BANNER_STORAGE_KEY = "bannerImagenApp"
const fondoInput = document.getElementById("fondoInput")
const FONDO_STORAGE_KEY = "fondoImagenApp"

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

aplicarModoGuardado()
aplicarBanner(localStorage.getItem(BANNER_STORAGE_KEY) || "")
aplicarFondo(localStorage.getItem(FONDO_STORAGE_KEY) || "")