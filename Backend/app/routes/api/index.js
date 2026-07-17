import { fn, col } from 'sequelize'
import categoryRoutes from './category.route.js'
import linkRoutes from './link.route.js'
import authRoutes from './auth.route.js'
import userRoutes from './user.route.js'
import settingRoutes from './setting.route.js'
import attachmentRoutes from './attachment.route.js'

export default async function (fastify) {
  // You can add api-level permissions/middleware here in the future
  // fastify.addHook('onRequest', async (request, reply) => {
  //   // Check API access permissions, authentication, etc.
  // })

  fastify.get('/health', async () => {
    return {
      ok: true,
      service: 'Dynamic Link Directory API',
      timestamp: new Date().toISOString(),
    }
  })

  fastify.get('/meta', async () => {
    const dbEnabled = fastify.config?.database?.enabled !== false
    return {
      ok: true,
      data: {
        name: fastify.config?.app?.name || 'Dynamic Link Directory',
        frontend: 'React + Vite',
        backend: 'Fastify + Sequelize',
        databaseEnabled: dbEnabled,
      },
    }
  })

  // Public directory: active categories (ordered) each with their active links (ordered),
  // plus any active uncategorized links grouped at the end.
  fastify.get('/directory', { preHandler: fastify.gateView }, async (request, reply) => {
    if (!fastify.db?.Categories || !fastify.db?.Links) {
      return reply.code(503).send({
        ok: false,
        message: 'Database models are unavailable. Enable and configure the database in config.json.',
      })
    }

    const categories = await fastify.db.Categories.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    })

    const activeLinks = await fastify.db.Links.findAll({
      where: { is_active: true },
      // `note` is an admin-only remark — never expose it on the public directory.
      attributes: { exclude: ['note'] },
      order: [['sort_order', 'ASC'], ['title', 'ASC']],
    })

    // How many attachments each link has, so the UI can show the button only when
    // there's something to see (bytes are never fetched here).
    const attachmentCounts = new Map()
    if (fastify.db.LinkAttachments) {
      const counts = await fastify.db.LinkAttachments.findAll({
        attributes: ['link_id', [fn('COUNT', col('uuid')), 'n']],
        group: ['link_id'],
        raw: true,
      })
      for (const c of counts) attachmentCounts.set(c.link_id, Number(c.n))
    }

    const toPublicLink = (link) => ({
      ...link.toJSON(),
      attachment_count: attachmentCounts.get(link.uuid) || 0,
    })

    const linksByCategory = new Map()
    const uncategorized = []
    for (const link of activeLinks) {
      const pub = toPublicLink(link)
      if (link.category_id) {
        if (!linksByCategory.has(link.category_id)) linksByCategory.set(link.category_id, [])
        linksByCategory.get(link.category_id).push(pub)
      } else {
        uncategorized.push(pub)
      }
    }

    const groups = categories.map((category) => ({
      ...category.toJSON(),
      links: linksByCategory.get(category.uuid) || [],
    }))

    if (uncategorized.length > 0) {
      groups.push({
        uuid: null,
        name: 'Other',
        description: '',
        icon: '🔗',
        color: null,
        default_expanded: false,
        links: uncategorized,
      })
    }

    return reply.send({ ok: true, data: groups })
  })

  // Public click tracking: increments a link's counter when opened from the directory.
  // Defined here (not in the admin-only link routes) so it stays unauthenticated.
  fastify.post('/links/:uuid/click', async (request, reply) => {
    if (!fastify.db?.Links) {
      return reply.code(503).send({ ok: false, message: 'Database models are unavailable.' })
    }
    const uuid = String(request.params?.uuid || '').trim()
    if (!uuid) {
      return reply.code(400).send({ ok: false, message: 'invalid link id' })
    }
    const [affected] = await fastify.db.Links.increment('click_count', { by: 1, where: { uuid } })
    // increment returns metadata; treat zero matched rows as not found.
    const matched = Array.isArray(affected) ? affected[1] : affected
    if (matched === 0) {
      return reply.code(404).send({ ok: false, message: 'link not found' })
    }
    return reply.send({ ok: true, data: { uuid } })
  })

  await fastify.register(authRoutes, { prefix: '/auth' })
  await fastify.register(userRoutes, { prefix: '/users' })
  await fastify.register(settingRoutes, { prefix: '/settings' })
  await fastify.register(categoryRoutes, { prefix: '/categories' })
  await fastify.register(linkRoutes, { prefix: '/links' })
  await fastify.register(attachmentRoutes, { prefix: '/attachments' })
}
