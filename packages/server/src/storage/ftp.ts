import { Client } from 'basic-ftp'
import { dirname } from 'path'
import { Readable } from 'stream'
import type { StorageProvider } from './provider.js'

function parseFtpConfig(config: Record<string, string>) {
  return {
    host: config.host || 'localhost',
    port: parseInt(config.port) || 21,
    user: config.username || 'anonymous',
    password: config.password || '',
    secure: config.secure === 'true',
    remoteDir: config.remoteDir || '/upload',
  }
}

export const ftpProvider: StorageProvider = {
  name: 'ftp',

  async test(config: Record<string, string>) {
    const cfg = parseFtpConfig(config)
    const client = new Client()
    try {
      await client.access({
        host: cfg.host, port: cfg.port, user: cfg.user,
        password: cfg.password, secure: cfg.secure,
      })
      await client.ensureDir(cfg.remoteDir)
      client.close()
      return { success: true, message: `FTP connected to ${cfg.host}:${cfg.port}` }
    } catch (e: any) {
      client.close()
      return { success: false, message: e.message }
    }
  },

  async upload(config: Record<string, string>, filePath: string, buffer: Buffer) {
    const cfg = parseFtpConfig(config)
    const remotePath = filePath.replace(/\\/g, '/')
    const remoteDir = dirname(remotePath)
    const client = new Client()
    try {
      await client.access({
        host: cfg.host, port: cfg.port, user: cfg.user,
        password: cfg.password, secure: cfg.secure,
      })
      await client.ensureDir(`${cfg.remoteDir}/${remoteDir}`)
      const stream = Readable.from(buffer)
      await client.uploadFrom(stream, `${cfg.remoteDir}/${remotePath}`)
      client.close()
      return `${cfg.remoteDir}/${remotePath}`
    } catch (e: any) {
      client.close()
      throw e
    }
  },

  async delete(config: Record<string, string>, filePath: string) {
    const cfg = parseFtpConfig(config)
    const client = new Client()
    try {
      await client.access({
        host: cfg.host, port: cfg.port, user: cfg.user,
        password: cfg.password, secure: cfg.secure,
      })
      await client.remove(`${cfg.remoteDir}/${filePath}`)
      client.close()
    } catch (e: any) {
      client.close()
      throw e
    }
  },
}
