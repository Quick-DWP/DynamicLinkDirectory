import { initDB } from '../index.js'
import seedDld from '../seeds/seed_dld.js'

const main = async () => {
  const db = await initDB()

  try {
    await seedDld(db, { forceSync: true })
    console.log('DB reset + reseed completed with Dynamic Link Directory sample data.')
  } finally {
    await db.sequelize.close()
  }
}

main().catch((err) => {
  console.error('Failed to reset/reseed DB:', err)
  process.exit(1)
})
