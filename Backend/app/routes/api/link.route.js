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

function buildLinkPatch(body) {
  const next = {}
  if (body.title !== undefined) next.title = normalizeText(body.title)
  if (body.url !== undefined) next.url = normalizeText(body.url)
  if (body.description !== undefined) next.description = normalizeText(body.description)
  if (body.icon !== undefined) next.icon = normalizeText(body.icon) || null
  if (body.category_id !== undefined) next.category_id = normalizeText(body.category_id) || null
  if (body.sort_order !== undefined) next.sort_order = Number(body.sort_order) || 0
  if (body.is_active !== undefined) next.is_active = Boolean(body.is_active)
  if (body.open_in_new_tab !== undefined) next.open_in_new_tab = Boolean(body.open_in_new_tab)
  if (body.note !== undefined) next.note = normalizeText(body.note) || null
  return next
}

export default async function linkRoutes(fastify) {
  // Every link route here is admin-only. The public click-tracking endpoint
  // lives in api/index.js so it stays unauthenticated.
  fastify.addHook('preHandler', fastify.requireAdmin)

  // List all links (admin view). Optional filters: ?category_id=, ?active=true
  fastify.get('/', async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const query = request.query || {}
    const where = {}

    const categoryId = normalizeText(query.category_id)
    if (categoryId) where.category_id = categoryId
    if (query.active !== undefined) where.is_active = query.active === 'true' || query.active === true

    const rows = await db.Links.findAll({
      where,
      order: [['sort_order', 'ASC'], ['title', 'ASC']],
    })
    return reply.send({ ok: true, data: rows })
  })

  fastify.post('/', async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const body = request.body || {}
    const title = normalizeText(body.title)
    const url = normalizeText(body.url)
    if (!title) return reply.code(400).send({ ok: false, message: 'title is required' })
    if (!url) return reply.code(400).send({ ok: false, message: 'url is required' })

    const row = await db.Links.create({
      title,
      url,
      description: normalizeText(body.description),
      icon: normalizeText(body.icon) || null,
      category_id: normalizeText(body.category_id) || null,
      sort_order: Number(body.sort_order) || 0,
      is_active: body.is_active === undefined ? true : Boolean(body.is_active),
      open_in_new_tab: body.open_in_new_tab === undefined ? true : Boolean(body.open_in_new_tab),
      note: normalizeText(body.note) || null,
    })
    return reply.code(201).send({ ok: true, data: row })
  })

  fastify.patch('/:uuid', async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const uuid = normalizeText(request.params?.uuid)
    if (!uuid) return reply.code(400).send({ ok: false, message: 'invalid link id' })

    const row = await db.Links.findByPk(uuid)
    if (!row) return reply.code(404).send({ ok: false, message: 'link not found' })

    await row.update(buildLinkPatch(request.body || {}))
    return reply.send({ ok: true, data: row })
  })

  fastify.delete('/:uuid', async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const uuid = normalizeText(request.params?.uuid)
    if (!uuid) return reply.code(400).send({ ok: false, message: 'invalid link id' })

    const row = await db.Links.findByPk(uuid)
    if (!row) return reply.code(404).send({ ok: false, message: 'link not found' })

    // Remove attached files first (belt-and-suspenders alongside the FK cascade).
    if (db.LinkAttachments) {
      await db.LinkAttachments.destroy({ where: { link_id: uuid } })
    }
    await row.destroy()
    return reply.send({ ok: true, data: { uuid } })
  })

  // Reorder links: body { order: [uuid, uuid, ...] }
  fastify.post('/reorder', async (request, reply) => {
    const db = ensureModels(fastify, reply)
    if (!db) return

    const order = Array.isArray(request.body?.order) ? request.body.order : []
    if (order.length === 0) {
      return reply.code(400).send({ ok: false, message: 'order array is required' })
    }

    await db.sequelize.transaction(async (tx) => {
      for (let i = 0; i < order.length; i += 1) {
        await db.Links.update(
          { sort_order: i + 1 },
          { where: { uuid: order[i] }, transaction: tx },
        )
      }
    })
    return reply.send({ ok: true, data: { reordered: order.length } })
  })
}
