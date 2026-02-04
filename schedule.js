(function(){
  const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes']
  const STORAGE_KEY = 'horarioClases'
  const TITLE_STORAGE_KEY = 'horarioTitulo'

  function $(s, root=document) { return root.querySelector(s) }
  function $all(s, root=document) { return Array.from(root.querySelectorAll(s)) }

  function cargarHorario() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return DAYS.map(()=>[])
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return DAYS.map(()=>[])
      return parsed
    } catch(e) { return DAYS.map(()=>[]) }
  }

  function guardarHorario(h) { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)) }

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

  // create read-only card for a class
  function crearElementoClase(item) {
    const li = document.createElement('li')
    li.className = 'class-card'
    li.draggable = true
    li.dataset.id = item.id
    // apply background color if present
    if (item.bgColor) li.style.background = item.bgColor

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

    // color picker removed — simplified card actions

    return li
  }

  

  function crearEditorNodo(values, onSave, onCancel){
    const li = document.createElement('li')
    li.className = 'class-editor'
    const colorValue = values.bgColor || '#ffffff'
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
        <input class="editor-color-input" type="color" value="${escapeHtml(colorValue)}" aria-label="Seleccionar color">
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
      const bgColor = li.querySelector('.editor-color-input').value
      if (!nombre || !nombre.trim()) { li.querySelector('.editor-name').focus(); return }
      onSave({ name: nombre.trim(), time: time.trim(), teacher: teacher.trim(), absences, bgColor })
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

  function render() {
    $all('.schedule-list').forEach(ul => ul.innerHTML = '')
    horario.forEach((dia, idx) => {
      const ul = document.querySelector(`.schedule-list[data-day-index="${idx}"]`)
      if (!ul) return
      dia.forEach(item => ul.appendChild(crearElementoClase(item)))
    })
    attachListHandlers()
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

      ul.ondrop = function(e){
        e.preventDefault()
        const id = e.dataTransfer.getData('text/plain')
        if (!id) return
        const fromIndex = findIndexOfId(id)
        const toIndex = parseInt(ul.dataset.dayIndex,10)
        if (fromIndex == null || isNaN(toIndex)) return

        const item = horario[fromIndex].find(it=>it.id===id)
        if (!item) return

        horario[fromIndex] = horario[fromIndex].filter(it=>it.id!==id)

        // determine position within target based on DOM order
        const children = Array.from(ul.children).filter(n=>n.classList.contains('class-card'))
        const positions = children.map(n => n.dataset.id)
        const pos = positions.indexOf(id)
        if (pos === -1) {
          horario[toIndex].push(item)
        } else {
          horario[toIndex].splice(pos, 0, item)
        }

        guardarHorario(horario)
        render()
      }
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

  function findIndexOfId(id){
    for (let i=0;i<horario.length;i++){
      if (horario[i].some(it=>it.id===id)) return i
    }
    return null
  }

  function eliminarClasePorId(id){
    horario = horario.map(d=>d.filter(it=>it.id!==id))
    guardarHorario(horario)
    render()
  }

  function agregarClaseObj(obj, diaIndex){
    const item = { id: String(Date.now()) + Math.random().toString(36).slice(2,6), name: obj.name || '', time: obj.time || '', teacher: obj.teacher || '', absences: Number(obj.absences || 0), bgColor: obj.bgColor || '' }
    horario[diaIndex].push(item)
    guardarHorario(horario)
    render()
  }

  // init DOM handlers
  document.addEventListener('DOMContentLoaded', ()=>{
    if (!Array.isArray(horario) || horario.length !== DAYS.length) horario = DAYS.map(()=>[])

    render()

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

    // add button per day: insert inline editor
    $all('.day-add').forEach(btn => {
      btn.addEventListener('click', ()=>{
        const idx = parseInt(btn.dataset.dayIndex, 10)
        const ul = document.querySelector(`.schedule-list[data-day-index="${idx}"]`)
        if (!ul) return

        // allow multiple editors: always insert a new editor
        const editor = crearEditorNodo({}, (vals)=>{
          agregarClaseObj(vals, idx)
        }, ()=>{ render() })

        ul.insertBefore(editor, ul.firstChild)
        editor.querySelector('.editor-name').focus()
      })
    })
  })
})();
