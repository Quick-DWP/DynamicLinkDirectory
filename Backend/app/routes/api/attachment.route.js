// Per-link file attachments (specs, guidelines, manuals, ...).
//
// Reads (list + raw bytes) follow the same view gate as the directory, so they
// respect `require_login`. Writes are admin-only. Files are stored as bytes in
// Postgres (like the site logo). The raw endpoint serves with a locked-down CSP
// + nosniff so a file opened directly can never execute in our origin; the
// frontend previews via authenticated blob fetches, not by pointing tags here.

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 // 25 MB
const UPLOAD_BODY_LIMIT = 36 * 1024 * 1024 // base64 of 25 MB (~33.3 MB) + JSON overhead

// Curated allowlist. Preview support is best-effort per type on the frontend;
// anything not previewable falls back to a download button.
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
  'text/plain', 'text/csv', 'text/markdown',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-zip-compressed',
])

const EXT_MIME = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
  txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', json: 'application/json',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
}

const PUBLIC_FIELDS = ['uuid', 'link_id', 'filename', 'mime_type', 'size', 'sort_order', 'created_at']

function text(v) {
  return String(v ?? '').trim()
}

function extOf(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '')
  return m ? m[1].toLowerCase() : ''
}

// Strip anything that could break a Content-Disposition header.
function safeFilename(name) {
  return text(name).replace(/[\r\n"\\]/g, '_').slice(0, 200) || 'file'
}

function ensureModel(fastify, reply) {
  if (!fastify.db?.LinkAttachments) {
    reply.code(503).send({ ok: false, message: 'Database models are unavailable.' })
    return null
  }
  return fastify.db.LinkAttachments
}

export default async function attachmentRoutes(fastify) {
  // --- Reads: gated exactly like the directory (respects require_login) ---

  // List a link's attachments (metadata only — never the bytes).
  fastify.get('/link/:linkId', { preHandler: fastify.gateView }, async (request, reply) => {
    const Att = ensureModel(fastify, reply)
    if (!Att) return
    const linkId = text(request.params?.linkId)
    if (!linkId) return reply.code(400).send({ ok: false, message: 'invalid link id' })
    const rows = await Att.findAll({
      where: { link_id: linkId },
      attributes: PUBLIC_FIELDS,
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']],
    })
    return reply.send({ ok: true, data: rows })
  })

  // Stream one attachment's raw bytes. The frontend fetches this with the bearer
  // token and renders via a blob: URL, so previews work under the login gate.
  fastify.get('/:uuid/raw', { preHandler: fastify.gateView }, async (request, reply) => {
    const Att = ensureModel(fastify, reply)
    if (!Att) return
    const uuid = text(request.params?.uuid)
    const row = await Att.findByPk(uuid)
    if (!row) return reply.code(404).send({ ok: false, message: 'attachment not found' })

    reply.header('Content-Type', row.mime_type)
    reply.header('Content-Length', row.size)
    reply.header('Cache-Control', 'private, max-age=300')
    reply.header('X-Content-Type-Options', 'nosniff')
    // Neutralize any active content if the file is opened directly.
    reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox")
    reply.header('Content-Disposition', `inline; filename="${safeFilename(row.filename)}"`)
    return reply.send(row.data)
  })

  // --- Writes: admin only ---

  // Upload a new attachment for a link. Body: { filename, mime_type, data(base64) }.
  fastify.post('/link/:linkId', { preHandler: fastify.requireAdmin, bodyLimit: UPLOAD_BODY_LIMIT }, async (request, reply) => {
    const Att = ensureModel(fastify, reply)
    if (!Att) return
    if (!fastify.db?.Links) return reply.code(503).send({ ok: false, message: 'Database models are unavailable.' })

    const linkId = text(request.params?.linkId)
    const link = await fastify.db.Links.findByPk(linkId)
    if (!link) return reply.code(404).send({ ok: false, message: 'link not found' })

    const body = request.body || {}
    const filename = safeFilename(body.filename)
    let mime = text(body.mime_type).toLowerCase()
    const base64 = String(body.data || '')
    if (!base64) return reply.code(400).send({ ok: false, message: 'No file data provided.' })

    // Fall back to the filename extension when the browser sends nothing useful.
    if (!mime || mime === 'application/octet-stream') {
      mime = EXT_MIME[extOf(filename)] || mime
    }
    if (!ALLOWED_MIME.has(mime)) {
      return reply.code(415).send({ ok: false, message: `Unsupported file type${mime ? ` (${mime})` : ''}. Allowed: PDF, images, text/CSV, Office documents, and ZIP.` })
    }

    const buf = Buffer.from(base64, 'base64')
    if (buf.length === 0) return reply.code(400).send({ ok: false, message: 'Invalid file data.' })
    if (buf.length > MAX_ATTACHMENT_BYTES) {
      return reply.code(413).send({ ok: false, message: 'File must be 25 MB or smaller.' })
    }
    // PDFs are the primary use case — make sure the bytes really are a PDF so an
    // HTML/script file can't masquerade as one.
    if (mime === 'application/pdf' && buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return reply.code(400).send({ ok: false, message: 'File contents are not a valid PDF.' })
    }

    const maxOrder = await Att.max('sort_order', { where: { link_id: linkId } })
    const row = await Att.create({
      link_id: linkId,
      filename,
      mime_type: mime,
      size: buf.length,
      data: buf,
      sort_order: (Number.isFinite(maxOrder) ? maxOrder : 0) + 1,
    })
    // Echo metadata only (not the bytes).
    const out = {}
    for (const f of PUBLIC_FIELDS) out[f] = row[f]
    return reply.code(201).send({ ok: true, data: out })
  })

  // Rename / reorder an attachment (metadata only).
  fastify.patch('/:uuid', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const Att = ensureModel(fastify, reply)
    if (!Att) return
    const uuid = text(request.params?.uuid)
    const row = await Att.findByPk(uuid)
    if (!row) return reply.code(404).send({ ok: false, message: 'attachment not found' })

    const body = request.body || {}
    const next = {}
    if (body.filename !== undefined) {
      const fn = safeFilename(body.filename)
      if (!fn) return reply.code(400).send({ ok: false, message: 'filename cannot be empty' })
      next.filename = fn
    }
    if (body.sort_order !== undefined) next.sort_order = Number(body.sort_order) || 0
    await row.update(next)
    const out = {}
    for (const f of PUBLIC_FIELDS) out[f] = row[f]
    return reply.send({ ok: true, data: out })
  })

  fastify.delete('/:uuid', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const Att = ensureModel(fastify, reply)
    if (!Att) return
    const uuid = text(request.params?.uuid)
    const row = await Att.findByPk(uuid)
    if (!row) return reply.code(404).send({ ok: false, message: 'attachment not found' })
    await row.destroy()
    return reply.send({ ok: true, data: { uuid } })
  })
}
