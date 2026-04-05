# Sistema de cuentas + sincronización en la nube

## Arquitectura elegida (simple y mantenible)

- **Frontend actual (Electron + HTML/JS)** mantiene su almacenamiento local en `localStorage` para funcionar offline.
- **Backend propio**: `cloud-backend.js` (Node.js + Express), con una base de datos tipo archivo JSON (`cloud-db.json`) para minimizar complejidad operativa.
- **Autenticación propia**:
  - Registro/login con email y contraseña.
  - Contraseñas con hash `scrypt` + salt.
  - Sesiones con token opaco (Bearer token) guardado con hash en servidor.
  - Recuperación de contraseña con token temporal.
- **Sincronización**:
  - El cliente exporta/importa snapshots del `localStorage` (excepto claves internas de la nube).
  - Manual: botones “Subir a nube” y “Restaurar desde nube”.
  - Automática: intenta subir cambios cada ~25s si hay sesión.
  - Conflictos: **Last Write Wins** usando timestamps (`clientUpdatedAt` vs `syncUpdatedAt` servidor).

## Archivos creados

- `cloud-backend.js`
- `local-storage-service.js`
- `auth-service.js`
- `sync-service.js`
- `cloud-ui.js`
- `CLOUD_SYNC.md`

## Archivos modificados

- `index.html`
- `styles.css`
- `server.js`
- `package.json`

## Ejecutar backend y app

### 1) Backend nube

```bash
npm run start:cloud
```

Variables opcionales:

- `CLOUD_PORT` (default: `4000`)
- `CLOUD_DB_PATH` (default: `./cloud-db.json`)

Ejemplo:

```bash
CLOUD_PORT=4500 CLOUD_DB_PATH=./data/cloud-db.json npm run start:cloud
```

### 2) App

- En escritorio (Electron):

```bash
npm start
```

- En navegador local (solo UI):

```bash
npm run start:web
# abrir http://127.0.0.1:3000
```

## Probar flujo completo entre 2 dispositivos

> Ambos dispositivos deben apuntar al mismo backend (IP/URL compartida).

1. **Dispositivo A**
   - Abrir configuración → sección “Cuenta y sincronización en la nube”.
   - Definir URL backend (ej: `http://192.168.1.10:4000/api`).
   - Registrarse e iniciar sesión.
   - Crear/editar datos en la app.
   - Pulsar **“Subir a nube (manual)”**.

2. **Dispositivo B**
   - Abrir la app e ir a la misma sección.
   - Usar la misma URL backend.
   - Iniciar sesión con la misma cuenta.
   - Pulsar **“Restaurar desde nube (manual)”**.
   - La app recarga y aparecen los datos.

3. **Validar auto-sync**
   - En A, cambiar cualquier dato local.
   - Esperar ~25 segundos (o hacer sync manual).
   - En B, restaurar manual para verificar cambios.

4. **Validar recuperación de contraseña**
   - En sección de recuperación, solicitar código.
   - En entorno local el backend devuelve el token directo.
   - Ingresar token + nueva contraseña y confirmar.

## Notas de resiliencia offline

- Si backend cae o no hay red, la app **sigue funcionando localmente** con `localStorage`.
- Los errores de nube se muestran en UI y **no bloquean** funciones locales.
