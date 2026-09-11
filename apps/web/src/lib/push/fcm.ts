import { createSign } from 'crypto'

// Hand-rolled FCM HTTP v1 client — no firebase-admin. This app's dependency
// style is consistently "use the raw API/SDK directly" (see lib/storage/r2.ts
// using @aws-sdk/client-s3 rather than a wrapper); firebase-admin pulls in a
// large SDK for what's really one narrow job — sign a JWT, exchange it for an
// OAuth token, POST a handful of messages — that Node's built-in crypto/fetch
// already do.

function base64url(input: Buffer | string) {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input)).toString('base64url')
}

async function getAccessToken(): Promise<string> {
  const clientEmail = process.env.FCM_CLIENT_EMAIL
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!clientEmail || !privateKey) {
    throw new Error('Missing FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  )
  const signingInput = `${header}.${claims}`
  const signature = base64url(createSign('RSA-SHA256').update(signingInput).sign(privateKey))
  const jwt = `${signingInput}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`FCM token exchange failed: ${res.status}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  return data.access_token
}

// Cached in-process until near expiry — same lazy-singleton-from-env shape
// as r2.ts's r2Client(), just for a token instead of a client instance.
let cachedToken: { value: string; expiresAt: number } | null = null

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
  const value = await getAccessToken()
  cachedToken = { value, expiresAt: Date.now() + 55 * 60_000 }
  return value
}

export type PushNotification = {
  title: string
  body: string
  data?: Record<string, string>
}

// Never throws past its own boundary — a push failure must never fail the
// ticket reply / payment review / invite creation it's attached to. FCM's
// HTTP v1 API has no multicast endpoint, so each token is its own request.
export async function sendPushToTokens(tokens: string[], notification: PushNotification): Promise<void> {
  if (tokens.length === 0) return
  const projectId = process.env.FCM_PROJECT_ID
  if (!projectId) {
    console.error('Missing FCM_PROJECT_ID')
    return
  }

  let token: string
  try {
    token = await accessToken()
  } catch (err) {
    console.error('FCM auth failed', err)
    return
  }

  await Promise.allSettled(
    tokens.map(async (deviceToken) => {
      try {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token: deviceToken,
              notification: { title: notification.title, body: notification.body },
              data: notification.data ?? {},
            },
          }),
        })
        if (!res.ok) console.error('FCM send failed', res.status, await res.text())
      } catch (err) {
        console.error('FCM send failed', err)
      }
    })
  )
}
