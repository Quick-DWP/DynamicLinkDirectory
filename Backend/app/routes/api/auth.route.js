import { fn, col, where as sqlWhere } from 'sequelize'
import { verifyPassword, generateToken, hashPassword } from '../../../lib/auth.js'
import { verifyAzureIdToken } from '../../../lib/azure.js'

function ensureModels(fastify, reply) {
  if (!fastify.db?.Users || !fastify.db?.Sessions) {
    reply.code(503).send({ ok: false, message: 'Auth is unavailable (database not configured).' })
    return null
  }
  return fastify.db
}

function publicUser(user) {
  return {
    uuid: user.uuid,
    username: user.username,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    last_login_at: user.last_login_at,
  }
}

// In-memory login throttle keyed by ip+username. Resets on success; locks after
// too many failures within the window. (Per-process; fine for a single backend.)
const loginAttempts = new Map()

function loginRateConfig(fastify) {
  const c = fastify.config?.auth?.login_rate_limit || {}
  return {
    max: Number(c.max_attempts) || 5,
    windowMs: (Number(c.window_minutes) || 15) * 60000,
    lockoutMs: (Number(c.lockout_minutes) || 15) * 60000,
  }
}

export default async function authRoutes(fastify) {
  const ttlHours = Number(fastify.config?.auth?.session_ttl_hours) || 168

  fastify.post('/login', async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const body = request.body || {}
    const username = String(body.username || '').trim()
    const password = String(body.password || '')
    if (!username || !password) {
      return reply.code(400).send({ ok: false, message: 'username and password are required' })
    }

    const { max, windowMs, lockoutMs } = loginRateConfig(fastify)
    const key = `${request.ip}:${username.toLowerCase()}`
    const now = Date.now()
    const rec = loginAttempts.get(key)
    if (rec && rec.lockedUntil > now) {
      const secs = Math.ceil((rec.lockedUntil - now) / 1000)
      reply.header('Retry-After', String(secs))
      return reply.code(429).send({ ok: false, message: `Too many failed attempts. Try again in about ${Math.max(1, Math.round(secs / 60))} minute(s).` })
    }

    // Use the withSecret scope so the hash/salt are available for verification.
    const user = await db.Users.scope('withSecret').findOne({ where: { username } })
    if (!user || !user.is_active || !verifyPassword(password, user.password_hash, user.password_salt)) {
      let r = loginAttempts.get(key)
      if (!r || now - r.firstAt > windowMs) r = { count: 0, firstAt: now, lockedUntil: 0 }
      r.count += 1
      if (r.count >= max) r.lockedUntil = now + lockoutMs
      loginAttempts.set(key, r)
      // Opportunistic cleanup so the map can't grow unbounded.
      if (loginAttempts.size > 5000) {
        for (const [k, v] of loginAttempts) {
          if ((v.lockedUntil || v.firstAt + windowMs) < now) loginAttempts.delete(k)
        }
      }
      return reply.code(401).send({ ok: false, message: 'Invalid username or password.' })
    }

    loginAttempts.delete(key)

    const token = generateToken()
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)
    await db.Sessions.create({ user_id: user.uuid, token, expires_at: expiresAt })

    user.last_login_at = new Date()
    await user.save()

    return reply.send({
      ok: true,
      data: { token, expires_at: expiresAt, user: publicUser(user) },
    })
  })

  // Public: whether Microsoft sign-in is available + the SPA client/tenant ids.
  fastify.get('/azure-config', async (request, reply) => {
    const az = fastify.config?.auth?.azure || {}
    const enabled = az.enabled === true && !!az.tenant_id && !!az.client_id
    return reply.send({
      ok: true,
      data: enabled
        ? { enabled: true, tenant_id: az.tenant_id, client_id: az.client_id }
        : { enabled: false },
    })
  })

  // Microsoft (Azure AD) sign-in: verify the ID token, then authorize against the
  // local users table (email match). Azure authenticates; the users table authorizes.
  fastify.post('/azure-login', async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const az = fastify.config?.auth?.azure || {}
    if (!(az.enabled === true && az.tenant_id && az.client_id)) {
      return reply.code(400).send({ ok: false, message: 'Microsoft sign-in is not enabled.' })
    }

    const idToken = String(request.body?.idToken || '')
    if (!idToken) {
      return reply.code(400).send({ ok: false, message: 'idToken is required' })
    }

    let email
    let name
    try {
      const verified = await verifyAzureIdToken(idToken, {
        tenantId: az.tenant_id,
        clientId: az.client_id,
        audience: az.audience || '',
      })
      email = verified.email
      name = verified.name
    } catch {
      return reply.code(401).send({ ok: false, message: 'Microsoft sign-in could not be verified.' })
    }
    if (!email) {
      return reply.code(401).send({ ok: false, message: 'Microsoft account has no email.' })
    }

    // Case-insensitive email match against existing users.
    let user = await db.Users.findOne({
      where: sqlWhere(fn('lower', col('email')), email.toLowerCase()),
    })

    if (!user) {
      // Auto-provision (JIT) new Microsoft sign-ins, unless disabled.
      if (az.auto_provision === false) {
        return reply.code(403).send({ ok: false, message: 'This Microsoft account is not authorized in this system.' })
      }
      // Grant the 'viewer' role only to configured domain(s); everyone else is
      // created with NO role (null) and lands on the "unauthorized" screen until
      // an admin grants access. If no domain is configured, keep the old
      // behaviour (all sign-ins become viewers).
      const domains = String(az.auto_provision_domain || '')
        .split(',')
        .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean)
      const emailDomain = email.toLowerCase().split('@')[1] || ''
      const role = domains.length === 0 ? 'viewer' : (domains.includes(emailDomain) ? 'viewer' : null)

      let username = email
      for (let n = 1; await db.Users.findOne({ where: { username } }); n += 1) {
        username = `${email}-${n}`
      }
      user = await db.Users.create({
        username,
        email,
        display_name: name || email,
        password_hash: null,
        password_salt: null,
        role,
        is_active: true,
      })
    } else if (!user.is_active) {
      return reply.code(403).send({ ok: false, message: 'This account is inactive.' })
    }

    const token = generateToken()
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)
    await db.Sessions.create({ user_id: user.uuid, token, expires_at: expiresAt })
    user.last_login_at = new Date()
    await user.save()

    return reply.send({ ok: true, data: { token, expires_at: expiresAt, user: publicUser(user) } })
  })

  fastify.post('/logout', { preHandler: fastify.authenticate }, async (request, reply) => {
    if (request.session) {
      await request.session.destroy()
    }
    return reply.send({ ok: true, data: { loggedOut: true } })
  })

  fastify.get('/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    return reply.send({ ok: true, data: { user: publicUser(request.user) } })
  })

  // Change the signed-in user's own password.
  fastify.patch('/password', { preHandler: fastify.authenticate }, async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const body = request.body || {}
    const current = String(body.current_password || '')
    const next = String(body.new_password || '')
    if (next.length < 6) {
      return reply.code(400).send({ ok: false, message: 'New password must be at least 6 characters.' })
    }

    const user = await db.Users.scope('withSecret').findByPk(request.user.uuid)
    if (!user || !verifyPassword(current, user.password_hash, user.password_salt)) {
      return reply.code(400).send({ ok: false, message: 'Current password is incorrect.' })
    }

    const { hash, salt } = hashPassword(next)
    user.password_hash = hash
    user.password_salt = salt
    await user.save()
    return reply.send({ ok: true, data: { updated: true } })
  })
}
