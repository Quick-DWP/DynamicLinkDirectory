import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyCors from '@fastify/cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { loadConfig, logInit, requestLogInit, queryLogInit, log } from './lib/utility.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadConfig()

// Initialize logging
const logPath = logInit()
if (logPath) {
  console.log(`Message log file created at: ${logPath}`)
}

const requestLogPath = requestLogInit()
if (requestLogPath) {
  console.log(`Request log file created at: ${requestLogPath}`)
}

import dbPlugin from './app/plugins/db.js'
import authPlugin from './app/plugins/auth.js'
import requestLoggerPlugin from './app/plugins/request-logger.js'
import cronPlugin from './app/plugins/cron.js'
import websocketPlugin from './app/plugins/websocket.js'
import routes from './app/routes/index.js'

const fastify = Fastify({ logger: config.logging?.fastify || false })
fastify.decorate('config', config)

const env = process.env.NODE_ENV || 'development'
const port = process.env.PORT || config.app.port

await log(`Initializing server in ${env} environment`, import.meta.url)

await fastify.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
})
await log(`CORS plugin registered`, import.meta.url)

await fastify.register(requestLoggerPlugin)
await log(`Request logger plugin registered`, import.meta.url)

// Backward compatible: if `database.enabled` is not set, DB is considered enabled.
const shouldUseDatabase = config.database?.enabled !== false
if (shouldUseDatabase) {
  const queryLogPath = queryLogInit()
  if (queryLogPath) {
    console.log(`Query log file created at: ${queryLogPath}`)
  }

  await fastify.register(dbPlugin)
  await log(`Database plugin registered`, import.meta.url)
} else {
  await log(`Database plugin skipped (database.enabled=false)`, import.meta.url)
}

// Auth decorator is always registered so protected routes can reference it even
// when the DB is off; it returns 503 at request time if the DB is unavailable.
await fastify.register(authPlugin)
await log(`Auth plugin registered`, import.meta.url)

await fastify.register(cronPlugin)
await log(`Cron plugin registered`, import.meta.url)

await fastify.register(websocketPlugin)
await log(`Websocket plugin registered`, import.meta.url)

await fastify.register(fastifyStatic, {
  root: join(__dirname, 'public', 'dist'),
  prefix: '/'
})
await log(`Static file serving registered from public/dist`, import.meta.url)

await fastify.register(routes)
await log(`Routes registered (api + spa fallback)`, import.meta.url)

await fastify.listen({
  port,
  host: '0.0.0.0'
})

await log(`Server started successfully on port ${port}`, import.meta.url)
console.log(`Running in ${env} on port ${port}`)