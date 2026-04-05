const express = require('express')
const crypto = require('crypto')
const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')

const DEFAULT_PORT = Number(process.env.CLOUD_PORT || 4000)
const DB_PATH = process.env.CLOUD_DB_PATH || path.join(__dirname, 'cloud-db.json')
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30
const RESET_TTL_MS = 1000 * 60 * 15

let writeLock = Promise.resolve()

function withLock(task) {
  writeLock = writeLock.then(task, task)
  return writeLock
}

function nowIso() {
  return new Date().toISOString()
}

function createEmptyDb() {
  return { users: [] }
}

async function ensureDbFile() {
  try {
    await fsp.access(DB_PATH)
  } catch (_error) {
    await fsp.writeFile(DB_PATH, JSON.stringify(createEmptyDb(), null, 2), 'utf-8')
  }
}

async function readDb() {
  await ensureDbFile()
  const raw = await fsp.readFile(DB_PATH, 'utf-8')
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.users)) return createEmptyDb()
    return parsed
  } catch (_error) {
    return createEmptyDb()
  }
}

async function writeDb(db) {
  await fsp.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function generateToken(size = 48) {
  return crypto.randomBytes(size).toString('hex')
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

function verifyPassword(password, salt, hash) {
  const newHash = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(newHash, 'hex'), Buffer.from(hash, 'hex'))
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSyncAt: user.lastSyncAt || null,
    syncUpdatedAt: user.syncUpdatedAt || null
  }
}

