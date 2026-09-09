import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// One R2 bucket, split by key prefix rather than by separate buckets — the
// two categories used to be separate Supabase Storage buckets because each
// had its own bucket-level RLS policy, but R2 has no per-bucket RLS at all;
// authorization now lives entirely in application code (requireOrgRole,
// isPlatformAdmin), so the bucket boundary wasn't doing any real work.
export type R2Category = 'worker-photos' | 'payment-proofs'

function bucketName() {
  const name = process.env.R2_BUCKET
  if (!name) throw new Error('Missing env var R2_BUCKET')
  return name
}

// Lazily constructed rather than at module scope so a build (which imports
// this module but never calls into it) doesn't fail on missing R2 env vars.
let client: S3Client | null = null
function r2Client() {
  if (client) return client
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY')
  }
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
  return client
}

export async function uploadObject(category: R2Category, key: string, file: File) {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: `${category}/${key}`,
      Body: new Uint8Array(await file.arrayBuffer()),
      ContentType: file.type,
    })
  )
}

export async function getSignedReadUrl(category: R2Category, key: string, expiresInSeconds = 3600) {
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({ Bucket: bucketName(), Key: `${category}/${key}` }),
    { expiresIn: expiresInSeconds }
  )
}
