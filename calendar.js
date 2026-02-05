document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar")
  if (!calendarEl || typeof FullCalendar === "undefined") return

  const STORAGE_KEY = "calendarEvents"

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
      const titulo = window.prompt(
        `Nuevo evento para ${info.dateStr}\n\nEscribe el título del evento:`
      )
      if (!titulo) return

      const limpio = titulo.trim()
      if (!limpio) return

      calendar.addEvent({
        id: `evento-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: limpio,
        start: info.dateStr,
        allDay: true,
        extendedProps: { completed: false }
      })
      guardarEventos(calendar)
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
    eventChange() {
      guardarEventos(calendar)
    }
  })

  calendar.render()
})
