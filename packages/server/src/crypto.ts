import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (raw && raw.length === 64) return Buffer.from(raw, 'hex')
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY env var required (64 hex chars = 32 bytes)')
  }
  return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex')
}

const KEY = getKey()

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')
  return JSON.stringify({ e: encrypted, iv: iv.toString('hex'), t: tag })
}

export function decrypt(payload: string): string {
  const { e, iv, t } = JSON.parse(payload)
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(t, 'hex'))
  let decrypted = decipher.update(e, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export const encryptField = encrypt
export const decryptField = decrypt
