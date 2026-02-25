(function () {
  const STORAGE_KEY = "gradeCalculatorConfig"

  const defaults = {
    controlsCount: 4,
    directPassGrade: 4.0,
    examThreshold: 3.5,
    exemptionThreshold: 5.5,
    examWeight: 30,
    controlsWeightForExam: 70
  }

  const panel = document.getElementById("gradeCalculatorPanel")
  const controlsContainer = document.getElementById("gradeControlsContainer")
  const controlsCountInput = document.getElementById("gradeControlsCount")
  const directPassInput = document.getElementById("directPassGrade")
  const examThresholdInput = document.getElementById("examThresholdGrade")
  const exemptionThresholdInput = document.getElementById("exemptionThresholdGrade")
  const examWeightInput = document.getElementById("examWeight")
  const controlsWeightForExamInput = document.getElementById("controlsWeightForExam")
  const validationBox = document.getElementById("gradeValidation")

  const statusText = document.getElementById("gradeStatus")
  const currentAverageText = document.getElementById("gradeCurrentAverage")
  const needExamText = document.getElementById("gradeNeedExam")
  const remainingWithoutExamText = document.getElementById("gradeNeedForExemption")
  const remainingToFourText = document.getElementById("gradeNeedForFour")
  const neededExamText = document.getElementById("gradeNeedExamMin")

  const addControlBtn = document.getElementById("addGradeControlBtn")

  if (
    !panel ||
    !controlsContainer ||
    !controlsCountInput ||
    !directPassInput ||
    !examThresholdInput ||
    !exemptionThresholdInput ||
    !examWeightInput ||
    !controlsWeightForExamInput ||
    !validationBox
  ) return

  let controls = []

  const savedConfig = loadConfig()
  setupConfigInputs(savedConfig)
  setControlsCount(savedConfig.controlsCount)
  bindEvents()
  recalculate()

  function loadConfig() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      return { ...defaults, ...(parsed && typeof parsed === "object" ? parsed : {}) }
    } catch (_error) {
      return { ...defaults }
    }
  }

  function saveConfig() {
    const config = {
      controlsCount: Number(controlsCountInput.value) || defaults.controlsCount,
      directPassGrade: Number(directPassInput.value) || defaults.directPassGrade,
      examThreshold: Number(examThresholdInput.value) || defaults.examThreshold,
      exemptionThreshold: Number(exemptionThresholdInput.value) || defaults.exemptionThreshold,
      examWeight: Number(examWeightInput.value) || defaults.examWeight,
      controlsWeightForExam: Number(controlsWeightForExamInput.value) || defaults.controlsWeightForExam
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  }

  function setupConfigInputs(config) {
    controlsCountInput.value = config.controlsCount
    directPassInput.value = config.directPassGrade
    examThresholdInput.value = config.examThreshold
    exemptionThresholdInput.value = config.exemptionThreshold
    examWeightInput.value = config.examWeight
    controlsWeightForExamInput.value = config.controlsWeightForExam
  }

  function bindEvents() {
    const recalculateAndSave = () => {
      saveConfig()
      recalculate()
    }

    controlsCountInput.addEventListener("change", () => {
      setControlsCount(Number(controlsCountInput.value) || 1)
      recalculateAndSave()
    })

    ;[
      directPassInput,
      examThresholdInput,
      exemptionThresholdInput,
      examWeightInput,
      controlsWeightForExamInput
    ].forEach(input => input.addEventListener("input", recalculateAndSave))

    addControlBtn?.addEventListener("click", () => {
      setControlsCount(controls.length + 1)
      controlsCountInput.value = controls.length
      recalculateAndSave()
    })
  }

  function setControlsCount(count) {
    const safeCount = Math.max(1, Math.min(30, Math.floor(Number(count) || 1)))

    if (safeCount > controls.length) {
      for (let i = controls.length; i < safeCount; i += 1) {
        controls.push({ grade: "", weight: "" })
      }
    } else if (safeCount < controls.length) {
      controls = controls.slice(0, safeCount)
    }

    controlsCountInput.value = safeCount
    renderControls()
  }

  function renderControls() {
    controlsContainer.innerHTML = ""

    controls.forEach((control, index) => {
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
      gradeInput.setAttribute("aria-label", `Nota del control ${index + 1}`)

      const weightInput = document.createElement("input")
      weightInput.type = "number"
      weightInput.className = "grade-control-input"
      weightInput.placeholder = "Porcentaje (%)"
      weightInput.min = "0"
      weightInput.max = "100"
      weightInput.step = "0.1"
      weightInput.value = control.weight
      weightInput.setAttribute("aria-label", `Porcentaje del control ${index + 1}`)

      const removeBtn = document.createElement("button")
      removeBtn.type = "button"
      removeBtn.className = "grade-control-remove"
      removeBtn.textContent = "Quitar"
      removeBtn.setAttribute("aria-label", `Quitar control ${index + 1}`)

      removeBtn.addEventListener("click", () => {
        if (controls.length <= 1) return
        controls.splice(index, 1)
        controlsCountInput.value = controls.length
        renderControls()
        recalculate()
        saveConfig()
      })

      gradeInput.addEventListener("input", () => {
        controls[index].grade = gradeInput.value
        recalculate()
      })

      weightInput.addEventListener("input", () => {
        controls[index].weight = weightInput.value
        recalculate()
      })

      row.appendChild(title)
      row.appendChild(gradeInput)
      row.appendChild(weightInput)
      row.appendChild(removeBtn)
      controlsContainer.appendChild(row)
    })
  }

  function recalculate() {
    const config = readConfig()
    const validationErrors = validateControls(config)

    if (validationErrors.length) {
      validationBox.innerHTML = validationErrors.map(error => `<div>• ${error}</div>`).join("")
      panel.classList.add("has-errors")
    } else {
      validationBox.textContent = ""
      panel.classList.remove("has-errors")
    }

    const summary = calculateWeightedAverage(controls)
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

    statusText.textContent = resolveAcademicStatus({ isExempt, requiresExam, isDirectFail, summary })
    currentAverageText.textContent = currentAverage === null ? "—" : formatGrade(currentAverage)
    needExamText.textContent = requiresExam ? "Sí" : (isExempt || isDirectFail ? "No" : "Aún no definido")

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

    remainingWithoutExamText.textContent = formatRequirement(neededForExemption)
    remainingToFourText.textContent = formatRequirement(neededForFour)

    if (requiresExam) {
      const neededExam = calculateMinimumExamGrade({
        controlsAverage: finalControlsAverage,
        targetFinalGrade: config.directPassGrade,
        controlsWeight: config.controlsWeightForExam,
        examWeight: config.examWeight
      })
      neededExamText.textContent = formatRequirement(neededExam)
    } else {
      neededExamText.textContent = "No aplica"
    }
  }

  function readConfig() {
    return {
      directPassGrade: Number(directPassInput.value) || defaults.directPassGrade,
      examThreshold: Number(examThresholdInput.value) || defaults.examThreshold,
      exemptionThreshold: Number(exemptionThresholdInput.value) || defaults.exemptionThreshold,
      examWeight: Number(examWeightInput.value) || defaults.examWeight,
      controlsWeightForExam: Number(controlsWeightForExamInput.value) || defaults.controlsWeightForExam
    }
  }

  function validateControls(config) {
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
    if (summary.totalWeight < 100) return "Estado académico: En progreso"
    if (isExempt) return "Estado académico: Aprobado sin examen"
    if (requiresExam) return "Estado académico: Va a examen"
    if (isDirectFail) return "Estado académico: Reprobado"
    return "Estado académico: Revisa los parámetros"
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
})()
