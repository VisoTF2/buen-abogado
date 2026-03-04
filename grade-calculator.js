(function () {
  const STORAGE_KEY = "gradeCalculatorSubjectsV2"

  const defaults = {
    controlsCount: 1,
    directPassGrade: 4.0,
    examThreshold: 3.5,
    exemptionThreshold: 5.5,
    examWeight: 30,
    controlsWeightForExam: 70
  }

  const panel = document.getElementById("gradeCalculatorPanel")
  const editorPanel = document.getElementById("gradeEditorPanel")
  const subjectsList = document.getElementById("gradeSubjectsList")
  const addSubjectBtn = document.getElementById("gradeAddSubjectBtn")
  const subjectNameInput = document.getElementById("gradeSubjectNameInput")
  const selectedSubjectNameInput = document.getElementById("gradeSelectedSubjectName")
  const deleteSubjectBtn = document.getElementById("gradeDeleteSubjectBtn")

  const controlsContainer = document.getElementById("gradeControlsContainer")
  const controlsCountInput = document.getElementById("gradeControlsCount")
  const directPassInput = document.getElementById("directPassGrade")
  const examThresholdInput = document.getElementById("examThresholdGrade")
  const exemptionThresholdInput = document.getElementById("exemptionThresholdGrade")
  const examWeightInput = document.getElementById("examWeight")
  const controlsWeightForExamInput = document.getElementById("controlsWeightForExam")
  const validationBox = document.getElementById("gradeValidation")
  const addControlBtn = document.getElementById("addGradeControlBtn")

  const statusText = document.getElementById("gradeStatus")
  const currentAverageText = document.getElementById("gradeCurrentAverage")
  const needExamText = document.getElementById("gradeNeedExam")
  const remainingWithoutExamText = document.getElementById("gradeNeedForExemption")
  const remainingToFourText = document.getElementById("gradeNeedForFour")
  const neededExamText = document.getElementById("gradeNeedExamMin")
  const summaryDetails = document.querySelector(".grade-summary-details")

  if (
    !panel || !editorPanel || !subjectsList || !addSubjectBtn || !subjectNameInput || !selectedSubjectNameInput ||
    !deleteSubjectBtn || !controlsContainer || !controlsCountInput || !directPassInput ||
    !examThresholdInput || !exemptionThresholdInput || !examWeightInput || !controlsWeightForExamInput ||
    !validationBox || !statusText || !currentAverageText || !needExamText || !remainingWithoutExamText ||
    !remainingToFourText || !neededExamText
  ) return

  let state = loadState()
  let ramoArrastradoId = null
  let menuRamos = null

  bindEvents()
  renderAll()

  function bindEvents() {
    addSubjectBtn.addEventListener("click", createSubjectFromInput)
    subjectNameInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault()
        createSubjectFromInput()
      }
    })

    selectedSubjectNameInput.addEventListener("input", () => {
      const subject = getSelectedSubject()
      if (!subject) return
      subject.name = selectedSubjectNameInput.value.trimStart()
      saveState()
      renderSubjectsList(subject)
    })

    deleteSubjectBtn.addEventListener("click", () => {
      const subject = getSelectedSubject()
      if (!subject) return
      deleteSubjectById(subject.id)
    })

    document.addEventListener("click", event => {
      if (!menuRamos || menuRamos.menu.style.display === "none") return
      if (!menuRamos.menu.contains(event.target)) hideSubjectsMenu()
    })

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") hideSubjectsMenu()
    })

    window.addEventListener("resize", hideSubjectsMenu)
    window.addEventListener("scroll", hideSubjectsMenu, true)

    controlsCountInput.addEventListener("change", () => {
      const subject = getSelectedSubject()
      if (!subject) return
      setControlsCount(subject, Number(controlsCountInput.value) || 1)
      saveAndRender()
    })

    ;[directPassInput, examThresholdInput, exemptionThresholdInput, examWeightInput, controlsWeightForExamInput]
      .forEach(input => input.addEventListener("input", () => {
        const subject = getSelectedSubject()
        if (!subject) return
        syncConfigFromInputs(subject)
        saveState()
        renderSubjectMetrics(subject)
        renderSubjectsList(subject)
      }))

    if (addControlBtn) {
      addControlBtn.addEventListener("click", () => {
        const subject = getSelectedSubject()
        if (!subject) return
        setControlsCount(subject, subject.controls.length + 1)
        saveAndRender()
      })
    }

    subjectsList.addEventListener("dragover", event => {
      if (!ramoArrastradoId) return
      const target = event.target instanceof Element
        ? event.target.closest(".grade-subject-item")
        : null
      if (!(target instanceof HTMLElement)) return
      if (target.dataset.subjectId === ramoArrastradoId) return

      const dragged = subjectsList.querySelector(
        `.grade-subject-item[data-subject-id="${ramoArrastradoId}"]`
      )
      if (!(dragged instanceof HTMLElement)) return

      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move"

      const rect = target.getBoundingClientRect()
      const before = event.clientY < rect.top + rect.height / 2
      if (before) {
        subjectsList.insertBefore(dragged, target)
      } else {
        subjectsList.insertBefore(dragged, target.nextSibling)
      }
    })

    subjectsList.addEventListener("drop", event => {
      if (!ramoArrastradoId) return
      event.preventDefault()
      aplicarOrdenRamosDesdeDOM()
    })

    if (summaryDetails) {
      summaryDetails.addEventListener("toggle", () => {
        state.summaryExpanded = summaryDetails.open
        saveState()
      })
    }
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      if (!parsed || typeof parsed !== "object") throw new Error("invalid")
      const subjects = Array.isArray(parsed.subjects) ? parsed.subjects : []
      return {
        subjects: subjects.map(normalizeSubject),
        selectedSubjectId: parsed.selectedSubjectId || null,
        summaryExpanded: parsed.summaryExpanded !== false
      }
    } catch (_error) {
      return { subjects: [], selectedSubjectId: null, summaryExpanded: true }
    }
  }

  function normalizeSubject(raw) {
    const configRaw = raw && typeof raw.config === "object" ? raw.config : {}
    const controlsRaw = Array.isArray(raw?.controls) ? raw.controls : []
    const controls = controlsRaw.length
      ? controlsRaw.map(control => ({ grade: control?.grade ?? "", weight: control?.weight ?? "" }))
      : Array.from({ length: defaults.controlsCount }, () => ({ grade: "", weight: "" }))

    if (!controls.length) {
      controls.push({ grade: "", weight: "" })
    }

    return {
      id: String(raw?.id || `subject-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      name: String(raw?.name || "Ramo sin nombre"),
      createdAt: Number(raw?.createdAt) || Date.now(),
      controls,
      config: {
        directPassGrade: Number(configRaw.directPassGrade) || defaults.directPassGrade,
        examThreshold: Number(configRaw.examThreshold) || defaults.examThreshold,
        exemptionThreshold: Number(configRaw.exemptionThreshold) || defaults.exemptionThreshold,
        examWeight: Number(configRaw.examWeight) || defaults.examWeight,
        controlsWeightForExam: Number(configRaw.controlsWeightForExam) || defaults.controlsWeightForExam
      }
    }
  }

  function createSubjectFromInput() {
    const name = subjectNameInput.value.trim() || `Ramo ${state.subjects.length + 1}`
    const subject = createSubject(name)
    state.subjects.push(subject)
    state.selectedSubjectId = subject.id
    subjectNameInput.value = ""
    saveAndRender()
  }

  function createSubject(name) {
    return {
      id: `subject-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      createdAt: Date.now(),
      controls: Array.from({ length: defaults.controlsCount }, () => ({ grade: "", weight: "" })),
      config: {
        directPassGrade: defaults.directPassGrade,
        examThreshold: defaults.examThreshold,
        exemptionThreshold: defaults.exemptionThreshold,
        examWeight: defaults.examWeight,
        controlsWeightForExam: defaults.controlsWeightForExam
      }
    }
  }

  function getSelectedSubject() {
    return state.subjects.find(subject => subject.id === state.selectedSubjectId) || null
  }

  function setControlsCount(subject, count) {
    const safeCount = Math.max(1, Math.min(30, Math.floor(Number(count) || 1)))
    if (safeCount > subject.controls.length) {
      for (let i = subject.controls.length; i < safeCount; i += 1) {
        subject.controls.push({ grade: "", weight: "" })
      }
    } else if (safeCount < subject.controls.length) {
      subject.controls = subject.controls.slice(0, safeCount)
    }
  }

  function syncConfigFromInputs(subject) {
    subject.config.directPassGrade = Number(directPassInput.value) || defaults.directPassGrade
    subject.config.examThreshold = Number(examThresholdInput.value) || defaults.examThreshold
    subject.config.exemptionThreshold = Number(exemptionThresholdInput.value) || defaults.exemptionThreshold
    subject.config.examWeight = Number(examWeightInput.value) || defaults.examWeight
    subject.config.controlsWeightForExam = Number(controlsWeightForExamInput.value) || defaults.controlsWeightForExam
  }

  function renderAll() {
    if (!state.subjects.some(subject => subject.id === state.selectedSubjectId)) {
      state.selectedSubjectId = getMostRecentlyCreatedSubjectId(state.subjects)
    }

    if (summaryDetails) {
      summaryDetails.open = state.summaryExpanded !== false
    }

    const selected = getSelectedSubject()
    renderSubjectsList(selected)
    renderEditor(selected)
  }

  function deleteSubjectById(subjectId) {
    if (!subjectId) return
    state.subjects = state.subjects.filter(item => item.id !== subjectId)
    if (state.selectedSubjectId === subjectId) {
      state.selectedSubjectId = getMostRecentlyCreatedSubjectId(state.subjects)
    }
    saveAndRender()
  }

  function ensureSubjectsMenu() {
    if (menuRamos) return menuRamos

    const menu = document.createElement("div")
    menu.className = "menu-contextual"

    const deleteBtn = document.createElement("button")
    deleteBtn.type = "button"
    deleteBtn.className = "menu-contextual-delete"
    deleteBtn.textContent = "Borrar ramo"

    menu.appendChild(deleteBtn)
    document.body.appendChild(menu)

    menuRamos = { menu, deleteBtn, action: null }

    deleteBtn.addEventListener("click", () => {
      if (!menuRamos?.action) return
      menuRamos.action()
      hideSubjectsMenu()
    })

    return menuRamos
  }

  function hideSubjectsMenu() {
    if (!menuRamos) return
    menuRamos.menu.style.display = "none"
    menuRamos.action = null
  }

  function showSubjectsMenu(event, onDelete) {
    const { menu, deleteBtn } = ensureSubjectsMenu()
    menuRamos.action = typeof onDelete === "function" ? onDelete : null
    deleteBtn.disabled = !menuRamos.action

    menu.style.display = "flex"
    const margin = 12
    const width = menu.offsetWidth
    const height = menu.offsetHeight
    let x = event.clientX
    let y = event.clientY
    if (x + width + margin > window.innerWidth) x = window.innerWidth - width - margin
    if (y + height + margin > window.innerHeight) y = window.innerHeight - height - margin
    menu.style.left = `${Math.max(margin, x)}px`
    menu.style.top = `${Math.max(margin, y)}px`
  }

  function getMostRecentlyCreatedSubjectId(subjects) {
    if (!Array.isArray(subjects) || !subjects.length) return null

    const mostRecent = subjects.reduce((latest, current) => {
      if (!latest) return current
      const latestCreatedAt = Number(latest.createdAt) || 0
      const currentCreatedAt = Number(current.createdAt) || 0
      return currentCreatedAt >= latestCreatedAt ? current : latest
    }, null)

    return mostRecent?.id || null
  }

  function renderSubjectsList(selected) {
    hideSubjectsMenu()
    subjectsList.innerHTML = ""
    const sorted = state.subjects

    sorted.forEach(subject => {
      const metrics = evaluateSubject(subject)
      const item = document.createElement("button")
      item.type = "button"
      item.className = "grade-subject-item"
      if (selected && selected.id === subject.id) item.classList.add("is-active")
      item.dataset.subjectId = subject.id
      item.draggable = true

      item.innerHTML = `
        <strong>${escapeHtml(subject.name || "Ramo sin nombre")}</strong>
        <span>${metrics.displayAverage}</span>
        <small>${metrics.status}</small>
      `

      item.addEventListener("click", () => {
        state.selectedSubjectId = subject.id
        saveAndRender()
      })

      item.addEventListener("contextmenu", event => {
        event.preventDefault()
        event.stopPropagation()
        showSubjectsMenu(event, () => deleteSubjectById(subject.id))
      })

      item.addEventListener("dragstart", event => {
        ramoArrastradoId = subject.id
        item.classList.add("arrastrando")
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move"
          event.dataTransfer.setData("text/plain", subject.id)
        }
      })

      item.addEventListener("dragend", () => {
        item.classList.remove("arrastrando")
        aplicarOrdenRamosDesdeDOM()
        ramoArrastradoId = null
        subjectsList
          .querySelectorAll(".grade-subject-item.arrastrando")
          .forEach(el => el.classList.remove("arrastrando"))
      })

      subjectsList.appendChild(item)
    })
  }

  function aplicarOrdenRamosDesdeDOM() {
    const idsEnDOM = Array.from(subjectsList.querySelectorAll(".grade-subject-item"))
      .map(item => item.dataset.subjectId)
      .filter(Boolean)

    if (!idsEnDOM.length) return

    const mapa = new Map(state.subjects.map(subject => [subject.id, subject]))
    const reordenados = idsEnDOM
      .map(id => mapa.get(id))
      .filter(Boolean)

    if (reordenados.length !== state.subjects.length) return

    const cambio = reordenados.some((subject, index) => subject.id !== state.subjects[index]?.id)
    if (!cambio) return

    state.subjects = reordenados
    saveState()
    renderSubjectsList(getSelectedSubject())
  }

  function renderEditor(subject) {
    const isDisabled = !subject
    editorPanel.classList.toggle("is-disabled", isDisabled)

    if (isDisabled) {
      selectedSubjectNameInput.value = ""
      controlsContainer.innerHTML = ""
      validationBox.textContent = "Selecciona o crea un ramo para comenzar."
      statusText.textContent = "En progreso"
      currentAverageText.textContent = "—"
      needExamText.textContent = "Aún no definido"
      remainingWithoutExamText.textContent = "—"
      remainingToFourText.textContent = "—"
      neededExamText.textContent = "No aplica"
      return
    }

    selectedSubjectNameInput.disabled = false
    deleteSubjectBtn.disabled = false
    controlsCountInput.disabled = false
    directPassInput.disabled = false
    examThresholdInput.disabled = false
    exemptionThresholdInput.disabled = false
    examWeightInput.disabled = false
    controlsWeightForExamInput.disabled = false
    if (addControlBtn) addControlBtn.disabled = false

    selectedSubjectNameInput.value = subject.name
    controlsCountInput.value = subject.controls.length
    directPassInput.value = subject.config.directPassGrade
    examThresholdInput.value = subject.config.examThreshold
    exemptionThresholdInput.value = subject.config.exemptionThreshold
    examWeightInput.value = subject.config.examWeight
    controlsWeightForExamInput.value = subject.config.controlsWeightForExam

    renderControls(subject)

    renderSubjectMetrics(subject)
  }

  function renderControls(subject) {
    controlsContainer.innerHTML = ""

    if (!Array.isArray(subject.controls) || subject.controls.length === 0) {
      subject.controls = [{ grade: "", weight: "" }]
      saveState()
    }

    subject.controls.forEach((control, index) => {
      const row = document.createElement("div")
      row.className = "grade-control-row"

      const title = document.createElement("div")
      title.className = "grade-control-title"
      title.textContent = `Control ${index + 1}`

      const gradeInput = document.createElement("input")
      gradeInput.type = "number"
      gradeInput.className = "grade-control-input"
      gradeInput.placeholder = "Nota (1.0 - 7.0)"
      gradeInput.min = "1"
      gradeInput.max = "7"
      gradeInput.step = "0.1"
      gradeInput.value = control.grade

      const weightInput = document.createElement("input")
      weightInput.type = "number"
      weightInput.className = "grade-control-input"
      weightInput.placeholder = "Porcentaje (%)"
      weightInput.min = "0"
      weightInput.max = "100"
      weightInput.step = "0.1"
      weightInput.value = control.weight

      const removeBtn = document.createElement("button")
      removeBtn.type = "button"
      removeBtn.className = "grade-control-remove"
      removeBtn.textContent = "Quitar"

      removeBtn.addEventListener("click", () => {
        if (subject.controls.length <= 1) return
        subject.controls.splice(index, 1)
        saveAndRender()
      })

      gradeInput.addEventListener("input", () => {
        control.grade = gradeInput.value
        saveState()
        renderSubjectMetrics(subject)
        renderSubjectsList(subject)
      })

      weightInput.addEventListener("input", () => {
        control.weight = weightInput.value
        saveState()
        renderSubjectMetrics(subject)
        renderSubjectsList(subject)
      })

      row.appendChild(title)
      row.appendChild(gradeInput)
      row.appendChild(weightInput)
      row.appendChild(removeBtn)
      controlsContainer.appendChild(row)
    })
  }

  function evaluateSubject(subject) {
    const config = subject.config
    const validationErrors = validateControls(subject.controls, config)
    const summary = calculateWeightedAverage(subject.controls)

    const currentAverage = summary.completedWeight > 0
      ? (summary.completedContribution * 100) / summary.completedWeight
      : null

    const finalControlsAverage = summary.totalWeight > 0
      ? (summary.totalContribution * 100) / summary.totalWeight
      : null

    const requiresExam =
      validationErrors.length === 0 &&
      summary.totalWeight === 100 &&
      finalControlsAverage !== null &&
      finalControlsAverage < config.exemptionThreshold &&
      finalControlsAverage >= config.examThreshold

    const isDirectFail =
      validationErrors.length === 0 &&
      summary.totalWeight === 100 &&
      finalControlsAverage !== null &&
      finalControlsAverage < config.examThreshold

    const isExempt =
      validationErrors.length === 0 &&
      summary.totalWeight === 100 &&
      finalControlsAverage !== null &&
      finalControlsAverage >= config.exemptionThreshold

    const neededForExemption = calculateMinimumRequiredGrade({
      currentContribution: summary.completedContribution,
      remainingWeight: Math.max(0, 100 - summary.completedWeight),
      targetGrade: config.exemptionThreshold
    })

    const neededForFour = calculateMinimumRequiredGrade({
      currentContribution: summary.completedContribution,
      remainingWeight: Math.max(0, 100 - summary.completedWeight),
      targetGrade: config.directPassGrade
    })

    const neededExam = requiresExam
      ? calculateMinimumExamGrade({
          controlsAverage: finalControlsAverage,
          targetFinalGrade: config.directPassGrade,
          controlsWeight: config.controlsWeightForExam,
          examWeight: config.examWeight
        })
      : null

    const status = resolveAcademicStatus({ isExempt, requiresExam, isDirectFail, summary })

    return {
      status,
      currentAverage,
      displayAverage: currentAverage === null ? "Promedio: —" : `Promedio: ${formatGrade(currentAverage)}`,
      needExamText: requiresExam ? "Sí" : (isExempt || isDirectFail ? "No" : "Aún no definido"),
      displayNeededForExemption: formatRequirement(neededForExemption),
      displayNeededForFour: formatRequirement(neededForFour),
      displayNeededExam: requiresExam ? formatRequirement(neededExam) : "No aplica",
      validationErrors
    }
  }

  function saveAndRender() {
    saveState()
    renderAll()
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  function validateControls(controls, config) {
    const errors = []

    const totalWeight = controls.reduce((sum, item) => sum + (Number(item.weight) || 0), 0)
    if (Math.abs(totalWeight - 100) > 0.0001) {
      errors.push("La suma de porcentajes de controles debe ser 100%.")
    }

    controls.forEach((item, index) => {
      if (item.grade !== "") {
        const grade = Number(item.grade)
        if (!Number.isFinite(grade) || grade < 1 || grade > 7) {
          errors.push(`La nota del control ${index + 1} debe estar entre 1.0 y 7.0.`)
        }
      }

      if (item.weight !== "") {
        const weight = Number(item.weight)
        if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
          errors.push(`El porcentaje del control ${index + 1} debe estar entre 0 y 100.`)
        }
      }
    })

    const examMix = config.examWeight + config.controlsWeightForExam
    if (Math.abs(examMix - 100) > 0.0001) {
      errors.push("La suma entre porcentaje de examen y ponderación de controles debe ser 100%.")
    }

    return errors
  }

  function resolveAcademicStatus({ isExempt, requiresExam, isDirectFail, summary }) {
    if (summary.totalWeight < 100) return "En progreso"
    if (isExempt) return "Aprobado sin examen"
    if (requiresExam) return "Va a examen"
    if (isDirectFail) return "Reprobado"
    return "Revisa los parámetros"
  }

  function renderSubjectMetrics(subject) {
    const metrics = evaluateSubject(subject)
    if (metrics.validationErrors.length) {
      validationBox.innerHTML = metrics.validationErrors.map(error => `<div>• ${error}</div>`).join("")
      panel.classList.add("has-errors")
    } else {
      validationBox.textContent = ""
      panel.classList.remove("has-errors")
    }

    statusText.textContent = metrics.status
    currentAverageText.textContent = metrics.displayAverage
    needExamText.textContent = metrics.needExamText
    remainingWithoutExamText.textContent = metrics.displayNeededForExemption
    remainingToFourText.textContent = metrics.displayNeededForFour
    neededExamText.textContent = metrics.displayNeededExam
  }

  function formatGrade(value) {
    return Number(value).toFixed(2)
  }

  function formatRequirement(value) {
    if (value === null) return "No hay porcentaje restante para calcular"
    if (value <= 1) return "Objetivo ya alcanzado"
    if (value > 7) return "No alcanzable (excede 7.0)"
    return formatGrade(value)
  }

  function calculateWeightedAverage(controlList) {
    let totalContribution = 0
    let totalWeight = 0
    let completedContribution = 0
    let completedWeight = 0

    controlList.forEach(item => {
      const weight = Number(item.weight)
      if (!Number.isFinite(weight) || weight <= 0) return

      totalWeight += weight

      const grade = Number(item.grade)
      if (Number.isFinite(grade) && item.grade !== "") {
        // Fórmula de promedio ponderado: Σ(nota_i * porcentaje_i / 100).
        const contribution = (grade * weight) / 100
        totalContribution += contribution
        completedContribution += contribution
        completedWeight += weight
      }
    })

    return {
      totalContribution,
      totalWeight,
      completedContribution,
      completedWeight
    }
  }

  function calculateMinimumRequiredGrade({ currentContribution, remainingWeight, targetGrade }) {
    if (remainingWeight <= 0) return null

    // Despeje algebraico: currentContribution + (x * remainingWeight / 100) = targetGrade
    // x = ((targetGrade - currentContribution) * 100) / remainingWeight
    const needed = ((targetGrade - currentContribution) * 100) / remainingWeight

    if (!Number.isFinite(needed)) return null
    return Math.max(1, needed)
  }

  function calculateMinimumExamGrade({ controlsAverage, targetFinalGrade, controlsWeight, examWeight }) {
    if (examWeight <= 0) return null

    // Fórmula final con examen: final = (promedioControles * controlsWeight/100) + (notaExamen * examWeight/100)
    // Despeje de notaExamen para final >= targetFinalGrade:
    // notaExamen >= (targetFinalGrade - promedioControles * controlsWeight/100) * 100 / examWeight
    const needed = (targetFinalGrade - (controlsAverage * controlsWeight) / 100) * (100 / examWeight)

    if (!Number.isFinite(needed)) return null
    return Math.max(1, needed)
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }
})()