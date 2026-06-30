// Site settings exposed to the public directory (read) and editable by admins (write).
// Stored as key/value rows; GET merges stored values over these defaults so the
// endpoint always returns a complete, sensible object even before anything is saved.
const DEFAULTS = {
  site_title: 'Dynamic Link Directory',
  site_subtitle: 'A simple web portal — browse and jump to the links you need.',
}

const ALLOWED_KEYS = Object.keys(DEFAULTS)

function ensureModel(fastify, reply) {
  if (!fastify.db?.Settings) {
    reply.code(503).send({ ok: false, message: 'Database models are unavailable.' })
    return null
  }
  return fastify.db.Settings
}

export default async function settingRoutes(fastify) {
  // Public: read the current site settings.
  fastify.get('/', async (request, reply) => {
    const Settings = ensureModel(fastify, reply)
    if (!Settings) return

    const rows = await Settings.findAll()
    const stored = {}
    for (const row of rows) {
      if (ALLOWED_KEYS.includes(row.key)) stored[row.key] = row.value
    }
    return reply.send({ ok: true, data: { ...DEFAULTS, ...stored } })
  })

  // Admin: update one or more known settings.
  fastify.put('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const Settings = ensureModel(fastify, reply)
    if (!Settings) return

    const body = request.body || {}
    const updates = ALLOWED_KEYS.filter((key) => body[key] !== undefined)
    if (updates.length === 0) {
      return reply.code(400).send({ ok: false, message: `Provide at least one of: ${ALLOWED_KEYS.join(', ')}` })
    }

    for (const key of updates) {
      await Settings.upsert({ key, value: String(body[key] ?? '') })
    }

    const rows = await Settings.findAll()
    const stored = {}
    for (const row of rows) {
      if (ALLOWED_KEYS.includes(row.key)) stored[row.key] = row.value
    }
    return reply.send({ ok: true, data: { ...DEFAULTS, ...stored } })
  })
}
