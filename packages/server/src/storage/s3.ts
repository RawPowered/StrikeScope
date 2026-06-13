import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import type { StorageProvider } from './provider.js'

function parseS3Config(config: Record<string, string>) {
  return {
    region: config.region || 'us-east-1',
    bucket: config.bucket || '',
    accessKeyId: config.accessKeyId || '',
    secretAccessKey: config.secretAccessKey || '',
    endpoint: config.endpoint || undefined,
    prefix: config.prefix || '',
  }
}

function createClient(cfg: ReturnType<typeof parseS3Config>) {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: cfg.accessKeyId
      ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }
      : undefined,
  })
}

export const s3Provider: StorageProvider = {
  name: 'aws-s3',

  async test(config: Record<string, string>) {
    const cfg = parseS3Config(config)
    if (!cfg.bucket) return { success: false, message: 'Bucket name is required' }
    try {
      const client = createClient(cfg)
      await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }))
      client.destroy()
      return { success: true, message: `S3 bucket accessible: ${cfg.bucket}` }
    } catch (e: any) {
      return { success: false, message: e.message }
    }
  },

  async upload(config: Record<string, string>, filePath: string, buffer: Buffer) {
    const cfg = parseS3Config(config)
    const key = cfg.prefix ? `${cfg.prefix}/${filePath}`.replace(/\\/g, '/') : filePath.replace(/\\/g, '/')
    const client = createClient(cfg)
    try {
      await client.send(new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: buffer,
      }))
      client.destroy()
      return key
    } catch (e: any) {
      client.destroy()
      throw e
    }
  },

  async delete(config: Record<string, string>, filePath: string) {
    const cfg = parseS3Config(config)
    const key = cfg.prefix ? `${cfg.prefix}/${filePath}`.replace(/\\/g, '/') : filePath.replace(/\\/g, '/')
    const client = createClient(cfg)
    try {
      await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }))
      client.destroy()
    } catch (e: any) {
      client.destroy()
      throw e
    }
  },
}
