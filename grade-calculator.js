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

  const statusPriority = {
    "Aprobado sin examen": 1,
    "Va a examen": 2,
    "Reprobado": 3,
    "En progreso": 4,
    "Revisa los parámetros": 5
  }

  const panel = document.getElementById("gradeCalculatorPanel")
  const editorPanel = document.getElementById("gradeEditorPanel")
  const subjectsList = document.getElementById("gradeSubjectsList")
  const subjectsHint = document.getElementById("gradeSubjectsHint")
  const addSubjectBtn = document.getElementById("gradeAddSubjectBtn")
  const subjectNameInput = document.getElementById("gradeSubjectNameInput")
  const selectedSubjectNameInput = document.getElementById("gradeSelectedSubjectName")
  const deleteSubjectBtn = document.getElementById("gradeDeleteSubjectBtn")
  const sortModeSelect = document.getElementById("gradeSortMode")

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

  if (
    !panel || !editorPanel || !subjectsList || !addSubjectBtn || !subjectNameInput || !selectedSubjectNameInput ||
    !deleteSubjectBtn || !sortModeSelect || !controlsContainer || !controlsCountInput || !directPassInput ||
    !examThresholdInput || !exemptionThresholdInput || !examWeightInput || !controlsWeightForExamInput ||
    !validationBox || !statusText || !currentAverageText || !needExamText || !remainingWithoutExamText ||
    !remainingToFourText || !neededExamText || !addControlBtn
  ) return

  let state = loadState()
  let dragSubjectId = null

  bindEvents()
  ensureAtLeastOneSubject()
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

      state.subjects = state.subjects.filter(item => item.id !== subject.id)
      if (state.selectedSubjectId === subject.id) {
        state.selectedSubjectId = state.subjects[0]?.id || null
      }
      reindexManualOrder()
      saveAndRender()
    })

    sortModeSelect.addEventListener("change", () => {
      state.sortMode = sortModeSelect.value
      saveAndRender()
    })

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

    addControlBtn.addEventListener("click", () => {
      const subject = getSelectedSubject()
      if (!subject) return
      setControlsCount(subject, subject.controls.length + 1)
      saveAndRender()
    })
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      if (!parsed || typeof parsed !== "object") throw new Error("invalid")
      const subjects = Array.isArray(parsed.subjects) ? parsed.subjects : []
      return {
        subjects: subjects.map(normalizeSubject),
        selectedSubjectId: parsed.selectedSubjectId || null,
        sortMode: ["manual", "name", "average", "status"].includes(parsed.sortMode) ? parsed.sortMode : "manual"
      }
    } catch (_error) {
      return { subjects: [], selectedSubjectId: null, sortMode: "manual" }
    }
  }

  function normalizeSubject(raw, index = 0) {
    const configRaw = raw && typeof raw.config === "object" ? raw.config : {}
    const controlsRaw = Array.isArray(raw?.controls) ? raw.controls : []
    const controls = controlsRaw.length
      ? controlsRaw.map(control => ({ grade: control?.grade ?? "", weight: control?.weight ?? "" }))
      : Array.from({ length: defaults.controlsCount }, () => ({ grade: "", weight: "" }))

    return {
      id: String(raw?.id || `subject-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      name: String(raw?.name || "Ramo sin nombre"),
      order: Number.isFinite(Number(raw?.order)) ? Number(raw.order) : index,
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

  function ensureAtLeastOneSubject() {
    if (state.subjects.length) {
      if (!state.subjects.some(subject => subject.id === state.selectedSubjectId)) {
        state.selectedSubjectId = state.subjects[0].id
      }
      return
    }

    const first = createSubject("Ramo 1")
    state.subjects.push(first)
    state.selectedSubjectId = first.id
    saveState()
  }

  function createSubjectFromInput() {
    const name = subjectNameInput.value.trim() || `Ramo ${state.subjects.length + 1}`
    const subject = createSubject(name)
    state.subjects.push(subject)
    state.selectedSubjectId = subject.id
    subjectNameInput.value = ""
    reindexManualOrder()
    saveAndRender()
  }

  function createSubject(name) {
    return {
      id: `subject-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      order: state.subjects.length,
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
    const selected = getSelectedSubject()
    sortModeSelect.value = state.sortMode
    renderSubjectsList(selected)
    renderEditor(selected)
  }

  function renderSubjectsList(selected) {
    subjectsList.innerHTML = ""
    const sorted = getSortedSubjects()
    const manualMode = state.sortMode === "manual"
    subjectsHint.style.display = manualMode ? "block" : "none"

    sorted.forEach(subject => {
      const metrics = evaluateSubject(subject)
      const item = document.createElement("button")
      item.type = "button"
      item.className = "grade-subject-item"
      if (selected && selected.id === subject.id) item.classList.add("is-active")
      item.dataset.subjectId = subject.id
      item.draggable = manualMode

      item.innerHTML = `
        <strong>${escapeHtml(subject.name || "Ramo sin nombre")}</strong>
        <span>${metrics.displayAverage}</span>
        <small>${metrics.status}</small>
      `

      item.addEventListener("click", () => {
        state.selectedSubjectId = subject.id
        saveAndRender(false)
      })

      if (manualMode) {
        item.addEventListener("dragstart", () => {
          dragSubjectId = subject.id
          item.classList.add("is-dragging")
        })

        item.addEventListener("dragend", () => {
          dragSubjectId = null
          item.classList.remove("is-dragging")
        })

        item.addEventListener("dragover", event => {
          event.preventDefault()
          item.classList.add("is-drag-over")
        })

        item.addEventListener("dragleave", () => {
          item.classList.remove("is-drag-over")
        })

        item.addEventListener("drop", event => {
          event.preventDefault()
          item.classList.remove("is-drag-over")
          if (!dragSubjectId || dragSubjectId === subject.id) return
          reorderSubjects(dragSubjectId, subject.id)
          saveAndRender()
        })
      }

      subjectsList.appendChild(item)
    })
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
    addControlBtn.disabled = false

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

  function getSortedSubjects() {
    const list = [...state.subjects]
    const mode = state.sortMode

    if (mode === "manual") {
      return list.sort((a, b) => a.order - b.order)
    }

    if (mode === "name") {
      return list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }))
    }

    if (mode === "average") {
      return list.sort((a, b) => {
        const avgA = evaluateSubject(a).currentAverage ?? -1
        const avgB = evaluateSubject(b).currentAverage ?? -1
        return avgB - avgA
      })
    }

    if (mode === "status") {
      return list.sort((a, b) => {
        const statusA = evaluateSubject(a).status
        const statusB = evaluateSubject(b).status
        return (statusPriority[statusA] || 99) - (statusPriority[statusB] || 99)
      })
    }

    return list
  }

  function reorderSubjects(dragId, targetId) {
    const manual = [...state.subjects].sort((a, b) => a.order - b.order)
    const fromIndex = manual.findIndex(subject => subject.id === dragId)
    const targetIndex = manual.findIndex(subject => subject.id === targetId)
    if (fromIndex < 0 || targetIndex < 0) return

    const [moved] = manual.splice(fromIndex, 1)
    manual.splice(targetIndex, 0, moved)

    state.subjects = manual
    reindexManualOrder()
  }

  function reindexManualOrder() {
    const manual = [...state.subjects].sort((a, b) => a.order - b.order)
    manual.forEach((subject, index) => {
      subject.order = index
    })
    state.subjects = manual
  }

  function saveAndRender(save = true) {
    if (save) saveState()
    else saveState()
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
