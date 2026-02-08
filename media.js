const mediaInput = document.getElementById("mediaInput")
const mediaAddBtn = document.getElementById("mediaAddBtn")
const mediaGrid = document.getElementById("mediaGrid")
const mediaError = document.getElementById("mediaError")
const MEDIA_STORAGE_KEY = "mediaEmbeds"

const normalizarTexto = texto => (texto || "").trim()

const limpiarErrorMedia = () => {
  if (mediaError) mediaError.textContent = ""
}

const mostrarErrorMedia = mensaje => {
  if (mediaError) mediaError.textContent = mensaje
}

const obtenerVideosGuardados = () => {
  try {
    const raw = localStorage.getItem(MEDIA_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (error) {
    console.error("Error leyendo videos guardados", error)
    return []
  }
}

const guardarVideos = videos => {
  localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(videos))
}

const crearIdVideo = () =>
  `media-${Date.now()}-${Math.random().toString(16).slice(2)}`

const finalizarEmbed = embedUrl => {
  if (!embedUrl) return null
  try {
    const url = new URL(embedUrl)
    if (!url.searchParams.has("rel")) {
      url.searchParams.set("rel", "0")
    }
    const origin = window.location?.origin
    if (origin && origin !== "null" && !url.searchParams.has("origin")) {
      url.searchParams.set("origin", origin)
    }
    return url.toString()
  } catch (error) {
    return embedUrl
  }
}

const construirEmbedYouTube = url => {
  if (!url) return null
  let parsed
  try {
    parsed = new URL(url)
  } catch (error) {
    return null
  }

  const host = parsed.hostname.replace("www.", "")
  const path = parsed.pathname
  const list = parsed.searchParams.get("list")

  if (host === "youtu.be") {
    const id = path.replace("/", "")
    return id ? finalizarEmbed(`https://www.youtube-nocookie.com/embed/${id}`) : null
  }

  if (host.endsWith("youtube.com")) {
    if (path.startsWith("/embed/")) {
      return finalizarEmbed(`https://www.youtube-nocookie.com${path}${parsed.search}`)
    }

    if (path.startsWith("/playlist") && list) {
      return finalizarEmbed(
        `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`
      )
    }

    if (path.startsWith("/shorts/")) {
      const id = path.replace("/shorts/", "")
      return id
        ? finalizarEmbed(`https://www.youtube-nocookie.com/embed/${id}`)
        : null
    }

    if (path.startsWith("/live/")) {
      const id = path.replace("/live/", "")
      return id
        ? finalizarEmbed(`https://www.youtube-nocookie.com/embed/${id}`)
        : null
    }

    if (path === "/watch") {
      const id = parsed.searchParams.get("v")
      if (id) {
        return finalizarEmbed(`https://www.youtube-nocookie.com/embed/${id}`)
      }
      if (list) {
        return finalizarEmbed(
          `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`
        )
      }
    }
  }

  return null
}

const crearCardVideo = (video, onRemove) => {
  const card = document.createElement("div")
  card.className = "media-card"

  const iframe = document.createElement("iframe")
  iframe.src = video.embedUrl
  iframe.title = "Video de YouTube"
  iframe.referrerPolicy = "strict-origin-when-cross-origin"
  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  iframe.allowFullscreen = true
  iframe.loading = "lazy"

  const actions = document.createElement("div")
  actions.className = "media-card-actions"

  const link = document.createElement("a")
  link.href = video.originalUrl
  link.target = "_blank"
  link.rel = "noreferrer"
  link.className = "media-link"
  link.textContent = "Abrir en YouTube"

  const removeBtn = document.createElement("button")
  removeBtn.type = "button"
  removeBtn.className = "media-remove"
  removeBtn.textContent = "Quitar"
  removeBtn.addEventListener("click", () => onRemove(video.id))

  actions.append(link, removeBtn)
  card.append(iframe, actions)
  return card
}

const renderMedia = videos => {
  if (!mediaGrid) return
  mediaGrid.innerHTML = ""

  if (!videos.length) {
    const empty = document.createElement("div")
    empty.className = "media-empty"
    empty.textContent = "Todavía no has agregado videos."
    mediaGrid.appendChild(empty)
    return
  }

  videos.forEach(video => {
    const card = crearCardVideo(video, id => {
      const updated = videos.filter(item => item.id !== id)
      guardarVideos(updated)
      renderMedia(updated)
    })
    mediaGrid.appendChild(card)
  })
}

const agregarVideo = () => {
  const raw = normalizarTexto(mediaInput?.value)
  if (!raw) {
    mostrarErrorMedia("Ingresa un link de YouTube para continuar.")
    return
  }

  const embedUrl = construirEmbedYouTube(raw)
  if (!embedUrl) {
    mostrarErrorMedia("El link no es válido o no pertenece a YouTube.")
    return
  }

  const videos = obtenerVideosGuardados()
  const nuevo = {
    id: crearIdVideo(),
    originalUrl: raw,
    embedUrl
  }
  const actualizados = [nuevo, ...videos]
  guardarVideos(actualizados)
  renderMedia(actualizados)
  if (mediaInput) mediaInput.value = ""
  limpiarErrorMedia()
}

mediaAddBtn?.addEventListener("click", agregarVideo)
mediaInput?.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault()
    agregarVideo()
  }
})
mediaInput?.addEventListener("input", () => {
  if (mediaError?.textContent) limpiarErrorMedia()
})

renderMedia(obtenerVideosGuardados())
