import fp from 'fastify-plugin'

function extractToken(request) {
  const header = request.headers?.authorization || ''
  if (header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim()
  }
  return ''
}

// Whether viewing the directory currently requires a login (site setting).
async function viewLoginRequired(fastify) {
  if (!fastify.db?.Settings) return false
  const row = await fastify.db.Settings.findByPk('require_login')
  return row?.value === 'true'
}

// Decorates auth guards:
//   fastify.authenticate  — any active user (sets request.user/session)
//   fastify.requireAdmin  — active user with role 'admin'
//   fastify.gateView      — requires login only when the require_login setting is on
export default fp(async function (fastify) {
  const validate = async (request) => {
    if (!fastify.db?.Sessions || !fastify.db?.Users) {
      return { code: 503, message: 'Auth is unavailable (database not configured).' }
    }
    const token = extractToken(request)
    if (!token) return { code: 401, message: 'Authentication required.' }

    const session = await fastify.db.Sessions.findOne({ where: { token } })
    if (!session) return { code: 401, message: 'Invalid session.' }
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await session.destroy()
      return { code: 401, message: 'Session expired.' }
    }
    const user = await fastify.db.Users.findByPk(session.user_id)
    if (!user || !user.is_active) return { code: 401, message: 'Account is inactive.' }
    return { user, session }
  }

  fastify.decorate('authenticate', async function (request, reply) {
    const r = await validate(request)
    if (r.code) return reply.code(r.code).send({ ok: false, message: r.message })
    request.user = r.user
    request.session = r.session
  })

  fastify.decorate('requireAdmin', async function (request, reply) {
    const r = await validate(request)
    if (r.code) return reply.code(r.code).send({ ok: false, message: r.message })
    if (r.user.role !== 'admin') {
      return reply.code(403).send({ ok: false, message: 'Admin access required.' })
    }
    request.user = r.user
    request.session = r.session
  })

  fastify.decorate('gateView', async function (request, reply) {
    if (!(await viewLoginRequired(fastify))) return // public when login isn't required
    const r = await validate(request)
    if (r.code) return reply.code(r.code).send({ ok: false, message: r.message })
    // Authenticated but role-less accounts are not authorized to view anything.
    if (r.user.role !== 'admin' && r.user.role !== 'viewer') {
      return reply.code(403).send({ ok: false, message: 'Your account is not authorized to view this directory.' })
    }
    request.user = r.user
    request.session = r.session
  })
})