async function startCloudBackend(port = DEFAULT_PORT) {
  const app = express()
  app.use(express.json({ limit: '5mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: nowIso() })
  })

  app.post('/api/auth/register', async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')
    const name = String(req.body?.name || '').trim()

    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Debes enviar email y contraseña (mínimo 8 caracteres).' })
    }

    const result = await withLock(async () => {
      const db = await readDb()
      const exists = db.users.find(u => u.email === email)
      if (exists) return { error: 'Este email ya está registrado.', code: 409 }

      const { hash, salt } = hashPassword(password)
      const user = {
        id: crypto.randomUUID(),
        email,
        name: name || email.split('@')[0],
        passwordHash: hash,
        passwordSalt: salt,
        sessions: [],
        syncData: null,
        syncUpdatedAt: null,
        lastSyncAt: null,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }

      db.users.push(user)
      await writeDb(db)
      return { user }
    })

    if (result.error) {
      return res.status(result.code).json({ error: result.error })
    }

    return res.status(201).json({ user: publicUser(result.user) })
  })

  app.post('/api/auth/login', async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')

    const result = await withLock(async () => {
      const db = await readDb()
      const user = db.users.find(u => u.email === email)
      if (!user) return { error: 'Credenciales inválidas.', code: 401 }

      const isValid = verifyPassword(password, user.passwordSalt, user.passwordHash)
      if (!isValid) return { error: 'Credenciales inválidas.', code: 401 }

      const rawToken = generateToken(32)
      const tokenHash = hashToken(rawToken)
      const expiresAt = Date.now() + TOKEN_TTL_MS
      user.sessions = (user.sessions || []).filter(s => s.expiresAt > Date.now())
      user.sessions.push({ tokenHash, expiresAt, createdAt: nowIso() })
      user.updatedAt = nowIso()
      await writeDb(db)

      return { token: rawToken, user }
    })

    if (result.error) {
      return res.status(result.code).json({ error: result.error })
    }

    return res.json({ token: result.token, user: publicUser(result.user) })
  })

  async function authMiddleware(req, res, next) {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'Token requerido.' })

    const db = await readDb()
    const tokenHash = hashToken(token)
    const user = db.users.find(u => (u.sessions || []).some(s => s.tokenHash === tokenHash && s.expiresAt > Date.now()))
    if (!user) return res.status(401).json({ error: 'Sesión inválida o vencida.' })

    req.auth = { tokenHash, userId: user.id }
    req.db = db
    req.user = user
    next()
  }

  app.get('/api/auth/session', authMiddleware, async (req, res) => {
    res.json({ user: publicUser(req.user) })
  })

  app.post('/api/auth/logout', authMiddleware, async (req, res) => {
    await withLock(async () => {
      const db = await readDb()
      const user = db.users.find(u => u.id === req.auth.userId)
      if (!user) return
      user.sessions = (user.sessions || []).filter(s => s.tokenHash !== req.auth.tokenHash)
      user.updatedAt = nowIso()
      await writeDb(db)
    })

    res.json({ ok: true })
  })

  app.post('/api/auth/request-password-reset', async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const result = await withLock(async () => {
      const db = await readDb()
      const user = db.users.find(u => u.email === email)
      if (!user) return { ok: true }

      const plainToken = generateToken(16)
      user.resetTokenHash = hashToken(plainToken)
      user.resetTokenExpiresAt = Date.now() + RESET_TTL_MS
      user.updatedAt = nowIso()
      await writeDb(db)
      return { ok: true, resetToken: plainToken }
    })

    // En producción se envía por email. Aquí se devuelve para simplificar pruebas locales.
    res.json(result)
  })

  app.post('/api/auth/reset-password', async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const resetToken = String(req.body?.resetToken || '')
    const newPassword = String(req.body?.newPassword || '')

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' })
    }

    const result = await withLock(async () => {
      const db = await readDb()
      const user = db.users.find(u => u.email === email)
      if (!user || !user.resetTokenHash || !user.resetTokenExpiresAt) {
        return { error: 'Solicitud inválida.', code: 400 }
      }

      if (user.resetTokenExpiresAt < Date.now()) {
        return { error: 'El código de recuperación venció.', code: 400 }
      }

      if (hashToken(resetToken) !== user.resetTokenHash) {
        return { error: 'Código de recuperación inválido.', code: 400 }
      }

      const { hash, salt } = hashPassword(newPassword)
      user.passwordHash = hash
      user.passwordSalt = salt
      user.resetTokenHash = null
      user.resetTokenExpiresAt = null
      user.sessions = []
      user.updatedAt = nowIso()
      await writeDb(db)
      return { ok: true }
    })

    if (result.error) {
      return res.status(result.code).json({ error: result.error })
    }

    res.json({ ok: true })
  })

  app.get('/api/sync/pull', authMiddleware, async (req, res) => {
    res.json({
      data: req.user.syncData || null,
      syncUpdatedAt: req.user.syncUpdatedAt || null,
      serverTime: nowIso()
    })
  })

  app.post('/api/sync/push', authMiddleware, async (req, res) => {
    const data = req.body?.data
    const clientUpdatedAt = Number(req.body?.clientUpdatedAt || 0)
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Payload de sincronización inválido.' })
    }

    const result = await withLock(async () => {
      const db = await readDb()
      const user = db.users.find(u => u.id === req.auth.userId)
      if (!user) return { error: 'Usuario no encontrado.', code: 404 }

      const currentTs = user.syncUpdatedAt ? new Date(user.syncUpdatedAt).getTime() : 0
      if (currentTs > clientUpdatedAt) {
        return {
          winner: 'server',
          data: user.syncData,
          syncUpdatedAt: user.syncUpdatedAt,
          lastSyncAt: user.lastSyncAt || null
        }
      }

      const updatedAt = nowIso()
      user.syncData = data
      user.syncUpdatedAt = updatedAt
      user.lastSyncAt = updatedAt
      user.updatedAt = updatedAt
      await writeDb(db)

      return {
        winner: 'client',
        data: user.syncData,
        syncUpdatedAt: user.syncUpdatedAt,
        lastSyncAt: user.lastSyncAt
      }
    })

    if (result.error) {
      return res.status(result.code).json({ error: result.error })
    }

    res.json(result)
  })

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[cloud-backend] running on http://0.0.0.0:${port}`)
    console.log(`[cloud-backend] db file: ${DB_PATH}`)
  })

  return server
}

if (require.main === module) {
  startCloudBackend()
}

module.exports = { startCloudBackend }
