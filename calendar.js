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

  const abrirModalEvento = ({ titulo, fecha, eventoId = null }) => {
    if (!modalCalendario || !modalCalendarioTitulo || !inputNombreEvento) return
    fechaSeleccionada = fecha
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
    fechaSeleccionada = null
    eventoEditandoId = null
    if (modalCalendarioEliminar) modalCalendarioEliminar.hidden = true
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    height: "auto",
    selectable: true,
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
      abrirModalEvento({ titulo: "", fecha: info.dateStr })
    },
    eventClick(info) {
      info.jsEvent.preventDefault()
      abrirModalEvento({
        titulo: info.event.title,
        fecha: info.event.startStr,
        eventoId: info.event.id
      })
    },
    eventContent(arg) {
      const checkboxId = `calendar-check-${arg.event.id}`
      const etiqueta = document.createElement("label")
      etiqueta.className = "fc-event-custom"
      etiqueta.setAttribute("for", checkboxId)

      const check = document.createElement("input")
      check.type = "checkbox"
      check.id = checkboxId
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
      if (info.event.extendedProps.completed) {
        info.el.classList.add("fc-event-done")
      } else {
        info.el.classList.remove("fc-event-done")
      }
    },
    eventAdd() {
      guardarEventos(calendar)
    },
    eventChange() {
      guardarEventos(calendar)
    },
    eventRemove() {
      guardarEventos(calendar)
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
    if (evento) evento.remove()
    guardarEventos(calendar)
    cerrarModalEvento()
  })

  calendar.render()
})
