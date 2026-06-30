import { verifyPassword, generateToken } from '../../../lib/auth.js'

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
    display_name: user.display_name,
    role: user.role,
    last_login_at: user.last_login_at,
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

    // Use the withSecret scope so the hash/salt are available for verification.
    const user = await db.Users.scope('withSecret').findOne({ where: { username } })
    if (!user || !user.is_active || !verifyPassword(password, user.password_hash, user.password_salt)) {
      return reply.code(401).send({ ok: false, message: 'Invalid username or password.' })
    }

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

  fastify.post('/logout', { preHandler: fastify.authenticate }, async (request, reply) => {
    if (request.session) {
      await request.session.destroy()
    }
    return reply.send({ ok: true, data: { loggedOut: true } })
  })

  fastify.get('/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    return reply.send({ ok: true, data: { user: publicUser(request.user) } })
  })
}
