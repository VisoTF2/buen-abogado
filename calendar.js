document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar")
  if (!calendarEl || typeof FullCalendar === "undefined") return

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    height: "auto",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay"
    },
    events: [
      {
        title: "Evento de prueba",
        start: "2026-02-10"
      },
      {
        title: "Reunión",
        start: "2026-02-15T10:00:00"
      }
    ]
  })

  calendar.render()
})
