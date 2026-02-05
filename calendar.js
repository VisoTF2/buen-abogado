document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar")
  const modalCalendario = document.getElementById("modalCalendario")
  const modalCalendarioTitulo = document.getElementById("modalCalendarioTitulo")
  const inputNombreEvento = document.getElementById("inputNombreEvento")
  const modalCalendarioGuardar = document.getElementById("modalCalendarioGuardar")
  const modalCalendarioEliminar = document.getElementById("modalCalendarioEliminar")
  const modalCalendarioCerrar = document.getElementById("modalCalendarioCerrar")

  if (!calendarEl || typeof FullCalendar === "undefined") return

  const STORAGE_KEY = "calendarEvents"
  let fechaSeleccionada = null
  let eventoEditandoId = null
  let eventoSeleccionadoId = null
  let eventoCopiado = null
  let menuCalendario = null

  const leerEventos = () => {
    try {
      const guardados = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
      if (!Array.isArray(guardados)) return []
      return guardados
        .filter(evento => evento && evento.id && evento.title && evento.start)
        .map(evento => ({
          id: String(evento.id),
          title: String(evento.title),
          start: evento.start,
          allDay: evento.allDay !== false,
          extendedProps: {
            completed: Boolean(evento.completed)
          }
        }))
    } catch {
      return []
    }
  }

  const guardarEventos = calendar => {
    const serializados = calendar.getEvents().map(evento => ({
      id: evento.id,
      title: evento.title,
      start: evento.startStr,
      allDay: evento.allDay,
      completed: Boolean(evento.extendedProps.completed)
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializados))
  }

  const normalizarFecha = fecha => {
    if (!fecha) return null
    if (fecha.includes("T")) return fecha.split("T")[0]
    return fecha
  }

  const actualizarEventoActivoVisual = () => {
    calendarEl
      .querySelectorAll(".fc-event.evento-activo")
      .forEach(el => el.classList.remove("evento-activo"))
    if (!eventoSeleccionadoId) return
    calendarEl
      .querySelectorAll(`.fc-event[data-evento-id="${eventoSeleccionadoId}"]`)
      .forEach(el => el.classList.add("evento-activo"))
  }

  const crearMenuCalendario = () => {
    if (menuCalendario) return menuCalendario

    const menu = document.createElement("div")
    menu.className = "menu-contextual"

    const btnCopiar = document.createElement("button")
    btnCopiar.type = "button"
    btnCopiar.textContent = "Copiar evento"

    const btnPegar = document.createElement("button")
    btnPegar.type = "button"
    btnPegar.textContent = "Pegar en este día"

    menu.appendChild(btnCopiar)
    menu.appendChild(btnPegar)
    document.body.appendChild(menu)

    menuCalendario = { menu, btnCopiar, btnPegar }
    return menuCalendario
  }

  const ocultarMenuCalendario = () => {
    if (!menuCalendario) return
    menuCalendario.menu.style.display = "none"
    menuCalendario.btnCopiar.onclick = null
    menuCalendario.btnPegar.onclick = null
  }

  const mostrarMenuCalendario = (event, handlers = {}) => {
    const { menu, btnCopiar, btnPegar } = crearMenuCalendario()

    btnCopiar.disabled = !handlers.onCopy
    btnPegar.disabled = !handlers.onPaste || !eventoCopiado

    btnCopiar.onclick = () => {
      if (!handlers.onCopy) return
      handlers.onCopy()
      ocultarMenuCalendario()
    }

    btnPegar.onclick = () => {
      if (!handlers.onPaste || !eventoCopiado) return
      handlers.onPaste()
      ocultarMenuCalendario()
    }

    menu.style.display = "flex"
    const margin = 12
    const menuWidth = menu.offsetWidth
    const menuHeight = menu.offsetHeight
    let x = event.clientX
    let y = event.clientY
    if (x + menuWidth + margin > window.innerWidth) x = window.innerWidth - menuWidth - margin
    if (y + menuHeight + margin > window.innerHeight) y = window.innerHeight - menuHeight - margin
    menu.style.left = `${Math.max(margin, x)}px`
    menu.style.top = `${Math.max(margin, y)}px`
  }

  const abrirModalEvento = ({ titulo, fecha, eventoId = null }) => {
    if (!modalCalendario || !modalCalendarioTitulo || !inputNombreEvento) return
    fechaSeleccionada = normalizarFecha(fecha)
    eventoEditandoId = eventoId
    modalCalendarioTitulo.textContent = eventoId ? "Editar evento" : "Nuevo evento"
    inputNombreEvento.value = titulo || ""
    if (modalCalendarioEliminar) modalCalendarioEliminar.hidden = !eventoId
    modalCalendario.classList.add("visible")
    setTimeout(() => inputNombreEvento.focus(), 40)
  }

  const cerrarModalEvento = () => {
    if (!modalCalendario || !inputNombreEvento) return
    modalCalendario.classList.remove("visible")
    inputNombreEvento.value = ""
    eventoEditandoId = null
    if (modalCalendarioEliminar) modalCalendarioEliminar.hidden = true
  }

  const copiarEventoSeleccionado = calendar => {
    if (!eventoSeleccionadoId) return false
    const evento = calendar.getEventById(eventoSeleccionadoId)
    if (!evento) return false
    eventoCopiado = {
      title: evento.title,
      allDay: true,
      completed: Boolean(evento.extendedProps.completed)
    }
    return true
  }

  const pegarEvento = calendar => {
    if (!eventoCopiado || !fechaSeleccionada) return false
    calendar.addEvent({
      id: `evento-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: eventoCopiado.title,
      start: fechaSeleccionada,
      allDay: true,
      extendedProps: { completed: Boolean(eventoCopiado.completed) }
    })
    guardarEventos(calendar)
    return true
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    height: "auto",
    selectable: true,
    editable: true,
    eventStartEditable: true,
    eventDurationEditable: false,
    forceEventDuration: true,
    defaultTimedEventDuration: "01:00:00",
    buttonText: {
      today: "Hoy",
      month: "Mes",
      week: "Semana",
      day: "Día",
      list: "Lista"
    },
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay"
    },
    events: leerEventos(),
    dateClick(info) {
      fechaSeleccionada = info.dateStr
      if ((info.jsEvent?.detail || 1) >= 2) {
        abrirModalEvento({ titulo: "", fecha: info.dateStr })
      }
    },
    eventClick(info) {
      info.jsEvent.preventDefault()
      eventoSeleccionadoId = info.event.id
      fechaSeleccionada = normalizarFecha(info.event.startStr)
      actualizarEventoActivoVisual()

      if (info.jsEvent.detail >= 2) {
        abrirModalEvento({
          titulo: info.event.title,
          fecha: info.event.startStr,
          eventoId: info.event.id
        })
      }
    },
    eventContent(arg) {
      const etiqueta = document.createElement("div")
      etiqueta.className = "fc-event-custom"

      const check = document.createElement("input")
      check.type = "checkbox"
      check.className = "fc-event-check"
      check.checked = Boolean(arg.event.extendedProps.completed)

      const titulo = document.createElement("span")
      titulo.className = "fc-event-title-custom"
      titulo.textContent = arg.event.title
      if (check.checked) titulo.classList.add("fc-event-title-done")

      check.addEventListener("click", e => e.stopPropagation())
      check.addEventListener("change", e => {
        e.stopPropagation()
        arg.event.setExtendedProp("completed", check.checked)
        guardarEventos(calendar)
      })

      etiqueta.appendChild(check)
      etiqueta.appendChild(titulo)
      return { domNodes: [etiqueta] }
    },
    eventDidMount(info) {
      info.el.dataset.eventoId = info.event.id
      if (info.event.extendedProps.completed) {
        info.el.classList.add("fc-event-done")
      } else {
        info.el.classList.remove("fc-event-done")
      }
      if (eventoSeleccionadoId && eventoSeleccionadoId === info.event.id) {
        info.el.classList.add("evento-activo")
      }
    },
    eventDragStart() {
      ocultarMenuCalendario()
    },
    eventDrop(info) {
      if (!info.event.allDay) {
        info.event.setAllDay(true, { maintainDuration: false })
      }
      guardarEventos(calendar)
      actualizarEventoActivoVisual()
    },
    eventAdd() {
      guardarEventos(calendar)
      actualizarEventoActivoVisual()
    },
    eventChange() {
      guardarEventos(calendar)
      actualizarEventoActivoVisual()
    },
    eventRemove() {
      guardarEventos(calendar)
      actualizarEventoActivoVisual()
    }
  })

  calendarEl.addEventListener("contextmenu", event => {
    const eventNode = event.target.closest(".fc-event")
    const dateNode = event.target.closest(".fc-daygrid-day[data-date], .fc-timegrid-col[data-date]")

    if (eventNode) {
      event.preventDefault()
      const eventId = eventNode.dataset.eventoId
      if (!eventId) return
      const evento = calendar.getEventById(eventId)
      if (!evento) return
      eventoSeleccionadoId = evento.id
      fechaSeleccionada = normalizarFecha(evento.startStr)
      actualizarEventoActivoVisual()
      mostrarMenuCalendario(event, {
        onCopy: () => copiarEventoSeleccionado(calendar),
        onPaste: () => pegarEvento(calendar)
      })
      return
    }

    if (dateNode) {
      event.preventDefault()
      fechaSeleccionada = dateNode.dataset.date || null
      mostrarMenuCalendario(event, {
        onPaste: () => pegarEvento(calendar)
      })
    }
  })

  modalCalendario?.addEventListener("click", e => {
    if (e.target === modalCalendario) cerrarModalEvento()
  })

  modalCalendarioCerrar?.addEventListener("click", cerrarModalEvento)

  inputNombreEvento?.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault()
      modalCalendarioGuardar?.click()
    }
  })

  modalCalendarioGuardar?.addEventListener("click", () => {
    const titulo = inputNombreEvento?.value.trim()
    if (!titulo || !fechaSeleccionada) {
      inputNombreEvento?.focus()
      return
    }

    if (eventoEditandoId) {
      const existente = calendar.getEventById(eventoEditandoId)
      if (existente) {
        existente.setProp("title", titulo)
      }
    } else {
      calendar.addEvent({
        id: `evento-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: titulo,
        start: fechaSeleccionada,
        allDay: true,
        extendedProps: { completed: false }
      })
    }

    guardarEventos(calendar)
    cerrarModalEvento()
  })

  modalCalendarioEliminar?.addEventListener("click", () => {
    if (!eventoEditandoId) return
    const evento = calendar.getEventById(eventoEditandoId)
    if (evento) {
      if (eventoSeleccionadoId === evento.id) eventoSeleccionadoId = null
      evento.remove()
    }
    guardarEventos(calendar)
    cerrarModalEvento()
  })

  document.addEventListener("click", event => {
    if (!menuCalendario || menuCalendario.menu.style.display === "none") return
    if (!menuCalendario.menu.contains(event.target)) ocultarMenuCalendario()
  })
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") ocultarMenuCalendario()
  })
  window.addEventListener("resize", ocultarMenuCalendario)
  window.addEventListener("scroll", ocultarMenuCalendario, true)

  calendar.render()
})
