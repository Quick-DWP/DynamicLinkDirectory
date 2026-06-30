import fp from 'fastify-plugin'

function extractToken(request) {
  const header = request.headers?.authorization || ''
  if (header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim()
  }
  return ''
}

// Decorates `fastify.authenticate`, a preHandler that requires a valid session
// token and attaches the resolved user to `request.user`.
export default fp(async function (fastify) {
  fastify.decorate('authenticate', async function (request, reply) {
    if (!fastify.db?.Sessions || !fastify.db?.Users) {
      return reply.code(503).send({ ok: false, message: 'Auth is unavailable (database not configured).' })
    }

    const token = extractToken(request)
    if (!token) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' })
    }

    const session = await fastify.db.Sessions.findOne({ where: { token } })
    if (!session) {
      return reply.code(401).send({ ok: false, message: 'Invalid session.' })
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await session.destroy()
      return reply.code(401).send({ ok: false, message: 'Session expired.' })
    }

    const user = await fastify.db.Users.findByPk(session.user_id)
    if (!user || !user.is_active) {
      return reply.code(401).send({ ok: false, message: 'Account is inactive.' })
    }

    request.user = user
    request.session = session
  })
})
