function ensureModels(fastify, reply) {
  if (!fastify.db?.Categories || !fastify.db?.Links) {
    reply.code(503).send({
      ok: false,
      message: 'Database models are unavailable. Enable and configure the database in config.json.',
    })
    return null
  }
  return fastify.db
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function buildCategoryPatch(body, row) {
  const next = {}
  if (body.name !== undefined) next.name = normalizeText(body.name)
  if (body.description !== undefined) next.description = normalizeText(body.description)
  if (body.icon !== undefined) next.icon = normalizeText(body.icon) || null
  if (body.color !== undefined) next.color = normalizeText(body.color) || null
  if (body.sort_order !== undefined) next.sort_order = Number(body.sort_order) || 0
  if (body.default_expanded !== undefined) next.default_expanded = Boolean(body.default_expanded)
  if (body.is_active !== undefined) next.is_active = Boolean(body.is_active)
  return next
}

export default async function categoryRoutes(fastify) {
  // Every category route is admin-only.
  fastify.addHook('preHandler', fastify.authenticate)

  // List all categories (admin view), ordered for display.
  fastify.get('/', async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const rows = await db.Categories.findAll({
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    })
    return reply.send({ ok: true, data: rows })
  })

  fastify.post('/', async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const body = request.body || {}
    const name = normalizeText(body.name)
    if (!name) {
      return reply.code(400).send({ ok: false, message: 'name is required' })
    }

    const row = await db.Categories.create({
      name,
      description: normalizeText(body.description),
      icon: normalizeText(body.icon) || null,
      color: normalizeText(body.color) || null,
      sort_order: Number(body.sort_order) || 0,
      default_expanded: body.default_expanded === undefined ? false : Boolean(body.default_expanded),
      is_active: body.is_active === undefined ? true : Boolean(body.is_active),
    })
    return reply.code(201).send({ ok: true, data: row })
  })

  fastify.patch('/:uuid', async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const uuid = normalizeText(request.params?.uuid)
    if (!uuid) {
      return reply.code(400).send({ ok: false, message: 'invalid category id' })
    }

    const row = await db.Categories.findByPk(uuid)
    if (!row) {
      return reply.code(404).send({ ok: false, message: 'category not found' })
    }

    await row.update(buildCategoryPatch(request.body || {}, row))
    return reply.send({ ok: true, data: row })
  })

  fastify.delete('/:uuid', async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const uuid = normalizeText(request.params?.uuid)
    if (!uuid) {
      return reply.code(400).send({ ok: false, message: 'invalid category id' })
    }

    const row = await db.Categories.findByPk(uuid)
    if (!row) {
      return reply.code(404).send({ ok: false, message: 'category not found' })
    }

    // Links keep existing; their category_id is set to null via the FK rule.
    await row.destroy()
    return reply.send({ ok: true, data: { uuid } })
  })

  // Reorder categories: body { order: [uuid, uuid, ...] }
  fastify.post('/reorder', async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const order = Array.isArray(request.body?.order) ? request.body.order : []
    if (order.length === 0) {
      return reply.code(400).send({ ok: false, message: 'order array is required' })
    }

    await db.sequelize.transaction(async (tx) => {
      for (let i = 0; i < order.length; i += 1) {
        await db.Categories.update(
          { sort_order: i + 1 },
          { where: { uuid: order[i] }, transaction: tx },
        )
      }
    })
    return reply.send({ ok: true, data: { reordered: order.length } })
  })
}
