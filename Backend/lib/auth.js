import crypto from 'node:crypto'

// Password hashing using Node's built-in scrypt (no external bcrypt dependency).
// Stored as a hex hash + a per-password hex salt.

const KEY_LENGTH = 64

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString('hex')
  return { hash, salt }
}

export function verifyPassword(password, hash, salt) {
  if (!hash || !salt) return false
  const candidate = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString('hex')
  const a = Buffer.from(candidate, 'hex')
  const b = Buffer.from(hash, 'hex')
  // Length check guards timingSafeEqual, which throws on length mismatch.
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Opaque random session token stored server-side in the sessions table.
export function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}
