(function initCloudUi() {
  const configBody = document.querySelector('.configuracion-body')
  if (!configBody) return

  const section = document.createElement('section')
  section.className = 'config-section cloud-section'
  section.innerHTML = `
    <div class="config-section-head">
      <h4>Cuenta y sincronización en la nube</h4>
      <p>Regístrate e inicia sesión para respaldar tus datos y restaurarlos en otro dispositivo.</p>
    </div>

    <div class="cloud-status-grid">
      <div><strong>Estado de sesión:</strong> <span id="cloudSessionState">Sin sesión</span></div>
      <div><strong>Estado de sincronización:</strong> <span id="cloudSyncState">Aún no sincronizado.</span></div>
      <div><strong>Última sincronización:</strong> <span id="cloudLastSync">—</span></div>
    </div>

    <div class="config-options cloud-endpoint-row">
      <label class="config-option" for="cloudBaseUrlInput">
        <span>URL Backend</span>
        <input id="cloudBaseUrlInput" type="url" placeholder="http://127.0.0.1:4000/api" value="${window.AuthService.DEFAULT_BASE_URL}">
      </label>
    </div>

    <div class="cloud-grid">
      <div class="cloud-card">
        <h5>Registro / Login</h5>
        <input type="email" id="cloudEmail" placeholder="Email">
        <input type="text" id="cloudName" placeholder="Nombre (registro)">
        <input type="password" id="cloudPassword" placeholder="Contraseña (mínimo 8)">
        <div class="cloud-actions">
          <button type="button" class="modo config-action" id="cloudRegisterBtn">Registrarme</button>
          <button type="button" class="modo config-action" id="cloudLoginBtn">Iniciar sesión</button>
          <button type="button" class="modo config-action" id="cloudLogoutBtn">Cerrar sesión</button>
        </div>
      </div>

      <div class="cloud-card">
        <h5>Recuperar contraseña</h5>
        <input type="email" id="cloudResetEmail" placeholder="Email de tu cuenta">
        <div class="cloud-actions">
          <button type="button" class="modo config-action" id="cloudRequestResetBtn">Solicitar código</button>
        </div>
        <input type="text" id="cloudResetToken" placeholder="Código recibido">
        <input type="password" id="cloudNewPassword" placeholder="Nueva contraseña">
        <div class="cloud-actions">
          <button type="button" class="modo config-action" id="cloudApplyResetBtn">Cambiar contraseña</button>
        </div>
      </div>
    </div>

    <div class="cloud-card">
      <h5>Sincronización</h5>
      <div class="cloud-actions">
        <button type="button" class="modo config-action" id="cloudPushBtn">Subir a nube (manual)</button>
        <button type="button" class="modo config-action" id="cloudPullBtn">Restaurar desde nube (manual)</button>
      </div>
      <p class="cloud-helper">La sincronización automática intenta subir cambios cada ~25 segundos cuando hay sesión activa.</p>
    </div>

    <div class="cloud-message" id="cloudMessage" role="alert" aria-live="polite"></div>
  `

  configBody.appendChild(section)

  const $ = id => document.getElementById(id)
  const cloudMessage = $('cloudMessage')

  function showMessage(text, isError = false) {
    cloudMessage.textContent = text
    cloudMessage.classList.toggle('error', Boolean(isError))
  }

  function getBaseUrl() {
    const inputValue = $('cloudBaseUrlInput').value.trim()
    return inputValue || window.AuthService.DEFAULT_BASE_URL
  }

  function refreshSessionState() {
    const session = window.AuthService.getSession()
    $('cloudSessionState').textContent = session
      ? `Activa (${session.user?.email || 'usuario'})`
      : 'Sin sesión'

    if (session?.baseUrl) {
      $('cloudBaseUrlInput').value = session.baseUrl
    }
  }

  function refreshSyncState() {
    const syncStatus = window.SyncService.getStatus()
    $('cloudSyncState').textContent = syncStatus.message || syncStatus.state
    $('cloudLastSync').textContent = syncStatus.lastSyncedAt
      ? new Date(syncStatus.lastSyncedAt).toLocaleString()
      : '—'
  }

  $('cloudRegisterBtn').addEventListener('click', async () => {
    try {
      await window.AuthService.register({
        email: $('cloudEmail').value,
        password: $('cloudPassword').value,
        name: $('cloudName').value,
        baseUrl: getBaseUrl()
      })
      showMessage('Registro exitoso. Ahora puedes iniciar sesión.')
    } catch (error) {
      showMessage(error.message, true)
    }
  })

  $('cloudLoginBtn').addEventListener('click', async () => {
    try {
      await window.AuthService.login({
        email: $('cloudEmail').value,
        password: $('cloudPassword').value,
        baseUrl: getBaseUrl()
      })
      refreshSessionState()
      await window.SyncService.runAutoSyncOnce()
      showMessage('Sesión iniciada correctamente.')
    } catch (error) {
      showMessage(error.message, true)
    }
  })

  $('cloudLogoutBtn').addEventListener('click', async () => {
    try {
      await window.AuthService.logout()
      refreshSessionState()
      showMessage('Sesión cerrada.')
    } catch (error) {
      showMessage(error.message, true)
    }
  })

  $('cloudRequestResetBtn').addEventListener('click', async () => {
    try {
      const result = await window.AuthService.requestPasswordReset({
        email: $('cloudResetEmail').value,
        baseUrl: getBaseUrl()
      })
      if (result.resetToken) {
        $('cloudResetToken').value = result.resetToken
        showMessage('Código generado (modo local): revisa el campo "Código recibido".')
      } else {
        showMessage('Si el correo existe, se procesó la recuperación.')
      }
    } catch (error) {
      showMessage(error.message, true)
    }
  })

  $('cloudApplyResetBtn').addEventListener('click', async () => {
    try {
      await window.AuthService.resetPassword({
        email: $('cloudResetEmail').value,
        resetToken: $('cloudResetToken').value,
        newPassword: $('cloudNewPassword').value,
        baseUrl: getBaseUrl()
      })
      showMessage('Contraseña actualizada. Inicia sesión nuevamente.')
    } catch (error) {
      showMessage(error.message, true)
    }
  })

  $('cloudPushBtn').addEventListener('click', async () => {
    try {
      await window.SyncService.pushToCloud()
      refreshSyncState()
      showMessage('Datos subidos manualmente.')
    } catch (error) {
      showMessage(error.message, true)
      refreshSyncState()
    }
  })

  $('cloudPullBtn').addEventListener('click', async () => {
    try {
      await window.SyncService.pullFromCloud({ reloadAfter: true })
      refreshSyncState()
      showMessage('Datos restaurados desde la nube.')
    } catch (error) {
      showMessage(error.message, true)
      refreshSyncState()
    }
  })

  window.addEventListener('cloud-sync-status', refreshSyncState)

  refreshSessionState()
  refreshSyncState()
})()
