(function () {
  const STORAGE_KEY = "calendarEvents"
  const DAYS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

  const panel = document.getElementById("calendarPanel")
  const monthLabel = document.getElementById("calendarMonthLabel")
  const weekdaysContainer = document.getElementById("calendarWeekdays")
  const grid = document.getElementById("calendarGrid")
  const prevBtn = document.getElementById("calendarPrevBtn")
  const nextBtn = document.getElementById("calendarNextBtn")

  if (!panel || !monthLabel || !weekdaysContainer || !grid || !prevBtn || !nextBtn) return

  let eventsByDate = loadEvents()
  let currentDate = new Date()
  let creatingEventDateKey = null
  let copiedEvent = null
  let draggedEventRef = null
  let calendarMenu = null
  currentDate.setDate(1)

  renderWeekdays()
  renderCalendar()

  prevBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1)
    creatingEventDateKey = null
    renderCalendar()
  })

  nextBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1)
    creatingEventDateKey = null
    renderCalendar()
  })

  document.addEventListener("click", event => {
    if (!calendarMenu || calendarMenu.menu.style.display === "none") return
    if (!calendarMenu.menu.contains(event.target)) hideCalendarMenu()
  })

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") hideCalendarMenu()
  })

  window.addEventListener("resize", hideCalendarMenu)
  window.addEventListener("scroll", hideCalendarMenu, true)

  function loadEvents() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch (_error) {
      return {}
    }
  }

  function saveEvents() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsByDate))
  }

  function createCalendarMenu() {
    if (calendarMenu) return calendarMenu

    const menu = document.createElement("div")
    menu.className = "menu-contextual"

    const copyBtn = document.createElement("button")
    copyBtn.type = "button"
    copyBtn.textContent = "Copiar evento"

    const pasteBtn = document.createElement("button")
    pasteBtn.type = "button"
    pasteBtn.textContent = "Pegar en este día"

    menu.appendChild(copyBtn)
    menu.appendChild(pasteBtn)
    document.body.appendChild(menu)

    calendarMenu = { menu, copyBtn, pasteBtn }
    return calendarMenu
  }

  function hideCalendarMenu() {
    if (!calendarMenu) return
    calendarMenu.menu.style.display = "none"
    calendarMenu.copyBtn.onclick = null
    calendarMenu.pasteBtn.onclick = null
  }

  function showCalendarMenu(event, handlers = {}) {
    const { menu, copyBtn, pasteBtn } = createCalendarMenu()

    copyBtn.disabled = !handlers.onCopy
    pasteBtn.disabled = !handlers.onPaste || !copiedEvent

    copyBtn.onclick = () => {
      if (!handlers.onCopy) return
      handlers.onCopy()
      hideCalendarMenu()
    }

    pasteBtn.onclick = () => {
      if (!handlers.onPaste || !copiedEvent) return
      handlers.onPaste()
      hideCalendarMenu()
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

  function copyEvent(eventData) {
    copiedEvent = {
      text: eventData.text || "",
      completed: Boolean(eventData.completed)
    }
  }

  function pasteEventInDate(dateKey) {
    if (!copiedEvent) return
    const nextEvents = Array.isArray(eventsByDate[dateKey]) ? [...eventsByDate[dateKey]] : []
    nextEvents.push({ ...copiedEvent })
    eventsByDate[dateKey] = nextEvents
    saveEvents()
    renderCalendar()
  }

  function moveEventToDate(fromDateKey, eventIndex, toDateKey) {
    if (!fromDateKey || !toDateKey) return
    const fromList = Array.isArray(eventsByDate[fromDateKey]) ? [...eventsByDate[fromDateKey]] : []
    if (!fromList[eventIndex]) return

    const [eventData] = fromList.splice(eventIndex, 1)
    const toList = Array.isArray(eventsByDate[toDateKey]) ? [...eventsByDate[toDateKey]] : []
    toList.push(eventData)

    if (fromList.length) {
      eventsByDate[fromDateKey] = fromList
    } else {
      delete eventsByDate[fromDateKey]
    }
    eventsByDate[toDateKey] = toList

    saveEvents()
    renderCalendar()
  }

  function renderWeekdays() {
    weekdaysContainer.innerHTML = ""
    DAYS_ES.forEach(day => {
      const el = document.createElement("div")
      el.className = "calendar-weekday"
      el.textContent = day
      weekdaysContainer.appendChild(el)
    })
  }

  function formatDateKey(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  function renderCalendar() {
    const monthFormatter = new Intl.DateTimeFormat("es-ES", {
      month: "long",
      year: "numeric"
    })

    const monthText = monthFormatter.format(currentDate)
    monthLabel.textContent = monthText.charAt(0).toUpperCase() + monthText.slice(1)
    hideCalendarMenu()
    grid.innerHTML = ""

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const startOffset = (firstDay.getDay() + 6) % 7

    for (let i = 0; i < startOffset; i += 1) {
      const outsideDate = new Date(year, month, -startOffset + i + 1)
      grid.appendChild(createDayCell(outsideDate, true))
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day)
      grid.appendChild(createDayCell(date, false))
    }

    const totalCells = grid.childElementCount
    const remain = (7 - (totalCells % 7)) % 7

    for (let i = 1; i <= remain; i += 1) {
      const outsideDate = new Date(year, month + 1, i)
      grid.appendChild(createDayCell(outsideDate, true))
    }

    if (creatingEventDateKey) {
      const inputToFocus = grid.querySelector(`.calendar-event-editor[data-date-key="${creatingEventDateKey}"] .calendar-event-editor-input`)
      inputToFocus?.focus()
    }
  }

  function createDayCell(date, outsideMonth) {
    const cell = document.createElement("div")
    cell.className = "calendar-day"
    if (outsideMonth) cell.classList.add("calendar-day--outside")

    const today = new Date()
    if (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    ) {
      cell.classList.add("calendar-day--today")
    }

    const number = document.createElement("div")
    number.className = "calendar-day-number"
    number.textContent = String(date.getDate())
    cell.appendChild(number)

    const eventsWrap = document.createElement("div")
    eventsWrap.className = "calendar-events"
    cell.appendChild(eventsWrap)

    const dateKey = formatDateKey(date)
    const events = Array.isArray(eventsByDate[dateKey]) ? eventsByDate[dateKey] : []

    events.forEach((event, index) => {
      eventsWrap.appendChild(createEventElement(dateKey, event, index))
    })

    if (!outsideMonth && creatingEventDateKey === dateKey) {
      eventsWrap.appendChild(createEventEditor(dateKey))
    }

    if (!outsideMonth) {
      cell.setAttribute("role", "button")
      cell.setAttribute("tabindex", "0")
      cell.setAttribute("aria-label", `Agregar evento para el día ${date.getDate()}`)

      const openEditor = () => {
        creatingEventDateKey = dateKey
        renderCalendar()
      }

      cell.addEventListener("click", () => {
        if (creatingEventDateKey === dateKey) return
        openEditor()
      })

      cell.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          if (creatingEventDateKey === dateKey) return
          openEditor()
        }
      })

      cell.addEventListener("contextmenu", e => {
        e.preventDefault()
        showCalendarMenu(e, {
          onPaste: () => pasteEventInDate(dateKey)
        })
      })

      cell.addEventListener("dragover", e => {
        if (!draggedEventRef) return
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
      })

      cell.addEventListener("drop", e => {
        if (!draggedEventRef) return
        e.preventDefault()
        e.stopPropagation()
        const { fromDateKey, eventIndex } = draggedEventRef
        draggedEventRef = null
        moveEventToDate(fromDateKey, eventIndex, dateKey)
      })
    }

    return cell
  }

  function createEventEditor(dateKey) {
    const wrapper = document.createElement("div")
    wrapper.className = "calendar-event-editor"
    wrapper.dataset.dateKey = dateKey
    wrapper.addEventListener("click", e => e.stopPropagation())

    const input = document.createElement("input")
    input.type = "text"
    input.className = "calendar-event-editor-input"
    input.placeholder = "Escribe un evento"
    input.setAttribute("aria-label", "Nuevo evento")

    const actions = document.createElement("div")
    actions.className = "calendar-event-editor-actions"

    const saveBtn = document.createElement("button")
    saveBtn.type = "button"
    saveBtn.className = "calendar-event-editor-save"
    saveBtn.textContent = "Guardar"

    const cancelBtn = document.createElement("button")
    cancelBtn.type = "button"
    cancelBtn.className = "calendar-event-editor-cancel"
    cancelBtn.textContent = "Cancelar"

    const closeEditor = () => {
      creatingEventDateKey = null
      renderCalendar()
    }

    const saveEvent = () => {
      const cleanText = input.value.trim()
      if (!cleanText) {
        input.focus()
        return
      }

      const nextEvents = Array.isArray(eventsByDate[dateKey]) ? [...eventsByDate[dateKey]] : []
      nextEvents.push({ text: cleanText, completed: false })
      eventsByDate[dateKey] = nextEvents
      saveEvents()
      creatingEventDateKey = null
      renderCalendar()
    }

    saveBtn.addEventListener("click", saveEvent)
    cancelBtn.addEventListener("click", closeEditor)
    input.addEventListener("keydown", e => {
      e.stopPropagation()
      if (e.key === "Enter") {
        e.preventDefault()
        saveEvent()
      }
      if (e.key === "Escape") {
        e.preventDefault()
        closeEditor()
      }
    })

    actions.appendChild(saveBtn)
    actions.appendChild(cancelBtn)
    wrapper.appendChild(input)
    wrapper.appendChild(actions)

    return wrapper
  }

  function createEventElement(dateKey, event, index) {
    const row = document.createElement("div")
    row.className = "calendar-event"
    row.draggable = true
    if (event.completed) row.classList.add("completed")

    row.addEventListener("click", e => e.stopPropagation())
    row.addEventListener("dragstart", e => {
      draggedEventRef = { fromDateKey: dateKey, eventIndex: index }
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", `${dateKey}:${index}`)
      }
    })
    row.addEventListener("dragend", () => {
      draggedEventRef = null
    })
    row.addEventListener("contextmenu", e => {
      e.preventDefault()
      e.stopPropagation()
      showCalendarMenu(e, {
        onCopy: () => copyEvent(event),
        onPaste: () => pasteEventInDate(dateKey)
      })
    })

    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.className = "calendar-event-checkbox"
    checkbox.checked = Boolean(event.completed)
    checkbox.addEventListener("change", () => {
      const list = Array.isArray(eventsByDate[dateKey]) ? [...eventsByDate[dateKey]] : []
      if (!list[index]) return
      list[index] = { ...list[index], completed: checkbox.checked }
      eventsByDate[dateKey] = list
      saveEvents()
      renderCalendar()
    })

    const input = document.createElement("textarea")
    input.className = "calendar-event-text"
    input.rows = 1
    input.value = event.text || ""
    input.setAttribute("aria-label", "Editar evento")

    const autoResize = () => {
      input.style.height = "auto"
      input.style.height = `${input.scrollHeight}px`
    }

    input.addEventListener("click", e => e.stopPropagation())
    input.addEventListener("keydown", e => e.stopPropagation())
    input.addEventListener("input", autoResize)
    input.addEventListener("change", () => {
      const list = Array.isArray(eventsByDate[dateKey]) ? [...eventsByDate[dateKey]] : []
      if (!list[index]) return
      const newText = input.value.trim()
      if (!newText) {
        input.value = list[index].text || ""
        autoResize()
        return
      }
      list[index] = { ...list[index], text: newText }
      eventsByDate[dateKey] = list
      saveEvents()
      renderCalendar()
    })

    const del = document.createElement("button")
    del.type = "button"
    del.className = "calendar-event-delete"
    del.textContent = "✕"
    del.setAttribute("aria-label", "Eliminar evento")
    del.addEventListener("click", () => {
      const list = Array.isArray(eventsByDate[dateKey]) ? [...eventsByDate[dateKey]] : []
      if (!list[index]) return
      list.splice(index, 1)
      if (list.length) {
        eventsByDate[dateKey] = list
      } else {
        delete eventsByDate[dateKey]
      }
      saveEvents()
      renderCalendar()
    })

    row.appendChild(checkbox)
    row.appendChild(input)
    row.appendChild(del)

    requestAnimationFrame(autoResize)
    return row
  }
})()
