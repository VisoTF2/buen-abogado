(function(){
  const DAY_DEFS = [
    { id: 'lunes', label: 'Lunes' },
    { id: 'martes', label: 'Martes' },
    { id: 'miercoles', label: 'Miércoles' },
    { id: 'jueves', label: 'Jueves' },
    { id: 'viernes', label: 'Viernes' },
    { id: 'sabado', label: 'Sábado' },
    { id: 'domingo', label: 'Domingo' },
  ]
  const DEFAULT_ACTIVE_DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
  const STORAGE_KEY = 'horarioClases'
  const TITLE_STORAGE_KEY = 'horarioTitulo'
  const ACTIVE_DAYS_KEY = 'horarioDiasActivos'

  function $(s, root=document) { return root.querySelector(s) }
  function $all(s, root=document) { return Array.from(root.querySelectorAll(s)) }

  function createEmptySchedule() {
    return DAY_DEFS.reduce((acc, day) => {
      acc[day.id] = []
      return acc
    }, {})
  }

  function normalizarHorario(parsed) {
    const schedule = createEmptySchedule()
    if (Array.isArray(parsed)) {
      DEFAULT_ACTIVE_DAYS.forEach((dayId, idx) => {
        if (Array.isArray(parsed[idx])) schedule[dayId] = deduplicarClasesPorId(parsed[idx])
      })
      return schedule
    }
    if (parsed && typeof parsed === 'object') {
      DAY_DEFS.forEach(day => {
        if (Array.isArray(parsed[day.id])) schedule[day.id] = deduplicarClasesPorId(parsed[day.id])
      })
      return schedule
    }
    return schedule
  }

  function cargarHorario() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return createEmptySchedule()
      return normalizarHorario(JSON.parse(raw))
    } catch (e) {
      return createEmptySchedule()
    }
  }

  function guardarHorario(h) { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)) }

  function cargarDiasActivos() {
    try {
      const raw = localStorage.getItem(ACTIVE_DAYS_KEY)
      if (!raw) return [...DEFAULT_ACTIVE_DAYS]
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return [...DEFAULT_ACTIVE_DAYS]
      const valid = parsed.filter(dayId => DAY_DEFS.some(day => day.id === dayId))
      return valid.length ? valid : []
    } catch (e) {
      return [...DEFAULT_ACTIVE_DAYS]
    }
  }

  function guardarDiasActivos(days) {
    localStorage.setItem(ACTIVE_DAYS_KEY, JSON.stringify(days))
  }

  function obtenerDiasActivosOrdenados() {
    return DAY_DEFS.filter(day => diasActivos.includes(day.id))
  }

  function cargarTituloHorario() {
    const raw = localStorage.getItem(TITLE_STORAGE_KEY)
    return raw ? raw : 'Horario semanal'
  }

  function guardarTituloHorario(texto) {
    localStorage.setItem(TITLE_STORAGE_KEY, texto)
  }

  function escapeHtml(s){
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  }

  function esColorBlanco(color) {
    if (!color) return true
    const normalized = String(color).trim().toLowerCase()
    return normalized === '#fff' || normalized === '#ffffff'
  }

  // create read-only card for a class
  function crearElementoClase(item) {
    const li = document.createElement('li')
    li.className = 'class-card'
    li.draggable = true
    li.dataset.id = item.id
    // apply background color if present
    if (item.bgColor && !esColorBlanco(item.bgColor)) {
      li.style.background = item.bgColor
    }

    li.innerHTML = `
      <div class="class-main">
        <div class="class-name">${escapeHtml(item.name)}</div>
        <div class="class-meta">
          <span class="class-time">${escapeHtml(item.time || '')}</span>
          ${item.teacher ? `<span class="class-teacher">• ${escapeHtml(item.teacher)}</span>` : ''}
        </div>
      </div>
      <div class="class-actions">
        <div class="absences">Faltas: <strong>${Number(item.absences || 0)}</strong></div>
        <div class="action-buttons">
          <button class="edit-btn" aria-label="Editar">✎</button>
          <button class="class-delete" aria-label="Eliminar clase">✕</button>
        </div>
      </div>
    `

    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', item.id)
      li.classList.add('dragging')
    })
    li.addEventListener('dragend', () => li.classList.remove('dragging'))

    li.querySelector('.class-delete').addEventListener('click', () => eliminarClasePorId(item.id))

    li.querySelector('.edit-btn').addEventListener('click', () => abrirEditorEditar(li, item))

    li.addEventListener('contextmenu', event => {
      if (haySeleccionTextoEnElemento(li)) return
      event.preventDefault()
      const dayId = findDayIdOfId(item.id)
      if (!dayId) return
      mostrarMenuHorario(event, {
        onCopy: () => copiarClase(item),
        onPaste: () => pegarClaseEnDia(dayId),
      })
    })

    // color picker removed — simplified card actions

    return li
  }

  

  function haySeleccionTextoEnElemento(elemento) {
    const selection = window.getSelection && window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return false
    const anchorNode = selection.anchorNode
    const focusNode = selection.focusNode
    const contieneAnchor = anchorNode && elemento.contains(anchorNode)
    const contieneFocus = focusNode && elemento.contains(focusNode)
    return Boolean(contieneAnchor || contieneFocus)
  }

  function crearEditorNodo(values, onSave, onCancel){
    const li = document.createElement('li')
    li.className = 'class-editor'
    li.innerHTML = `
      <div class="editor-row">
        <input class="editor-name" placeholder="Clase" value="${escapeHtml(values.name || '')}">
        <input class="editor-time" placeholder="Hora" value="${escapeHtml(values.time || '')}">
      </div>
      <div class="editor-row">
        <input class="editor-teacher" placeholder="Profesor" value="${escapeHtml(values.teacher || '')}">
        <input class="editor-absences" type="number" min="0" placeholder="Faltas" value="${escapeHtml(values.absences || 0)}">
      </div>
      <div class="editor-actions">
        <div class="editor-buttons">
          <button type="button" class="editor-save">Guardar</button>
          <button type="button" class="editor-cancel">Cancelar</button>
        </div>
      </div>
    `

    li.querySelector('.editor-save').addEventListener('click', ()=>{
      const nombre = li.querySelector('.editor-name').value
      const time = li.querySelector('.editor-time').value
      const teacher = li.querySelector('.editor-teacher').value
      const absences = parseInt(li.querySelector('.editor-absences').value || '0', 10) || 0
      if (!nombre || !nombre.trim()) { li.querySelector('.editor-name').focus(); return }
      onSave({
        name: nombre.trim(),
        time: time.trim(),
        teacher: teacher.trim(),
        absences,
        bgColor: values.bgColor || '',
      })
    })

    li.querySelector('.editor-cancel').addEventListener('click', ()=>{
      onCancel()
    })

    return li
  }

  function abrirEditorEditar(liElem, item){
    const parent = liElem.parentElement
    const editor = crearEditorNodo(item, (vals)=>{
      // update item
      item.name = vals.name
      item.time = vals.time
      item.teacher = vals.teacher
      item.absences = vals.absences
      item.bgColor = vals.bgColor
      guardarHorario(horario)
      render()
    }, ()=>{
      render()
    })

    parent.insertBefore(editor, liElem)
    parent.removeChild(liElem)
    editor.querySelector('.editor-name').focus()
  }

  let horario = cargarHorario()
  let diasActivos = cargarDiasActivos()
  let claseCopiada = null
  let menuHorario = null

  function crearMenuHorario() {
    if (menuHorario) return menuHorario

    const menu = document.createElement('div')
    menu.className = 'menu-contextual'

    const btnCopiar = document.createElement('button')
    btnCopiar.type = 'button'
    btnCopiar.textContent = 'Copiar tarjeta'

    const btnPegar = document.createElement('button')
    btnPegar.type = 'button'
    btnPegar.textContent = 'Pegar en este día'

    menu.appendChild(btnCopiar)
    menu.appendChild(btnPegar)
    document.body.appendChild(menu)

    menuHorario = { menu, btnCopiar, btnPegar }
    return menuHorario
  }

  function ocultarMenuHorario() {
    if (!menuHorario) return
    menuHorario.menu.style.display = 'none'
    menuHorario.btnCopiar.onclick = null
    menuHorario.btnPegar.onclick = null
  }

  function mostrarMenuHorario(event, handlers = {}) {
    const { menu, btnCopiar, btnPegar } = crearMenuHorario()

    btnCopiar.disabled = !handlers.onCopy
    btnPegar.disabled = !handlers.onPaste || !claseCopiada

    btnCopiar.onclick = () => {
      if (!handlers.onCopy) return
      handlers.onCopy()
      ocultarMenuHorario()
    }

    btnPegar.onclick = () => {
      if (!handlers.onPaste || !claseCopiada) return
      handlers.onPaste()
      ocultarMenuHorario()
    }

    menu.style.display = 'flex'
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

  function copiarClase(item) {
    claseCopiada = {
      name: item.name || '',
      time: item.time || '',
      teacher: item.teacher || '',
      absences: Number(item.absences || 0),
      bgColor: item.bgColor || '',
    }
  }

  function pegarClaseEnDia(dayId) {
    if (!claseCopiada) return
    agregarClaseObj(claseCopiada, dayId)
  }

  function renderScheduleGrid() {
    const grid = document.getElementById('scheduleGrid')
    if (!grid) return
    const days = obtenerDiasActivosOrdenados()
    grid.innerHTML = ''
    days.forEach(day => {
      const dayColumn = document.createElement('div')
      dayColumn.className = 'schedule-day'
      dayColumn.dataset.dayId = day.id

      const head = document.createElement('div')
      head.className = 'schedule-day-head'
      head.textContent = day.label

      const addButton = document.createElement('button')
      addButton.className = 'day-add'
      addButton.type = 'button'
      addButton.dataset.dayId = day.id
      addButton.setAttribute('aria-label', 'Agregar clase')
      addButton.textContent = '+'
      head.appendChild(addButton)

      const list = document.createElement('ul')
      list.className = 'schedule-list'
      list.dataset.dayId = day.id

      dayColumn.appendChild(head)
      dayColumn.appendChild(list)
      grid.appendChild(dayColumn)
    })
  }

  function render() {
    renderScheduleGrid()
    $all('.schedule-list').forEach(ul => ul.innerHTML = '')
    obtenerDiasActivosOrdenados().forEach(day => {
      const ul = document.querySelector(`.schedule-list[data-day-id="${day.id}"]`)
      if (!ul) return
      (horario[day.id] || []).forEach(item => ul.appendChild(crearElementoClase(item)))
    })
    attachListHandlers()
    attachAddHandlers()
  }

  function attachListHandlers(){
    $all('.schedule-list').forEach(ul => {
      ul.ondragover = function(e){
        e.preventDefault();
        const after = getDragAfterElement(ul, e.clientY)
        const draggingNode = document.querySelector(`.class-card.dragging`)
        if (!draggingNode) return
        if (after == null) {
          ul.appendChild(draggingNode)
        } else {
          ul.insertBefore(draggingNode, after)
        }
      }

      ul.oncontextmenu = function(e) {
        if (e.target.closest('.class-card')) return
        e.preventDefault()
        const dayId = ul.dataset.dayId
        if (!dayId) return
        mostrarMenuHorario(e, {
          onPaste: () => pegarClaseEnDia(dayId),
        })
      }

      ul.ondrop = function(e){
        e.preventDefault()
        const id = e.dataTransfer.getData('text/plain')
        if (!id) return

        const fromDayId = findDayIdOfId(id)
        const toDayId = ul.dataset.dayId
        if (!fromDayId || !toDayId) return

        const itemMovido = (horario[fromDayId] || []).find(it => it.id === id)
        if (!itemMovido) return

        const uniqueIds = ids => {
          const vistos = new Set()
          return ids.filter(classId => {
            if (!classId || vistos.has(classId)) return false
            vistos.add(classId)
            return true
          })
        }

        const idsDestino = uniqueIds(Array.from(ul.querySelectorAll('.class-card')).map(node => node.dataset.id))

        if (fromDayId === toDayId) {
          const porId = new Map((horario[toDayId] || []).map(it => [it.id, it]))
          horario[toDayId] = idsDestino.map(classId => porId.get(classId)).filter(Boolean)
        } else {
          const listaOrigen = document.querySelector(`.schedule-list[data-day-id="${fromDayId}"]`)
          const idsOrigen = uniqueIds(
            Array.from(listaOrigen?.querySelectorAll('.class-card') || []).map(node => node.dataset.id)
          )

          const pool = new Map([
            ...(horario[fromDayId] || []),
            ...(horario[toDayId] || [])
          ].map(it => [it.id, it]))
          pool.set(itemMovido.id, itemMovido)

          horario[fromDayId] = idsOrigen.map(classId => pool.get(classId)).filter(Boolean)
          horario[toDayId] = idsDestino.map(classId => pool.get(classId)).filter(Boolean)
        }

        DAY_DEFS.forEach(day => {
          horario[day.id] = deduplicarClasesPorId(horario[day.id])
        })

        guardarHorario(horario)
        render()
      }
    })
  }

  function deduplicarClasesPorId(lista) {
    const vistos = new Set()
    return (lista || []).filter(item => {
      if (!item || !item.id || vistos.has(item.id)) return false
      vistos.add(item.id)
      return true
    })
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.class-card:not(.dragging)')]

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect()
      const offset = y - box.top - box.height / 2
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child }
      } else {
        return closest
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element
  }

  function findDayIdOfId(id){
    return DAY_DEFS.find(day => (horario[day.id] || []).some(it=>it.id===id))?.id || null
  }

  function eliminarClasePorId(id){
    DAY_DEFS.forEach(day => {
      horario[day.id] = (horario[day.id] || []).filter(it=>it.id!==id)
    })
    guardarHorario(horario)
    render()
  }

  function agregarClaseObj(obj, dayId){
    const item = { id: String(Date.now()) + Math.random().toString(36).slice(2,6), name: obj.name || '', time: obj.time || '', teacher: obj.teacher || '', absences: Number(obj.absences || 0), bgColor: obj.bgColor || '' }
    horario[dayId].push(item)
    guardarHorario(horario)
    render()
  }

  function attachAddHandlers() {
    $all('.day-add').forEach(btn => {
      btn.addEventListener('click', ()=>{
        const dayId = btn.dataset.dayId
        const ul = document.querySelector(`.schedule-list[data-day-id="${dayId}"]`)
        if (!ul) return

        // allow multiple editors: always insert a new editor
        const editor = crearEditorNodo({}, (vals)=>{
          agregarClaseObj(vals, dayId)
        }, ()=>{ render() })

        ul.insertBefore(editor, ul.firstChild)
        editor.querySelector('.editor-name').focus()
      })
    })
  }

  function renderDayOptions() {
    const optionsRoot = document.getElementById('scheduleDayOptions')
    if (!optionsRoot) return
    optionsRoot.innerHTML = ''
    DAY_DEFS.forEach(day => {
      const label = document.createElement('label')
      label.className = 'config-option'

      const input = document.createElement('input')
      input.type = 'checkbox'
      input.checked = diasActivos.includes(day.id)
      input.dataset.dayId = day.id
      input.addEventListener('change', () => {
        const isActive = input.checked
        if (isActive && !diasActivos.includes(day.id)) {
          diasActivos = [...diasActivos, day.id]
        }
        if (!isActive && diasActivos.includes(day.id)) {
          diasActivos = diasActivos.filter(id => id !== day.id)
        }
        diasActivos = DAY_DEFS.filter(d => diasActivos.includes(d.id)).map(d => d.id)
        guardarDiasActivos(diasActivos)
        render()
      })

      const text = document.createElement('span')
      text.textContent = day.label

      label.appendChild(input)
      label.appendChild(text)
      optionsRoot.appendChild(label)
    })
  }

  // init DOM handlers
  document.addEventListener('DOMContentLoaded', ()=>{
    if (!horario || typeof horario !== 'object') horario = createEmptySchedule()

    render()
    renderDayOptions()

    document.addEventListener('click', event => {
      if (!menuHorario || menuHorario.menu.style.display === 'none') return
      if (!menuHorario.menu.contains(event.target)) ocultarMenuHorario()
    })
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') ocultarMenuHorario()
    })
    window.addEventListener('resize', ocultarMenuHorario)
    window.addEventListener('scroll', ocultarMenuHorario, true)

    const titleNode = document.getElementById('weeklyScheduleTitle')
    if (titleNode) {
      titleNode.textContent = cargarTituloHorario()
      titleNode.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          titleNode.blur()
        }
      })
      titleNode.addEventListener('blur', () => {
        const nuevoTitulo = titleNode.textContent.trim() || 'Horario semanal'
        titleNode.textContent = nuevoTitulo
        guardarTituloHorario(nuevoTitulo)
      })
    }

  })
})();