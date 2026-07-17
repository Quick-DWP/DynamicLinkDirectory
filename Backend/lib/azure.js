import { createRemoteJWKSet, jwtVerify } from 'jose'

// Cache one remote JWKS per tenant (jose caches keys internally too).
const jwksByTenant = new Map()

function getJwks(tenantId) {
  if (!jwksByTenant.has(tenantId)) {
    jwksByTenant.set(
      tenantId,
      createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)),
    )
  }
  return jwksByTenant.get(tenantId)
}

// Verify a Microsoft (Azure AD / Entra) ID token cryptographically and extract
// the user's email. Throws if the token is invalid / issuer or audience mismatch.
export async function verifyAzureIdToken(idToken, { tenantId, clientId, audience }) {
  const jwks = getJwks(tenantId)
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    audience: audience || clientId,
  })
  const email = String(payload.email || payload.preferred_username || payload.upn || '').trim()
  const name = String(payload.name || '').trim()
  return { payload, email, name }
}
